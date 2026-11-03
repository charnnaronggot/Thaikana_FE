import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient, OfflineTransactionError } from '../../../core/services/api/api-client.service';
import { FinanceApi, financeError, normalizeEvidence } from './finance-api.service';

type FileStamp = { name: string; mime: string; bytes: number; sha256: string };
export type FinancePending = {
  actor: string;
  kind: string;
  path: string;
  key: string;
  body: unknown;
  files: FileStamp[];
  label: string;
  documentId?: string;
};
/** Pending receipt recovery in the same tab. No credentials or file bytes are
 * persisted, and no transactional request is sent automatically while offline. */
@Injectable({ providedIn: 'root' })
export class FinanceCommands {
  private auth = inject(AuthService);
  private api = inject(ApiClient);
  private finance = inject(FinanceApi);
  pending = signal<FinancePending | null>(null);
  busy = signal(false);
  uncertain = signal(false);
  error = signal('');
  code = signal('');
  private files: File[] = [];
  private fileKey = '';
  private confirmedKey = '';
  private listener?: {
    owner: object;
    actor: string;
    done: (result: unknown, pending: FinancePending) => Promise<void>;
  };
  private storage(actor: string) {
    return 'thaikana.finance.pending.' + actor;
  }
  private known(kind: string, path: string) {
    const id = '[a-fA-F0-9-]{36}';
    const patterns: Record<string, string> = {
      'finance.document_request': `^/finance/documents/(invoice|billing|receipt|adjustment)/${id}$`,
      'finance.document_retry': `^/finance/documents/${id}/retry$`,
      'finance.invoice_create': `^/finance/invoices$`,
      'finance.invoice_edit': `^/finance/invoices/${id}/draft$`,
      'finance.invoice_issue': `^/finance/invoices/${id}/issue$`,
      'finance.invoice_cancel': `^/finance/invoices/${id}/cancel$`,
      'finance.billing_create': `^/finance/billings$`,
      'finance.billing_refresh': `^/finance/billings/${id}/refresh$`,
      'finance.billing_issue': `^/finance/billings/${id}/issue$`,
      'finance.billing_cancel_draft': `^/finance/billings/${id}/cancel-draft$`,
      'finance.billing_cancel': `^/finance/billings/${id}/cancel$`,
      'finance.payment_create': `^/finance/payments$`,
      'finance.payment_edit': `^/finance/payments/${id}/draft$`,
      'finance.payment_evidence': `^/finance/payments/${id}/evidence$`,
      'finance.payment_confirm': `^/finance/payments/${id}/confirm$`,
      'finance.payment_allocate': `^/finance/payments/${id}/allocate$`,
      'finance.payment_reverse': `^/finance/payments/${id}/reverse$`,
      'finance.payment_cancel': `^/finance/payments/${id}/cancel$`,
      'finance.adjustment_create': `^/finance/adjustments$`,
      'finance.adjustment_edit': `^/finance/adjustments/${id}/draft$`,
      'finance.adjustment_issue': `^/finance/adjustments/${id}/issue$`,
      'finance.adjustment_reverse': `^/finance/adjustments/${id}/reverse$`,
      'finance.adjustment_cancel': `^/finance/adjustments/${id}/cancel$`,
    };
    return !!patterns[kind] && new RegExp(patterns[kind]).test(path);
  }
  attach(owner: object, done: (result: unknown, pending: FinancePending) => Promise<void>) {
    const actor = this.auth.user()?.id;
    if (!actor) return;
    this.listener = { owner, actor, done };
    this.error.set('');
    this.code.set('');
    this.pending.set(null);
    this.uncertain.set(false);
    this.confirmedKey = '';
    try {
      const raw = sessionStorage.getItem(this.storage(actor));
      const p = raw ? (JSON.parse(raw) as FinancePending) : null;
      if (
        p &&
        (p.actor !== actor ||
          !this.known(p.kind, p.path) ||
          typeof p.key !== 'string' ||
          p.key.length > 128 ||
          !Array.isArray(p.files))
      )
        throw Error('ข้อมูลคำสั่งค้างไม่ถูกต้อง กรุณาให้ผู้ดูแลตรวจสอบก่อนทำรายการใหม่');
      this.pending.set(p);
      this.uncertain.set(!!p);
      if (p && p.key !== this.fileKey) this.files = [];
      if (p) void this.check();
    } catch (e) {
      this.error.set(financeError(e));
      this.uncertain.set(true);
    }
  }
  detach(owner: object) {
    if (this.listener?.owner === owner) this.listener = undefined;
  }
  needsFiles() {
    return !!this.pending()?.files.length && this.files.length === 0;
  }
  private async stamps(files: readonly File[]) {
    return (
      await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          mime: file.type,
          bytes: file.size,
          sha256: Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
          )
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase(),
        })),
      )
    ).sort((a, b) =>
      a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : a.sha256 < b.sha256
            ? -1
            : a.sha256 > b.sha256
              ? 1
              : 0,
    );
  }
  async reselect(files: File[]) {
    if (this.busy()) return;
    const p = this.pending();
    if (!p) return;
    this.busy.set(true);
    try {
      const normalized = files.map(normalizeEvidence);
      if (JSON.stringify(await this.stamps(normalized)) !== JSON.stringify(p.files))
        throw Error('เลือกไฟล์เดิมให้ครบ ชื่อ ชนิด และเนื้อหาต้องตรงกับคำสั่งที่รอผล');
      this.files = normalized;
      this.fileKey = p.key;
      this.error.set('เลือกไฟล์เดิมครบแล้ว ตรวจผลหรือลองคำสั่งเดิมได้');
    } catch (e) {
      this.error.set(financeError(e));
    } finally {
      this.busy.set(false);
    }
  }
  async run(
    kind: string,
    path: string,
    body: unknown,
    files: readonly File[],
    label: string,
    documentId?: string,
  ) {
    if (this.busy() || this.pending() || this.uncertain()) return;
    const actor = this.auth.user()?.id;
    if (!actor) return;
    if (navigator.onLine === false) {
      this.error.set('กรุณาออนไลน์ก่อนบันทึก ไม่สามารถส่งรายการออฟไลน์ได้');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.code.set('');
    this.confirmedKey = '';
    let active: FinancePending | undefined;
    try {
      if (!this.known(kind, path)) throw Error('ไม่รองรับคำสั่งนี้');
      const normalized = files.map(normalizeEvidence);
      const p: FinancePending = {
        actor,
        kind,
        path,
        key: crypto.randomUUID(),
        body: structuredClone(body),
        files: await this.stamps(normalized),
        label,
        documentId,
      };
      // Save the key/payload before sending. A tab reload never invents another key.
      if (this.auth.user()?.id !== actor)
        throw Error('บัญชีเปลี่ยนแล้ว กรุณาตรวจข้อมูลก่อนบันทึกอีกครั้ง');
      try {
        sessionStorage.setItem(this.storage(actor), JSON.stringify(p));
      } catch {
        throw Error(
          'เบราว์เซอร์เก็บสถานะการบันทึกไม่ได้ กรุณาอนุญาตการเก็บข้อมูลเว็บไซต์ก่อนทำรายการ',
        );
      }
      active = p;
      this.pending.set(p);
      this.files = normalized;
      this.fileKey = p.key;
      await this.send(p);
    } catch (e) {
      this.failed(e, false, active, actor);
    } finally {
      this.busy.set(false);
    }
  }
  private async send(p: FinancePending) {
    if (this.auth.user()?.id !== p.actor) throw Error('เข้าระบบด้วยบัญชีเดิมเพื่อตรวจคำสั่งนี้');
    if (p.files.length && !this.files.length)
      throw Error('เลือกไฟล์เดิมก่อนลองคำสั่งเดิม หรือกดตรวจผลเพื่ออ่านรายการที่บันทึกแล้ว');
    const result = p.files.length
      ? await this.finance.upload(p.path, p.body, this.files, p.key)
      : await this.api.post(p.path, p.body, p.key);
    this.confirmedKey = p.key;
    await this.finish(result, p);
  }
  private async finish(result: unknown, p: FinancePending) {
    if (this.auth.user()?.id !== p.actor) return;
    const listener = this.listener;
    if (!listener || listener.actor !== p.actor) {
      this.uncertain.set(true);
      return;
    }
    await listener.done(result, p);
    if (this.auth.user()?.id !== p.actor || this.pending()?.key !== p.key) return;
    sessionStorage.removeItem(this.storage(p.actor));
    this.pending.set(null);
    this.files = [];
    this.fileKey = '';
    this.uncertain.set(false);
    this.error.set('');
    this.code.set('');
    this.confirmedKey = '';
  }
  private failed(e: unknown, wasUncertain: boolean, command?: FinancePending, actor?: string) {
    if (actor && this.auth.user()?.id !== actor) return;
    const p = command ?? this.pending();
    if (
      p &&
      (this.auth.user()?.id !== p.actor || (this.pending() && this.pending()?.key !== p.key))
    )
      return;
    const confirmed = !!p && this.confirmedKey === p.key;
    const code = e instanceof HttpErrorResponse ? (e.error?.code ?? '') : '';
    const unknown =
      confirmed ||
      ['command_in_progress', 'idempotency_mismatch'].includes(code) ||
      (e instanceof HttpErrorResponse &&
        (e.status === 0 ||
          e.status >= 500 ||
          (wasUncertain && (e.status === 401 || e.status === 403)))) ||
      (e instanceof OfflineTransactionError && wasUncertain);
    this.code.set(code);
    this.uncertain.set(unknown);
    this.error.set((confirmed ? 'บันทึกแล้ว แต่โหลดรายละเอียดไม่ได้ · ' : '') + financeError(e));
    if (!unknown && p) {
      sessionStorage.removeItem(this.storage(p.actor));
      this.pending.set(null);
      this.files = [];
      this.fileKey = '';
    }
  }
  async retry() {
    const p = this.pending();
    if (!p || this.busy()) return;
    if (this.needsFiles()) {
      this.error.set('เลือกไฟล์เดิมให้ครบก่อนส่งคำสั่งเดิม หรือตรวจผลเพื่ออ่านรายการที่สำเร็จแล้ว');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.send(p);
    } catch (e) {
      this.failed(e, true, p, p.actor);
    } finally {
      this.busy.set(false);
    }
  }
  async check() {
    const p = this.pending();
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const state = await this.finance.state(p.kind, p.key);
      if (this.auth.user()?.id !== p.actor || this.pending()?.key !== p.key) return;
      if (state.completed && state.result) {
        this.confirmedKey = p.key;
        await this.finish(state.result, p);
      } else {
        this.uncertain.set(true);
        this.error.set('ยังไม่พบผลสำเร็จ ต้องลองด้วยข้อมูลและคำสั่งเดิม ไม่สร้างรายการใหม่');
      }
    } catch (e) {
      if (this.auth.user()?.id === p.actor && this.pending()?.key === p.key) {
        this.uncertain.set(true);
        this.error.set(financeError(e));
      }
    } finally {
      this.busy.set(false);
    }
  }
  clearError() {
    if (!this.busy() && !this.pending()) {
      this.error.set('');
      this.code.set('');
    }
  }
}
