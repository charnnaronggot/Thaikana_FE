import { CommonModule } from '@angular/common';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { NativeApi } from '../../modules/native-api.service';

type Workspace = components['schemas']['WorkOrderDocumentWorkspace'];
type DocumentRow = components['schemas']['WorkOrderDocumentRow'];
@Component({
  selector: 'app-work-order-documents', imports: [CommonModule, StateMessage], providers: [MutationSession],
  templateUrl: './work-order-documents.component.html', styleUrl: './work-order-documents.component.scss',
})
export class WorkOrderDocuments {
  workOrderId = input.required<string>();
  readonly command = inject(MutationSession);
  private api = inject(NativeApi);
  data = signal<Workspace | null>(null); loading = signal(false); error = signal(''); notice = signal(''); downloading = signal<string | null>(null);
  page = 1; private generation = 0; private destroyed = false;
  constructor() {
    effect(() => { this.workOrderId(); this.page = 1; this.data.set(null); void this.load(); });
    inject(DestroyRef).onDestroy(() => { this.destroyed = true; ++this.generation; });
  }
  num(value: number | string | null | undefined) { return Number(value ?? 0); }
  canLeave() { return !this.command.busy() && !this.command.uncertain() && !this.downloading(); }
  status(value: string | undefined) { return ({ PENDING: 'รอสร้าง', PROCESSING: 'กำลังสร้าง', COMPLETED: 'พร้อมดาวน์โหลด', FAILED: 'สร้างไม่สำเร็จ' } as Record<string, string>)[value ?? ''] ?? value; }
  blocker(value: string | null | undefined) {
    return value === 'released_work_order_required' ? 'Planner ต้อง Release ใบงานก่อนออกเอกสาร' : 'Planner / Supervisor เป็นผู้ออกเอกสาร ส่วนผู้ทำงานเปิดอ่านได้ตามสิทธิ์';
  }
  async load() {
    const id = this.workOrderId(), generation = ++this.generation;
    this.loading.set(true); this.error.set('');
    try { const data = await this.api.get<Workspace>('/work-orders/' + id + '/documents', { page: this.page }); if (generation === this.generation && !this.destroyed) this.data.set(data); }
    catch (e) { if (generation === this.generation && !this.destroyed) this.error.set(problemMessage(e)); }
    finally { if (generation === this.generation && !this.destroyed) this.loading.set(false); }
  }
  paginate(delta: number) { if (this.loading() || !this.canLeave()) return; this.page += delta; void this.load(); }
  async request(output?: DocumentRow) {
    const data = this.data(); if (!data?.canRequest || !this.canLeave() || this.loading()) return;
    this.notice.set('');
    const body = { expectedVersion: data.version } satisfies components['schemas']['RequestWorkOrderDocument'];
    const path = '/work-orders/' + this.workOrderId() + '/documents' + (output ? '/' + output.id + '/retry' : '');
    await this.command.run<components['schemas']['WorkOrderDocumentMutation']>(path, body, async () => {
      this.page = 1; this.notice.set(output ? 'ส่งสร้าง PDF จากคำขอเดิมแล้ว' : 'รับคำขอใบงานแล้ว · กดรีเฟรชเพื่อตรวจผล'); await this.load();
    });
  }
  async reloadConflict() { if (!this.canLeave()) return; this.command.clear(); await this.load(); }
  async download(row: DocumentRow) {
    if (!row.fileId || row.superseded || !this.canLeave()) return;
    this.downloading.set(row.id ?? ''); this.error.set('');
    try {
      const blob = await this.api.file(row.fileId);
      if (this.destroyed) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url;
      anchor.download = row.filename ?? 'work-order.pdf'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (!this.destroyed) this.error.set(problemMessage(e)); }
    finally { if (!this.destroyed) this.downloading.set(null); }
  }
}
