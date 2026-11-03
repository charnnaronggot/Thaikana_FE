import '@angular/compiler';
import { createEnvironmentInjector, EnvironmentInjector, Injector } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/app/core/auth/auth.service';
import { ApiClient, OfflineTransactionError } from '../src/app/core/services/api/api-client.service';
import { FinanceApi, financeError, normalizeEvidence } from '../src/app/features/finance/services/finance-api.service';
import { FinanceCommands, FinancePending } from '../src/app/features/finance/services/finance-commands.service';
import { moneyRemaining, moneySum, validMoney } from '../src/app/features/finance/models/finance-money';

// The auth boundary is supplied below; the browser-only dependency graph is covered by the real-API browser tests.
vi.mock('../src/app/core/auth/auth.service', () => ({ AuthService: class AuthService {} }));

const ID = '3f2c1a9e-6d4b-4c1e-9a77-0d2f5b8e1c11';
const problem = (status: number, code: string) => new HttpErrorResponse({ status, error: { code } });

describe('financeError', () => {
  it.each([
    ['stale_version', 'โหลดข้อมูลล่าสุด'],
    ['forbidden', 'ไม่มีสิทธิ์'],
    ['payment_exceeds_outstanding', 'ยอดค้าง'],
    ['payment_over_allocated', 'ยอดที่จัดสรรเกิน'],
    ['payment_evidence_required', 'หลักฐานรับเงินจริง'],
    ['payment_reference_used', 'เลขอ้างอิง'],
    ['invoice_source_exhausted', 'จำนวนต้นทาง'],
    ['credit_exceeds_outstanding', 'ลดหนี้เกินยอดค้าง'],
    ['file_too_large', '20 MiB'],
  ])('maps %s to a specific Thai instruction', (code, fragment) => {
    expect(financeError(problem(409, code))).toContain(fragment);
  });
  it('falls back to the shared problem message for unknown codes and non-HTTP errors', () => {
    expect(financeError(new HttpErrorResponse({ status: 0 }))).toContain('เชื่อมต่อระบบไม่ได้');
    expect(financeError(new Error('custom'))).toBe('custom');
    expect(financeError('boom')).toBe('ไม่สามารถทำรายการได้');
    expect(financeError(problem(409, 'stale_version'))).not.toBe(financeError(problem(409, 'forbidden')));
  });
});

