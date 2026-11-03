import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { create, createInjector, fakeDocument, inlineTemplate, setInput, templateElements } from './support/angular';
import { DataColumn, DataTable } from '../src/app/shared/components/data-table.component';
import { FilterBar } from '../src/app/shared/components/filter-bar.component';
import { Drawer, ScanInput, StateMessage, StatusBadge, TraceReference } from '../src/app/shared/components/ui';
import { ModalScrollLock } from '../src/app/shared/utils/modal-scroll-lock';
import { problemView, readyView } from '../src/app/shared/utils/view-state';

const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('F01 StatusBadge', () => {
  it.each([
    ['Approved', 'good'], ['Completed', 'good'], ['ผ่าน', 'good'], ['PartiallyPaid', 'warn'], ['รอตรวจ', 'warn'],
    ['OnHold', 'warn'], ['Rejected', 'bad'], ['Reversed', 'bad'], ['ไม่ผ่าน', 'bad'], ['Unknown', ''],
  ])('%s is shown as %s', (value, tone) => {
    const badge = create(StatusBadge);
    setInput(badge.value, value);
    expect({ good: badge.good(), warn: badge.warn(), bad: badge.bad() }).toEqual({ good: tone === 'good', warn: tone === 'warn', bad: tone === 'bad' });
  });
  it('matches whole words only, so a status containing a tone word is not recoloured', () => {
    const badge = create(StatusBadge);
    setInput(badge.value, 'NotApprovedYet');
    expect([badge.good(), badge.warn(), badge.bad()]).toEqual([false, false, false]);
  });
});

describe('F01 Drawer / Dialog', () => {
  it('is a labelled modal dialog that traps focus, handles Escape and has a named close button', () => {
    const elements = templateElements(inlineTemplate(Drawer));
    const dialog = elements.find((e) => e.attrs['role'] === 'dialog')!;
    expect(dialog.attrs).toMatchObject({ 'aria-modal': 'true', cdkTrapFocus: '' });
    expect(dialog.inputs).toEqual(expect.arrayContaining(['aria-label', 'cdkTrapFocusAutoCapture']));
    expect(dialog.outputs).toContain('keydown.escape');
    const close = elements.find((e) => e.attrs['aria-label'] === 'ปิด')!;
    expect(close).toMatchObject({ name: 'button', attrs: expect.objectContaining({ type: 'button' }) });
    expect(close.inputs).toContain('disabled');
    expect(elements.find((e) => e.name === 'img')!.attrs['alt']).toBe('');
  });
  it('closes from the close button, scrim and Escape unless a command is in flight', () => {
    const drawer = create(Drawer);
    const closed = vi.fn();
    drawer.close.subscribe(closed);
    const escape = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as unknown as Event;
    drawer.attemptClose();
    drawer.onEscape(escape);
    expect(closed).toHaveBeenCalledTimes(2);
    // Escape never bubbles to the parent drawer, so nested dialogs close one layer at a time.
    expect(escape.stopPropagation).toHaveBeenCalledOnce();
    setInput(drawer.closeBlocked, true);
    drawer.attemptClose();
    drawer.onEscape(escape);
    expect(closed).toHaveBeenCalledTimes(2);
  });
  it('locks page scroll until the last stacked drawer is destroyed', () => {
    const document = fakeDocument();
    const injector = createInjector([], document);
    const lock = injector.get(ModalScrollLock);
    create(Drawer, injector);
    create(Drawer, injector);
    expect(document.classes.has('thaikana-modal-open')).toBe(true);
    expect(document.documentElement.style.top).toBe('-120px');
    lock.release();
    expect(document.classes.has('thaikana-modal-open')).toBe(true);
    lock.release();
    expect(document.classes.has('thaikana-modal-open')).toBe(false);
    expect(document.documentElement.style.top).toBe('');
  });
});

