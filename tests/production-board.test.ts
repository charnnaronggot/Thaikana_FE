import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { create, createInjector, templateElements } from './support/angular';
import { AuthService } from '../src/app/core/auth/auth.service';
import { ApiClient } from '../src/app/core/services/api/api-client.service';
import { NativeApi } from '../src/app/features/modules/native-api.service';
import { StationWorkspace } from '../src/app/features/production/pages/station-workspace.component';
import { MutationSession } from '../src/app/shared/utils/mutation-session';

vi.mock('../src/app/core/auth/auth.service', () => ({ AuthService: class AuthService {} }));

const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });
const stations = [{ id: 'st-cut', code: 'CUT', name: 'ตัด' }, { id: 'st-weld', code: 'WLD', name: 'เชื่อม' }];
const work = (operationId: string, stationId: string, status: string, extra: Record<string, unknown> = {}) => ({
  operationId, workOrderId: 'wo-' + operationId, workOrderNo: 'WO-' + operationId, product: 'Bracket', revision: 'A', stationId,
  stationName: stationId, operationNo: 10, status, version: 3, dueDate: '2026-11-10', priority: 1, planned: 8, good: 0, reject: 0, scrap: 0,
  availableInput: 8, remaining: 8, legacyReviewRequired: false, blockers: [], execution: null, canStart: status === 'READY', canPause: false, canResume: false, canComplete: false, ...extra,
});
const running = (operationId: string) =>
  work(operationId, 'st-cut', 'IN_PROGRESS', { canPause: true, canComplete: true, execution: { id: 'ex-' + operationId, version: 9, status: 'RUNNING', ownerId: 'worker-1', ownerName: 'สมชาย', ownerUsername: 'somchai', input: 8, startedAt: '2026-11-03T01:00:00Z' } });
const items = [work('a', 'st-cut', 'READY'), work('b', 'st-cut', 'WAITING'), running('c'), work('d', 'st-weld', 'READY'), work('e', 'st-weld', 'COMPLETED')];

function setup(account: { accountType: 'Station' | 'Personal'; id?: string; username?: string } = { accountType: 'Station' }) {
  const native = { get: vi.fn(async (path: string) => (path === '/station/workspace' ? { stations, items, page: 1, pageSize: 50, totalCount: items.length } : { lanes: [], cards: [], totalCount: 0 })) };
  const post = vi.fn(async (path: string, body?: unknown, key?: string): Promise<unknown> => (path === '/action-verifications' ? { verificationId: 'ver-1', version: 10, executionId: 'ex-c' } : { ok: true }));
  const auth = { user: () => ({ id: account.id ?? 'station-1', username: account.username ?? 'dev-station', accountType: account.accountType }) };
  const route = { snapshot: { queryParamMap: { get: () => null } } };
  const page = create(StationWorkspace, createInjector([
    MutationSession, { provide: NativeApi, useValue: native }, { provide: ApiClient, useValue: { post } }, { provide: AuthService, useValue: auth }, { provide: ActivatedRoute, useValue: route },
  ]));
  return { page, native, post };
}

