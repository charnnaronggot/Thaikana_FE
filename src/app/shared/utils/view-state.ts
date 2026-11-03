import { HttpErrorResponse } from '@angular/common/http';
import { problemMessage, problemTraceId } from '../../core/services/api/api-client.service';
/**
 * Typed screen state: a page is in exactly one state, so data from a previous resource never shows next to
 * a new error and a 403/409 is never presented as a generic retryable failure.
 * `loading.previous` keeps the last data visible while the same resource reloads (filter/page changes).
 */
export type ViewState<T> =
  | { status: 'idle' }
  | { status: 'loading'; previous?: T }
  | { status: 'ready'; data: T }
  | { status: 'empty'; data: T }
  | { status: 'error'; message: string; code: string; traceId: string; retryable: boolean }
  | { status: 'denied'; message: string; code: string; traceId: string }
  | { status: 'conflict'; message: string; code: string; traceId: string };
export type ViewProblem = Extract<ViewState<unknown>, { message: string }>;
export const idleView = <T>(): ViewState<T> => ({ status: 'idle' });
/** Pass the current state to keep its data while reloading; pass nothing when switching to another resource. */
export function loadingView<T>(current?: ViewState<T>): ViewState<T> { const previous = current ? viewData(current) : undefined; return previous === undefined ? { status: 'loading' } : { status: 'loading', previous }; }
export function readyView<T>(data: T, isEmpty = false): ViewState<T> { return isEmpty ? { status: 'empty', data } : { status: 'ready', data }; }
/** 403 = denied (no retry), 409 = conflict (reload latest), 401/400/404/422 are not retried; network/5xx/429 are. */
export function problemView(error: unknown): ViewProblem {
  const message = problemMessage(error), traceId = problemTraceId(error);
  if (!(error instanceof HttpErrorResponse)) return { status: 'error', message, code: '', traceId, retryable: true };
  const code = typeof error.error?.code === 'string' ? error.error.code : '';
  if (error.status === 403) return { status: 'denied', message, code, traceId };
  if (error.status === 409) return { status: 'conflict', message, code, traceId };
  return { status: 'error', message, code, traceId, retryable: error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500 };
}
export function viewData<T>(state: ViewState<T>): T | undefined { return state.status === 'ready' || state.status === 'empty' ? state.data : state.status === 'loading' ? state.previous : undefined; }
export function viewProblem<T>(state: ViewState<T>): ViewProblem | null { return state.status === 'error' || state.status === 'denied' || state.status === 'conflict' ? state : null; }
export const isViewLoading = <T>(state: ViewState<T>) => state.status === 'loading';