describe('F01 StateMessage (loading / empty / error-retry / denied / conflict)', () => {
  const state = () => create(StateMessage);
  it('keeps the legacy string inputs working: retry only when the page opts in', () => {
    const s = state();
    setInput(s.loading, true);
    expect(s.busy()).toBe(true);
    setInput(s.error, 'โหลดไม่ได้');
    expect(s.problem()).toMatchObject({ status: 'error', message: 'โหลดไม่ได้', traceId: '' });
    expect(s.canRetry()).toBe(false);
    setInput(s.retryable, true);
    setInput(s.traceId, '0HN7:00000001');
    expect(s.canRetry()).toBe(true);
    expect(s.retryLabel()).toBe('ลองอีกครั้ง');
    expect(s.problem()!.traceId).toBe('0HN7:00000001');
  });
  it('renders a typed loading and empty state', () => {
    const s = state();
    setInput(s.view, { status: 'loading' });
    expect([s.busy(), s.problem(), s.empty()]).toEqual([true, null, '']);
    setInput(s.emptyText, 'ยังไม่มีรอบผลิต');
    setInput(s.view, readyView([], true));
    expect([s.busy(), s.empty()]).toEqual([false, 'ยังไม่มีรอบผลิต']);
    setInput(s.view, readyView([1]));
    expect(s.empty()).toBe('');
  });
  it('offers retry for network/server errors, none for denied, and reload-latest for conflicts', () => {
    const s = state();
    setInput(s.view, problemView(http(503, { traceId: 'trace-503' })));
    expect([s.problem()!.status, s.canRetry(), s.retryLabel(), s.problem()!.traceId]).toEqual(['error', true, 'ลองอีกครั้ง', 'trace-503']);
    setInput(s.view, problemView(http(403, { code: 'forbidden', traceId: 'trace-403' })));
    expect([s.problem()!.status, s.canRetry(), s.problem()!.message]).toEqual(['denied', false, 'ไม่มีสิทธิ์ในรายการนี้']);
    setInput(s.view, problemView(http(409, { code: 'stale_version' })));
    expect([s.problem()!.status, s.canRetry(), s.retryLabel()]).toEqual(['conflict', true, 'โหลดข้อมูลล่าสุด']);
    expect(s.problem()!.message).toContain('โหลดข้อมูลล่าสุด');
    setInput(s.view, problemView(http(404, { title: 'Not found' })));
    expect(s.canRetry()).toBe(false);
  });
  it('announces loading politely and problems assertively, with a typed button and the trace reference', () => {
    const elements = templateElements(inlineTemplate(StateMessage));
    expect(elements.find((e) => e.attrs['class'] === 'loading-state')!.attrs['role']).toBe('status');
    const alert = elements.find((e) => e.attrs['role'] === 'alert')!;
    expect(alert.inputs).toEqual(expect.arrayContaining(['error', 'warning', 'data-state']));
    expect(elements.find((e) => e.name === 'button')!.attrs['type']).toBe('button');
    expect(elements.find((e) => e.name === 'app-trace-ref')!.inputs).toEqual(['traceId']);
    expect(elements.find((e) => e.attrs['class'] === 'empty')!.attrs['role']).toBe('status');
  });
});

