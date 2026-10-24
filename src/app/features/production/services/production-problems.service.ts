import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ApiClient,
  OfflineTransactionError,
  problemMessage,
} from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { NativeApi } from '../../modules/native-api.service';

export type ProblemWorkspace = components['schemas']['ProblemWorkspace'];
export type ProblemDetail = components['schemas']['ProblemDetail'];
export type ProblemOperation = components['schemas']['ProblemOperation'];
export type ProblemRow = components['schemas']['ProblemRow'];
export type ProblemMutation = components['schemas']['ProblemMutation'];
@Injectable({ providedIn: 'root' })
export class ProductionProblemsApi {
  private native = inject(NativeApi);
  private http = inject(HttpClient);
  list(query: Record<string, string | number>) {
    return this.native.get<ProblemWorkspace>('/production/problems', query);
  }
  detail(id: string) {
    return this.native.get<ProblemDetail>('/production/problems/' + id);
  }
  operation(id: string) {
    return this.native.get<ProblemOperation>('/production/operations/' + id + '/problem-context');
  }
  file(id: string) {
    return this.native.file(id);
  }
  upload(path: string, body: unknown, files: readonly File[], key: string) {
    if (navigator.onLine === false)
      return Promise.reject<ProblemMutation>(new OfflineTransactionError());
    const form = new FormData();
    form.append('data', JSON.stringify(body));
    for (const file of files) form.append('evidence', file, file.name);
    return firstValueFrom(
      this.http.post<ProblemMutation>(environment.apiUrl + path, form, {
        withCredentials: true,
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      }),
    );
  }
}
/** Form-local receipt: retries keep the original proof, payload, files and key. */
@Injectable()
export class ProblemCommand {
  private api = inject(ApiClient);
  private problems = inject(ProductionProblemsApi);
  busy = signal(false);
  uncertain = signal(false);
  error = signal('');
  code = signal('');
  private pending?: {
    send: () => Promise<unknown>;
    done: (result: unknown) => Promise<void>;
    confirmed?: boolean;
    result?: unknown;
  };
  clear() {
    if (!this.busy() && !this.uncertain()) {
      this.error.set('');
      this.code.set('');
    }
  }
  async run(
    path: string,
    body: unknown,
    files: readonly File[],
    done: (result: unknown) => Promise<void>,
  ) {
    if (this.pending || this.busy()) return;
    const key = crypto.randomUUID(),
      snapshot = structuredClone(body),
      attachments = [...files];
    this.pending = {
      send: () =>
        attachments.length
          ? this.problems.upload(path, snapshot, attachments, key)
          : this.api.post(path, snapshot, key),
      done,
    };
    await this.retry();
  }
  async retry() {
    const p = this.pending;
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.code.set('');
    try {
      if (!p.confirmed) {
        p.result = await p.send();
        p.confirmed = true;
      }
      await p.done(p.result);
      this.pending = undefined;
      this.uncertain.set(false);
    } catch (e) {
      const unknown =
        !!p.confirmed ||
        (e instanceof OfflineTransactionError && this.uncertain()) ||
        (e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500));
      this.uncertain.set(unknown);
      if (!unknown) this.pending = undefined;
      if (e instanceof HttpErrorResponse) this.code.set(e.error?.code ?? '');
      this.error.set(
        (p.confirmed ? 'บันทึกสำเร็จแล้ว แต่โหลดผลไม่ได้ · ' : '') + problemMessage(e),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
