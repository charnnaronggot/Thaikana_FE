import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { create, createInjector } from './support/angular';
import { ApiClient, OfflineTransactionError, problemTraceId } from '../src/app/core/services/api/api-client.service';
import { MutationSession } from '../src/app/shared/utils/mutation-session';
import { idleView, isViewLoading, loadingView, problemView, readyView, viewData, viewProblem, ViewState } from '../src/app/shared/utils/view-state';

const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('F01 typed ViewState', () => {
  it('moves idle → loading → ready/empty and keeps the previous data only while reloading the same resource', () => {
    let state: ViewState<string[]> = idleView();
    expect([state.status, viewData(state), isViewLoading(state)]).toEqual(['idle', undefined, false]);
    state = loadingView(state);
    expect(state).toEqual({ status: 'loading' });
    state = readyView(['A']);
    expect(viewData(state)).toEqual(['A']);
    state = loadingView(state);
    expect([state.status, viewData(state), isViewLoading(state)]).toEqual(['loading', ['A'], true]);
    // Opening another resource starts without the previous record.
    expect(viewData(loadingView<string[]>())).toBeUndefined();
    state = readyView([], true);
    expect([state.status, viewData(state)]).toEqual(['empty', []]);
  });
  it('never carries data into an error, so a failed load cannot show the previous resource', () => {
    const failed: ViewState<string[]> = problemView(http(500, { traceId: 't-1' }));
    expect(viewData(failed)).toBeUndefined();
    expect(viewData(loadingView(failed))).toBeUndefined();
    expect(viewProblem(readyView(['A']))).toBeNull();
    expect(viewProblem(failed)).toMatchObject({ status: 'error', retryable: true, traceId: 't-1' });
  });
  it.each([
    [0, 'error', true], [408, 'error', true], [429, 'error', true], [500, 'error', true], [503, 'error', true],
    [400, 'error', false], [401, 'error', false], [404, 'error', false], [422, 'error', false],
    [403, 'denied', undefined], [409, 'conflict', undefined],
  ])('HTTP %i → %s (retryable %s)', (status, kind, retryable) => {
    const view = problemView(http(status, { code: 'x_code', traceId: 'trace-' + status }));
    expect(view.status).toBe(kind);
    expect(view.code).toBe('x_code');
    if (view.status === 'error') expect(view.retryable).toBe(retryable);
    if (status !== 0) expect(view.traceId).toBe('trace-' + status);
  });
  it('uses the shared Thai ProblemDetails messages', () => {
    expect(problemView(http(409, { code: 'stale_version' })).message).toBe('ข้อมูลบัญชีหรือเอกสารเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
    expect(problemView(http(403)).message).toBe('ไม่มีสิทธิ์ในรายการนี้');
    expect(problemView(new OfflineTransactionError())).toEqual({ status: 'error', message: 'ไม่มีการเชื่อมต่อ กรุณาออนไลน์ก่อนทำรายการ', code: '', traceId: '', retryable: true });
  });
});

describe('F01 problemTraceId', () => {
  it('reads the ProblemDetails traceId of ASP.NET and W3C formats', () => {
    expect(problemTraceId(http(500, { traceId: '0HN7GLL2O3V5Q:00000004' }))).toBe('0HN7GLL2O3V5Q:00000004');
    expect(problemTraceId(http(409, { code: 'stale_version', traceId: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01' }))).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });
  it('shows nothing that is not a short opaque id', () => {
    for (const error of [
      http(500, '<html>stack trace</html>'), http(500, { traceId: 'x'.repeat(129) }), http(500, { traceId: 'a b<script>' }),
      http(500, { traceId: 42 }), http(0), new Error('boom'), null,
    ])
      expect(problemTraceId(error)).toBe('');
  });
});

describe('F01 MutationSession', () => {
  const session = (post: ReturnType<typeof vi.fn>) => create(MutationSession, createInjector([{ provide: ApiClient, useValue: { post } }]));
  it('keeps code, field errors and traceId of a rejected command and clears them for the next attempt', async () => {
    const post = vi.fn().mockRejectedValueOnce(http(409, { code: 'stale_version', traceId: 'trace-stale', errors: { Reason: ['สั้นไป'] } }));
    const s = session(post);
    await s.run('/users/u1/status', { expectedVersion: 3 }, vi.fn());
    expect([s.problemCode(), s.traceId(), s.uncertain(), s.busy()]).toEqual(['stale_version', 'trace-stale', false, false]);
    expect(s.fieldErrors()).toEqual({ Reason: ['สั้นไป'] });
    s.clear();
    expect([s.error(), s.problemCode(), s.traceId()]).toEqual(['', '', '']);
  });
  it('replays an unknown result with the same Idempotency-Key and payload, then clears the trace', async () => {
    const done = vi.fn();
    const post = vi.fn().mockRejectedValueOnce(http(503, { traceId: 'trace-503' })).mockResolvedValueOnce({ id: 'ok' });
    const s = session(post);
    const body = { expectedVersion: 7, reason: 'ทดสอบ' };
    await s.run('/users/u1/unlock', body, done);
    body.reason = 'changed after submit';
    expect([s.uncertain(), s.traceId()]).toEqual([true, 'trace-503']);
    // While uncertain the form cannot discard the command.
    s.clear();
    expect(s.error()).not.toBe('');
    await s.run('/users/u1/other', { different: true }, vi.fn());
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
    expect(post.mock.calls[0][1]).toEqual({ expectedVersion: 7, reason: 'ทดสอบ' });
    expect(done).toHaveBeenCalledWith({ id: 'ok' });
    expect([s.uncertain(), s.error(), s.traceId()]).toEqual([false, '', '']);
  });
  it('does not post again when the commit succeeded but the follow-up read failed', async () => {
    const post = vi.fn().mockResolvedValue({ id: 'ok' });
    const done = vi.fn().mockRejectedValueOnce(http(500, { traceId: 'trace-read' })).mockResolvedValueOnce(undefined);
    const s = session(post);
    await s.run('/x', {}, done);
    expect([s.uncertain(), s.traceId()]).toEqual([true, 'trace-read']);
    expect(s.error()).toMatch(/^บันทึกสำเร็จแล้ว แต่โหลดผลไม่ได้/);
    await s.retry();
    expect(post).toHaveBeenCalledOnce();
    expect(done).toHaveBeenCalledTimes(2);
    expect(s.uncertain()).toBe(false);
  });
  it('ignores a second submit while busy', async () => {
    let resolve!: (value: unknown) => void;
    const post = vi.fn(() => new Promise((r) => (resolve = r)));
    const s = session(post);
    const first = s.run('/x', {}, vi.fn());
    await s.run('/x', {}, vi.fn());
    resolve({});
    await first;
    expect(post).toHaveBeenCalledOnce();
  });
});