describe('normalizeEvidence', () => {
  it('repairs generic or missing MIME types from the extension and leaves correct files untouched', () => {
    for (const [name, mime] of [['bank.pdf', 'application/pdf'], ['slip.PNG', 'image/png'], ['slip.jpeg', 'image/jpeg'], ['slip.jpg', 'image/jpeg'], ['slip.webp', 'image/webp']] as const) {
      expect(normalizeEvidence(new File(['x'], name, { type: 'application/octet-stream' })).type).toBe(mime);
      expect(normalizeEvidence(new File(['x'], name, { type: '' })).type).toBe(mime);
    }
    expect(normalizeEvidence(new File(['x'], 'x.pdf', { type: 'application/x-pdf' })).type).toBe('application/pdf');
    const proper = new File(['x'], 'slip.png', { type: 'image/png' });
    expect(normalizeEvidence(proper)).toBe(proper);
    expect(normalizeEvidence(new File(['x'], 'notes.txt', { type: 'application/octet-stream' })).type).toBe('application/octet-stream');
  });
  it('keeps the file name, size and content when only the type is corrected', async () => {
    const fixed = normalizeEvidence(new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/octet-stream' }));
    expect(fixed.name).toBe('receipt.pdf');
    expect(await fixed.text()).toBe('%PDF-1.7');
  });
});

describe('payment allocation money', () => {
  it('one payment split over several invoices never invents or loses a satang', () => {
    const allocations = [400.1, 299.9, 0.01];
    expect(moneySum(allocations)).toBe(700.01);
    expect(moneyRemaining(1000, moneySum(allocations))).toBe(299.99);
    expect(moneyRemaining(700.01, moneySum(allocations))).toBe(0);
    expect(moneyRemaining(100, 100.01)).toBe(0); // an over-allocation is reported separately, remaining never goes negative
  });
  it('ignores non-finite rows instead of poisoning the total', () => {
    expect(moneySum([100, NaN, Infinity, 0.5])).toBe(100.5);
    expect(moneyRemaining(NaN as unknown as number, 5)).toBe(0); // an unknown payment amount can never look like remaining credit
  });
  it('accepts exactly two decimals and rejects fractional satang, zero and negatives', () => {
    for (const amount of [0.01, 1, 12.3, 1234567.89]) expect(validMoney(amount)).toBe(true);
    for (const amount of [0, -0.01, 0.005, 1.001, NaN, Infinity]) expect(validMoney(amount)).toBe(false);
  });
});

describe('FinanceCommands: one idempotency key per command, never a silent duplicate', () => {
  const storageMap = new Map<string, string>();
  let user: { id: string } | null;
  let api: { post: ReturnType<typeof vi.fn> };
  let fin: { upload: ReturnType<typeof vi.fn>; state: ReturnType<typeof vi.fn> };
  let commands: FinanceCommands;
  const owner = {};
  let done: ReturnType<typeof vi.fn>;
  const make = () => {
    const injector = createEnvironmentInjector(
      [{ provide: AuthService, useValue: { user: () => user } }, { provide: ApiClient, useValue: api }, { provide: FinanceApi, useValue: fin }, FinanceCommands],
      Injector.create({ providers: [] }) as EnvironmentInjector,
    );
    return injector.get(FinanceCommands);
  };
  const confirmPath = `/finance/payments/${ID}/confirm`;
  beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => storageMap.get(k) ?? null, setItem: (k: string, v: string) => void storageMap.set(k, v), removeItem: (k: string) => void storageMap.delete(k) });
    user = { id: 'finance-1' };
    api = { post: vi.fn() };
    fin = { upload: vi.fn(), state: vi.fn() };
    done = vi.fn(async () => undefined);
    commands = make();
    commands.attach(owner, done);
  });

  it('saves the key and payload before sending, then clears the recovery record after the screen finished loading', async () => {
    api.post.mockResolvedValue({ id: ID, version: 3 });
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'ยืนยันรับเงิน');
    expect(api.post).toHaveBeenCalledTimes(1);
    const [path, body, key] = api.post.mock.calls[0];
    expect(path).toBe(confirmPath);
    expect(body).toEqual({ expectedVersion: 2 });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(done).toHaveBeenCalledWith({ id: ID, version: 3 }, expect.objectContaining({ key, kind: 'finance.payment_confirm', actor: 'finance-1' }));
    expect(commands.pending()).toBeNull();
    expect(commands.uncertain()).toBe(false);
    expect(storageMap.size).toBe(0);
  });

  it('keeps the same key and body when the response is lost, and retry never mints a second command', async () => {
    api.post.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 })).mockResolvedValueOnce({ id: ID });
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'ยืนยัน');
    expect(commands.uncertain()).toBe(true);
    const lost = commands.pending()!;
    expect(JSON.parse(storageMap.get('thaikana.finance.pending.finance-1')!)).toMatchObject({ key: lost.key, path: confirmPath, body: { expectedVersion: 2 } });
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 99 }, [], 'ใหม่'); // blocked while the old command is unresolved
    expect(api.post).toHaveBeenCalledTimes(1);
    await commands.retry();
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post.mock.calls[1][2]).toBe(lost.key);
    expect(api.post.mock.calls[1][1]).toEqual({ expectedVersion: 2 });
    expect(commands.pending()).toBeNull();
  });

  it.each([500, 503])('treats HTTP %i as unknown and command_in_progress as unresolved', async (status) => {
    api.post.mockRejectedValueOnce(new HttpErrorResponse({ status, error: {} }));
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 1 }, [], 'x');
    expect(commands.uncertain()).toBe(true);
    expect(commands.pending()).not.toBeNull();
  });

  it('clears a definitively rejected command (stale version) so the next attempt gets a fresh key', async () => {
    api.post.mockRejectedValueOnce(problem(409, 'stale_version')).mockResolvedValueOnce({ id: ID });
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 1 }, [], 'x');
    expect(commands.uncertain()).toBe(false);
    expect(commands.pending()).toBeNull();
    expect(commands.code()).toBe('stale_version');
    expect(commands.error()).toContain('โหลดข้อมูลล่าสุด');
    expect(storageMap.size).toBe(0);
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'x');
    expect(api.post.mock.calls[1][2]).not.toBe(api.post.mock.calls[0][2]);
  });

  it('refuses unknown command/path pairs before any request is made', async () => {
    await commands.run('finance.payment_confirm', `/finance/payments/${ID}/reverse`, {}, [], 'x');
    await commands.run('finance.unknown', '/finance/anything', {}, [], 'x');
    await commands.run('finance.payment_confirm', '/finance/payments/not-a-guid/confirm', {}, [], 'x');
    expect(api.post).not.toHaveBeenCalled();
    expect(commands.pending()).toBeNull();
    expect(commands.error()).toBe('ไม่รองรับคำสั่งนี้');
  });

  it('uploads evidence with the same key on retry and needs the identical files after a reload', async () => {
    const slip = new File(['slip-bytes'], 'slip.png', { type: 'image/png' });
    fin.upload.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 })).mockResolvedValueOnce({ id: ID });
    await commands.run('finance.payment_evidence', `/finance/payments/${ID}/evidence`, { expectedVersion: 1 }, [slip], 'แนบหลักฐาน');
    const first = commands.pending()!;
    expect(first.files).toHaveLength(1);
    expect(first.files[0]).toMatchObject({ name: 'slip.png', bytes: 10 });
    expect(first.files[0].sha256).toMatch(/^[0-9A-F]{64}$/);
    // A reloaded tab restores the record but not the bytes.
    fin.state.mockResolvedValue({ completed: false }); // the restored record is checked automatically; nothing was committed
    const reloaded = make();
    reloaded.attach(owner, done);
    await vi.waitFor(() => expect(reloaded.busy()).toBe(false));
    expect(reloaded.pending()?.key).toBe(first.key);
    expect(reloaded.needsFiles()).toBe(true);
    await reloaded.retry();
    expect(fin.upload).toHaveBeenCalledTimes(1);
    expect(reloaded.error()).toContain('เลือกไฟล์เดิม');
    await reloaded.reselect([new File(['other-bytes'], 'slip.png', { type: 'image/png' })]);
    expect(reloaded.needsFiles()).toBe(true);
    await reloaded.reselect([new File(['slip-bytes'], 'slip.png', { type: 'image/png' })]);
    expect(reloaded.needsFiles()).toBe(false);
    await reloaded.retry();
    expect(fin.upload).toHaveBeenCalledTimes(2);
    expect(fin.upload.mock.calls[1][3]).toBe(first.key);
    expect(reloaded.pending()).toBeNull();
  });

  it('check() adopts a completed result without re-sending, and stays unresolved otherwise', async () => {
    api.post.mockRejectedValueOnce(new HttpErrorResponse({ status: 503, error: {} }));
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'x');
    const p = commands.pending()!;
    fin.state.mockResolvedValueOnce({ completed: false });
    await commands.check();
    expect(commands.uncertain()).toBe(true);
    expect(commands.error()).toContain('ไม่สร้างรายการใหม่');
    fin.state.mockResolvedValueOnce({ completed: true, result: { id: ID, version: 3 } });
    await commands.check();
    expect(fin.state).toHaveBeenLastCalledWith('finance.payment_confirm', p.key);
    expect(done).toHaveBeenCalledWith({ id: ID, version: 3 }, expect.objectContaining({ key: p.key }));
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(commands.pending()).toBeNull();
  });

  it('rejects a stored command that belongs to someone else, to another command or has an oversized key', () => {
    const bad: FinancePending[] = [
      { actor: 'someone-else', kind: 'finance.payment_confirm', path: confirmPath, key: 'k', body: {}, files: [], label: 'x' },
      { actor: 'finance-1', kind: 'finance.payment_confirm', path: `/finance/payments/${ID}/reverse`, key: 'k', body: {}, files: [], label: 'x' },
      { actor: 'finance-1', kind: 'finance.payment_confirm', path: confirmPath, key: 'k'.repeat(129), body: {}, files: [], label: 'x' },
    ];
    for (const record of bad) {
      storageMap.set('thaikana.finance.pending.finance-1', JSON.stringify(record));
      const fresh = make();
      fresh.attach(owner, done);
      expect(fresh.pending()).toBeNull();
      expect(fresh.uncertain()).toBe(true);
      expect(fresh.error()).toContain('ข้อมูลคำสั่งค้างไม่ถูกต้อง');
    }
  });

  it('does not send while the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'x');
    expect(api.post).not.toHaveBeenCalled();
    expect(commands.pending()).toBeNull();
    expect(commands.error()).toContain('ออนไลน์');
    vi.unstubAllGlobals();
  });

  it('an offline error while the outcome is unknown stays unresolved instead of being forgotten', async () => {
    api.post.mockRejectedValueOnce(new HttpErrorResponse({ status: 0 })).mockRejectedValueOnce(new OfflineTransactionError());
    await commands.run('finance.payment_confirm', confirmPath, { expectedVersion: 2 }, [], 'x');
    await commands.retry();
    expect(commands.uncertain()).toBe(true);
    expect(commands.pending()).not.toBeNull();
  });
});