describe('F01 ProblemDetails traceId reference', () => {
  it('copies the trace id and confirms it to screen readers', async () => {
    const writeText = vi.fn(async () => undefined);
    const ref = create(TraceReference, createInjector([], fakeDocument({ writeText })));
    setInput(ref.traceId, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    await ref.copy();
    expect(writeText).toHaveBeenCalledWith('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect([ref.result(), ref.statusText()]).toEqual(['done', 'คัดลอกรหัสอ้างอิงแล้ว']);
    // A new error starts without the previous "copied" confirmation.
    setInput(ref.traceId, 'next-trace');
    expect(ref.result()).toBe('');
  });
  it('explains manual copy when the clipboard is unavailable or rejected', async () => {
    const plain = create(TraceReference, createInjector([], fakeDocument()));
    setInput(plain.traceId, 'trace-1');
    await plain.copy();
    expect([plain.result(), plain.statusText()]).toEqual(['failed', 'คัดลอกไม่ได้ · เลือกรหัสแล้วคัดลอกเอง']);
    const rejected = create(TraceReference, createInjector([], fakeDocument({ writeText: () => Promise.reject(new Error('denied')) })));
    setInput(rejected.traceId, 'trace-2');
    await rejected.copy();
    expect(rejected.result()).toBe('failed');
  });
  it('renders nothing without an id and labels the copy button with the id', async () => {
    const writeText = vi.fn(async () => undefined);
    const ref = create(TraceReference, createInjector([], fakeDocument({ writeText })));
    await ref.copy();
    expect(writeText).not.toHaveBeenCalled();
    const template = inlineTemplate(TraceReference);
    expect(template.trim().startsWith('@if (traceId())')).toBe(true);
    const elements = templateElements(template);
    expect(elements.find((e) => e.name === 'code')!.text).toContain('traceId()');
    expect(elements.find((e) => e.name === 'span' && e.text.startsWith('รหัสอ้างอิง'))).toBeTruthy();
    const button = elements.find((e) => e.name === 'button')!;
    expect(button.attrs['type']).toBe('button');
    expect(button.inputs).toContain('aria-label');
    expect(elements.find((e) => e.attrs['role'] === 'status')!.attrs['class']).toBe('sr-only');
  });
});

describe('F01 ScanInput', () => {
  it('submits the trimmed scan once and ignores blank or disabled scans', () => {
    const scan = create(ScanInput);
    const submitted = vi.fn();
    scan.submit.subscribe(submitted);
    scan.value.set('   ');
    scan.scan();
    scan.value.set('  WO-2026-0042\t');
    scan.scan();
    setInput(scan.disabled, true);
    scan.scan();
    expect(submitted.mock.calls).toEqual([['WO-2026-0042']]);
  });
  it('works from a keyboard-wedge scanner (Enter) with a labelled field and a typed button', () => {
    const elements = templateElements(inlineTemplate(ScanInput));
    const input = elements.find((e) => e.name === 'input')!;
    expect(input.outputs).toEqual(expect.arrayContaining(['keyup.enter', 'input']));
    expect(input.inputs).toEqual(expect.arrayContaining(['aria-label', 'disabled']));
    expect(input.attrs['autocomplete']).toBe('off');
    expect(elements.find((e) => e.name === 'button')!.attrs['type']).toBe('button');
  });
});

describe('F01 DataTable', () => {
  const table = () => create(DataTable);
  it('formats cells without leaking objects and keeps unknown numbers empty', () => {
    const t = table();
    expect([t.text(null), t.text(undefined), t.text(['A', 'B']), t.text({ secret: 1 }), t.text(12)]).toEqual(['—', '—', 'A · B', '', '12']);
    expect([t.dateValue(''), t.dateValue('not-a-date'), t.dateValue('2026-11-03T00:00:00Z')]).toEqual([null, null, '2026-11-03T00:00:00.000Z']);
    expect([t.number('12.5'), t.number('x'), t.number(null)]).toEqual([12.5, 0, 0]);
  });
  it.each<[DataColumn, boolean]>([
    [{ key: 'total', label: 'ยอด', money: true }, true], [{ key: 'plannedQuantity', label: 'จำนวน' }, true],
    [{ key: 'goodQty', label: 'ดี' }, true], [{ key: 'lineCount', label: 'รายการ' }, true],
    [{ key: 'activeMinutes', label: 'นาที' }, true], [{ key: 'customerName', label: 'ลูกค้า' }, false],
  ])('right-aligns numeric column %o = %s', (column, numeric) => expect(table().numeric(column)).toBe(numeric));
  it('exposes busy state, scoped headers, a keyboard-scrollable region and an empty state only after loading', () => {
    const elements = templateElements(inlineTemplate(DataTable));
    const region = elements.find((e) => e.attrs['role'] === 'region')!;
    expect(region.attrs).toMatchObject({ tabindex: '0', 'aria-label': 'ตารางรายการ' });
    expect(elements.find((e) => e.name === 'table')!.inputs).toContain('aria-busy');
    expect(elements.filter((e) => e.name === 'th').every((e) => e.attrs['scope'] === 'col')).toBe(true);
    const rowAction = elements.find((e) => e.attrs['class'] === 'row-action')!;
    expect(rowAction.attrs['type']).toBe('button');
    expect(rowAction.inputs).toContain('disabled');
    expect(elements.find((e) => e.attrs['class'] === 'empty')!.text).toContain('ไม่พบรายการ');
    expect(inlineTemplate(DataTable)).toMatch(/@empty \{\s*@if \(!loading\(\)\)/);
  });
  it('emits the selected row', () => {
    const t = table();
    const selected = vi.fn();
    t.selected.subscribe(selected);
    t.selected.emit({ id: 'q-1' });
    expect(selected).toHaveBeenCalledWith({ id: 'q-1' });
  });
});

describe('F01 FilterBar', () => {
  it('keeps query/status as two-way models and applies on status change, Enter and the button', () => {
    const bar = create(FilterBar);
    bar.query.set('ACME');
    bar.status.set('Draft');
    expect([bar.query(), bar.status()]).toEqual(['ACME', 'Draft']);
    const elements = templateElements(inlineTemplate(FilterBar));
    const search = elements.find((e) => e.name === 'input')!;
    expect(search.attrs['type']).toBe('search');
    expect(search.outputs).toEqual(expect.arrayContaining(['keyup.enter', 'ngModelChange']));
    expect(elements.find((e) => e.name === 'select')!.outputs).toContain('ngModelChange');
    expect(inlineTemplate(FilterBar)).toContain('(ngModelChange)="status.set($event); applied.emit()"');
    expect(elements.find((e) => e.name === 'button')!).toMatchObject({ attrs: { type: 'button' }, outputs: ['click'] });
    // The filter catalogue is fixed by the page, not rebuilt from filtered results; "ทั้งหมด" is always offered.
    expect(elements.find((e) => e.name === 'option' && e.attrs['value'] === '')!.text).toBe('ทั้งหมด');
    expect(elements.filter((e) => e.name === 'label').every((e) => e.text.length > 0)).toBe(true);
  });
});