describe('F10 production board', () => {
  it('shows one column per station and every card exactly once', async () => {
    const { page } = setup();
    await page.load();
    const columns = page.boardColumns();
    expect(columns.map((c) => c.id)).toEqual(['st-cut', 'st-weld']);
    expect(columns.flatMap((c) => c.items.map((x) => x.operationId)).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('switches to status lanes for a single station without dropping cards of that station', async () => {
    const { page } = setup();
    await page.load();
    page.stationId = 'st-cut';
    const columns = page.boardColumns();
    expect(columns.map((c) => c.name)).toEqual(['พร้อมเริ่ม', 'กำลังทำ', 'พัก', 'รอขั้นก่อน', 'จบขั้นตอน']);
    expect(columns.map((c) => c.items.length)).toEqual([2, 1, 0, 1, 1]);
  });
  it('drops a late response from an older load', async () => {
    const { page, native } = setup();
    let first!: (value: unknown) => void;
    native.get.mockImplementationOnce(() => new Promise((r) => (first = r)) as never);
    const older = page.load();
    await page.load();
    first({ stations, items: [], page: 1, pageSize: 50, totalCount: 0 });
    await older;
    expect(page.data()!.items.length).toBe(5);
    expect(page.loading()).toBe(false);
  });
  it('waits instead of switching view during a load, then reads the Agile board with GET only', async () => {
    const { page, native, post } = setup();
    let release!: (value: unknown) => void;
    native.get.mockImplementationOnce(() => new Promise((r) => (release = r)) as never);
    const pending = page.load();
    page.setView('agile');
    expect(page.view()).toBe('board');
    release({ stations: [stations[0]], items, page: 1, pageSize: 50, totalCount: 5 });
    await pending;
    page.setView('agile');
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    expect(page.view()).toBe('agile');
    expect(page.stationId).toBe('st-cut');
    expect(native.get).toHaveBeenCalledWith('/station/agile-board', { page: 1, pageSize: 50, stationId: 'st-cut' });
    expect(post).not.toHaveBeenCalled();
  });
  it('explains a blocked drag and never changes stage', async () => {
    const { page, post } = setup();
    const event = { preventDefault: vi.fn(), dataTransfer: { dropEffect: 'move' } } as unknown as DragEvent;
    page.blockDrag(event);
    expect(page.dragNotice()).toMatch(/[฀-๿]/);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();
  });
});

describe('F10 Station PIN form', () => {
  it('requires the owner username and a 6-digit PIN for Pause before any verification call', async () => {
    const { page, post } = setup();
    await page.load();
    page.begin(running('c') as never, 'PAUSE');
    expect(page.model.username).toBe('somchai');
    expect(page.secretLabel()).toBe('PIN ผู้ทำรายการ (6 หลัก)');
    for (const secret of ['', '12345', '1234567', '12a456']) {
      page.model.secret = secret;
      await page.save();
      expect(page.fields()['secret']).toBe('ระบุ PIN 6 หลักของผู้ทำรายการ');
    }
    page.model.username = ' ';
    page.model.secret = '123456';
    await page.save();
    expect(page.fields()).toEqual({ username: 'ระบุบัญชีผู้ทำรายการ' });
    expect(post).not.toHaveBeenCalled();
  });
  it('uses the Worker password for Start and validates the quantity against available input', async () => {
    const { page, post } = setup();
    await page.load();
    page.begin(work('a', 'st-cut', 'READY') as never, 'START');
    expect([page.isPassword(), page.secretLabel()]).toEqual([true, 'รหัสผ่าน Worker']);
    page.model.username = 'somchai';
    page.model.secret = 'not-a-pin-password';
    page.model.quantity = 9;
    await page.save();
    expect(page.fields()).toEqual({ quantity: 'จำนวนต้องมากกว่าศูนย์และไม่เกิน input พร้อมใช้' });
    expect(post).not.toHaveBeenCalled();
  });
  it('a Supervisor acting for the owner needs own password, PIN and a reason', async () => {
    const { page, post } = setup();
    await page.load();
    page.begin(running('c') as never, 'PAUSE');
    page.model.delegated = true;
    page.changeDelegate();
    expect([page.model.username, page.usernameLabel(), page.needsSupervisorPassword(), page.remarkLabel()]).toEqual(['', 'บัญชีหัวหน้างาน', true, 'เหตุผล (จำเป็น)']);
    page.model.username = 'dev-supervisor';
    page.model.secret = '654321';
    await page.save();
    expect(Object.keys(page.fields()).sort()).toEqual(['password', 'remark']);
    expect(post).not.toHaveBeenCalled();
  });
  it('clears the PIN and shows the lock rule on invalid credentials without running the command', async () => {
    const { page, post } = setup();
    await page.load();
    post.mockRejectedValueOnce(http(401, { code: 'invalid_credentials', traceId: 'trace-401' }));
    page.begin(running('c') as never, 'PAUSE');
    page.model.secret = '000000';
    await page.save();
    expect(page.model.secret).toBe('');
    expect(page.formError()).toBe('บัญชี รหัสผ่าน หรือ PIN ไม่ถูกต้อง หรือถูกล็อกชั่วคราว · PIN ผิด 5 ครั้งล็อก 15 นาที');
    expect(post).toHaveBeenCalledOnce();
    expect(page.action()).toBe('PAUSE');
  });
  it('binds the one-use verification to the command and never re-sends the PIN', async () => {
    const { page, post, native } = setup();
    await page.load();
    page.begin(running('c') as never, 'PAUSE');
    page.model.secret = '123456';
    page.model.remark = 'พักเที่ยง';
    await page.save();
    expect(post.mock.calls[0][0]).toBe('/action-verifications');
    expect(post.mock.calls[0][1]).toMatchObject({ operationId: 'c', action: 'PAUSE', executionId: 'ex-c', expectedVersion: 3, username: 'somchai', secret: '123456', password: null, reason: null });
    expect(post.mock.calls[1][0]).toBe('/operations/c/pause');
    expect(post.mock.calls[1][1]).toEqual({ verificationId: 'ver-1', expectedVersion: 10, executionId: 'ex-c', remark: 'พักเที่ยง' });
    expect(JSON.stringify(post.mock.calls[1])).not.toContain('123456');
    expect(page.model.secret).toBe('');
    expect([page.action(), page.notice()]).toEqual([null, 'พักงานสำเร็จ · WO-c']);
    expect(native.get).toHaveBeenCalledTimes(2);
  });
  it('keeps a stale command conflict with its trace id until the user reloads', async () => {
    const { page, post, native } = setup();
    await page.load();
    post.mockImplementation(async (path: string) => {
      if (path === '/action-verifications') return { verificationId: 'ver-2', version: 10, executionId: 'ex-c' };
      throw http(409, { code: 'stale_version', traceId: 'trace-409' });
    });
    page.begin(running('c') as never, 'PAUSE');
    page.model.secret = '123456';
    await page.save();
    expect([page.command.problemCode(), page.command.traceId(), page.command.uncertain(), page.action()]).toEqual(['stale_version', 'trace-409', false, 'PAUSE']);
    await page.refreshAfterConflict();
    expect(page.action()).toBeNull();
    expect(native.get).toHaveBeenCalledTimes(2);
  });
  it('renders the PIN/password field masked and the trace id next to command errors', () => {
    const html = readFileSync('src/app/features/production/pages/station-workspace.component.html', 'utf8');
    const elements = templateElements(html);
    const secret = elements.find((e) => e.name === 'input' && e.attrs['name'] === 'secret')!;
    expect(secret.attrs).toMatchObject({ type: 'password', autocomplete: 'off' });
    expect(secret.inputs).toEqual(expect.arrayContaining(['aria-label', 'inputmode', 'maxlength']));
    expect(elements.find((e) => e.name === 'input' && e.attrs['name'] === 'supervisorPassword')!.attrs).toMatchObject({ type: 'password', 'aria-label': 'รหัสผ่านหัวหน้างาน' });
    expect(html).toContain('[traceId]="formError() ? \'\' : command.traceId()"');
  });
});

describe('F10 run history drawer (typed ViewState)', () => {
  const history = { operationId: 'c', executions: [{ id: 'ex-c', status: 'RUNNING', ownerId: 'w', ownerName: 'สมชาย', input: 8, startedAt: '2026-11-03T01:00:00Z', endedAt: null, legacyReviewRequired: false, events: [] }] };
  it('loads, shows empty and shows denied without retry', async () => {
    const { page, native } = setup();
    native.get.mockResolvedValueOnce(history as never);
    await page.openHistory(running('c') as never);
    expect([page.historyView().status, page.history()?.executions.length]).toEqual(['ready', 1]);
    native.get.mockResolvedValueOnce({ operationId: 'c', executions: [] } as never);
    await page.openHistory(running('c') as never);
    expect(page.historyView().status).toBe('empty');
    native.get.mockRejectedValueOnce(http(403, { traceId: 'trace-403' }));
    await page.openHistory(running('c') as never);
    expect(page.historyView()).toMatchObject({ status: 'denied', traceId: 'trace-403' });
    expect(page.history()).toBeNull();
  });
  it('ignores an answer for a drawer that was switched to another operation', async () => {
    const { page, native } = setup();
    let late!: (value: unknown) => void;
    native.get.mockImplementationOnce(() => new Promise((r) => (late = r)) as never);
    const first = page.openHistory(running('c') as never);
    native.get.mockResolvedValueOnce({ operationId: 'a', executions: [] } as never);
    await page.openHistory(work('a', 'st-cut', 'READY') as never);
    late(history);
    await first;
    expect([page.historyWork()?.operationId, page.historyView().status]).toEqual(['a', 'empty']);
  });
  it('binds the drawer to the typed state with an empty message and retry', () => {
    const html = readFileSync('src/app/features/production/pages/station-workspace.component.html', 'utf8');
    expect(html).toContain('<app-state [view]="historyView()" emptyText="ยังไม่มีรอบผลิต" (retry)="openHistory(work)" />');
    expect(html).not.toContain('historyBusy');
  });
});
