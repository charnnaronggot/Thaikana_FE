import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import {
  QualityApi,
  QualityDetail,
  QualitySlot,
  QualityMutation,
  QualityLifecycle,
} from '../services/quality-api.service';
import { PhotoUploadSession } from '../services/photo-upload-session';
import { PrivatePhotoThumb } from '../components/private-photo-thumb.component';

type ResultRow = {
  code: string;
  label: string;
  required: boolean;
  observedValue: string;
  passed: boolean | null;
  defectCode: string;
};
@Component({
  imports: [CommonModule, FormsModule, RouterLink, Drawer, StateMessage, PrivatePhotoThumb],
  providers: [MutationSession, PhotoUploadSession],
  templateUrl: './quality-inspection.component.html',
  styleUrl: './quality-inspection.component.scss',
})
export class QualityInspectionPage {
  private api = inject(QualityApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly auth = inject(AuthService);
  readonly command = inject(MutationSession);
  readonly upload = inject(PhotoUploadSession);
  id = this.route.snapshot.paramMap.get('id')!;
  private destroyRef = inject(DestroyRef);
  detail = signal<QualityDetail | null>(null);
  lifecycle = signal<QualityLifecycle | null>(null);
  lifecycleDialog = signal<'cancel' | 'reverse' | null>(null);
  lifecycleReason = '';
  lifecycleError = signal('');
  busy = signal(false);
  error = signal('');
  notice = signal('');
  fields = signal<Record<string, string>>({});
  discard = signal(false);
  photoSlot = signal<QualitySlot | null>(null);
  photoFile: File | null = null;
  photoCaption = '';
  photoReason = '';
  photoLocal = signal('');
  photoError = signal('');
  private photoBaseline = '';
  decodingPhoto = signal(false);
  private fileGeneration = 0;
  preview = signal<{ url: string; label: string } | null>(null);
  previewBusy = signal(false);
  previewError = signal('');
  historySlot = signal<QualitySlot | null>(null);
  confirmFinal = signal(false);
  legacyReview = signal(false);
  legacyReason = '';
  removePhoto = signal<QualitySlot | null>(null);
  removeReason = '';
  source = signal<components['schemas']['QualityWorkOrderSource'] | null>(null);
  sourceOpen = signal(false);
  sourceBusy = signal(false);
  sourceError = signal('');
  private sourceId = '';
  conflictDraft = signal<{
    results: ResultRow[];
    accept: number;
    rework: number;
    hold: number;
    scrap: number;
    remark: string;
  } | null>(null);
  showConflictDraft = signal(false);
  results: ResultRow[] = [];
  accept = 0;
  rework = 0;
  hold = 0;
  scrap = 0;
  remark = '';
  private baseline = '';
  private pendingLeave: ((ok: boolean) => void) | null = null;
  private commandNavigation = false;
  private routeLoaded = false;
  private routeGeneration = 0;
  private approvedNavigation = false;
  private leaveDecision: Promise<boolean> | null = null;
  readonly stateLabels: Record<string, string> = {
    DRAFT: 'ร่าง',
    FINAL: 'ตรวจแล้ว',
    READY: 'พร้อม',
    WAITING: 'รอขั้นก่อน',
    IN_PROGRESS: 'กำลังทำ',
    PAUSED: 'พัก',
    COMPLETED: 'จบขั้นตอน',
    CANCELLED: 'ยกเลิก',
    REVERSED: 'ย้อนผลแล้ว',
    RELEASED: 'ปล่อยผลิต',
  };
  readonly outcomeLabels: Record<string, string> = {
    ACCEPT: 'ผ่าน',
    REWORK: 'แก้ไข',
    HOLD: 'พักรอ',
    SCRAP: 'เสีย',
  };
  num(value: number | string | null | undefined) {
    return Number(value ?? 0);
  }
  ngOnInit() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      void this.changeRoute(params.get('id'));
    });
  }
  private async changeRoute(next: string | null) {
    if (!next || this.routeLoaded && next === this.id) return;
    const generation = ++this.routeGeneration;
    if (this.routeLoaded && !this.commandNavigation && !this.approvedNavigation && !(await this.canLeave())) {
      if (generation === this.routeGeneration) await this.router.navigate(['/qc/inspections', this.id], { replaceUrl: true });
      return;
    }
    if (generation !== this.routeGeneration) return;
    this.approvedNavigation = false; this.routeLoaded = true;
    this.id = next; this.detail.set(null); this.lifecycle.set(null); this.conflictDraft.set(null);
    this.historySlot.set(null); this.photoSlot.set(null); this.sourceOpen.set(false);
    this.closePreview(); this.revokeLocal(); this.baseline = ''; this.notice.set('');
    await this.load(false);
  }
  ngOnDestroy() {
    this.fileGeneration++;
    this.revokeLocal();
    this.closePreview();
  }
  blocked() {
    return (
      this.busy() ||
      this.command.busy() ||
      this.command.uncertain() ||
      this.upload.busy() ||
      this.upload.uncertain()
    );
  }
  private snapshot() {
    return JSON.stringify([
      this.results,
      this.accept,
      this.rework,
      this.hold,
      this.scrap,
      this.remark,
    ]);
  }
  dirty() {
    return !!this.conflictDraft() || (!!this.detail() && this.snapshot() !== this.baseline);
  }
  async fetch(preserve: boolean) {
    const [detail, lifecycle] = await Promise.all([this.api.detail(this.id), this.api.lifecycle(this.id)]);
    this.lifecycle.set(lifecycle);
    if (preserve && detail.status !== 'DRAFT' && this.dirty() && !this.conflictDraft()) {
      this.conflictDraft.set({
        results: structuredClone(this.results),
        accept: this.accept,
        rework: this.rework,
        hold: this.hold,
        scrap: this.scrap,
        remark: this.remark,
      });
      this.notice.set('ผลตรวจถูกปิดหรือยืนยันจากที่อื่นแล้ว · ข้อมูลที่คุณกรอกค้างไว้ยังดูและคัดลอกได้');
    }
    this.detail.set(detail);
    if (!preserve || detail.status !== 'DRAFT') {
      this.results = detail.checklist.map((x) => {
        const r = detail.results.find((y) => y.code === x.code);
        return {
          code: x.code,
          label: x.label || x.code,
          required: x.required,
          observedValue: r?.observedValue ?? '',
          passed: r?.passed ?? null,
          defectCode: r?.defectCode ?? '',
        };
      });
      this.accept = detail.draftOutcomes
        ? this.num(detail.draftOutcomes.accept)
        : this.num(detail.quantity);
      this.rework = this.num(detail.draftOutcomes?.rework);
      this.hold = this.num(detail.draftOutcomes?.hold);
      this.scrap = this.num(detail.draftOutcomes?.scrap);
      this.remark = detail.draftOutcomes?.remark ?? '';
      this.baseline = this.snapshot();
    }
    return detail;
  }
  async load(preserve = true) {
    if (this.blocked()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.fetch(preserve);
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  beginLifecycle(action: 'cancel' | 'reverse') {
    const state = this.lifecycle();
    if (this.blocked() || !state || !(action === 'cancel' ? state.canCancelDraft : state.canReverseFinal)) return;
    this.command.clear(); this.lifecycleReason = ''; this.lifecycleError.set(''); this.lifecycleDialog.set(action);
  }
  closeLifecycle() {
    if (this.command.busy() || this.command.uncertain()) return;
    this.lifecycleDialog.set(null); this.command.clear();
  }
  async changeLifecycle() {
    const action = this.lifecycleDialog(), d = this.detail();
    if (!action || !d || this.blocked()) return;
    if (!this.lifecycleReason.trim() || this.lifecycleReason.trim().length > 2000) {
      this.lifecycleError.set('ระบุเหตุผล 1–2,000 ตัวอักษร'); return;
    }
    await this.command.run<QualityMutation>('/quality/inspections/' + this.id + '/' + action,
      { expectedVersion: d.version, reason: this.lifecycleReason.trim() }, async () => {
        await this.fetch(false); this.lifecycleDialog.set(null);
        this.notice.set(action === 'cancel' ? 'ยกเลิกร่างแล้ว · จำนวนกลับเข้าคิวตรวจ ประวัติและรูปยังอยู่' : 'ย้อนผลแล้ว · ประวัติเดิมยังอยู่ กดเริ่มตรวจใหม่เพื่อแก้ผล');
      });
  }
  async reinspect() {
    const state = this.lifecycle(), d = this.detail(); if (!state?.canReinspect || !d || this.blocked()) return;
    await this.command.run<components['schemas']['QualityInspectionCreated']>('/quality/inspections',
      { operationId: d.operationId, expectedVersion: state.operationVersion, quantity: d.quantity, correctsInspectionId: d.id },
      async (created) => {
        this.baseline = this.snapshot(); this.conflictDraft.set(null); this.commandNavigation = true;
        try { await this.router.navigate(['/qc/inspections', created.id]); await this.fetch(false); }
        finally { this.commandNavigation = false; }
      });
  }
  async openInspection(event: Event, id: string) {
    event.preventDefault(); if (this.blocked() || !(await this.canLeave())) return;
    this.approvedNavigation = true;
    await this.router.navigate(['/qc/inspections', id]);
  }
  lifecycleBlocker(code: string) {
    return ({ qc_fg_receipt_outstanding: 'ต้องย้อนรับ FG และปลดการจอง/หยิบที่เกี่ยวข้องก่อนย้อนผลตรวจ',
      qc_lifecycle_paused: 'ระบบระงับการเปลี่ยนผลตรวจชั่วคราว กรุณาติดต่อผู้ดูแล',
      qc_rework_referenced: 'มีงานแก้ไขอ้างผลตรวจนี้ กรุณาติดตามงานกับ Planner ไม่ย้อนผลต้นทางที่มีงานต่อแล้ว',
      qc_work_order_cancelled: 'WO ต้นทางถูกยกเลิกแล้ว ไม่สามารถเริ่มตรวจหรือย้อนผลได้' } as Record<string, string>)[code] ?? code;
  }
  async reloadConflict() {
    if (
      this.command.busy() ||
      this.command.uncertain() ||
      this.upload.busy() ||
      this.upload.uncertain()
    )
      return;
    this.command.clear();
    this.upload.clear();
    await this.load(true);
    this.notice.set('โหลดผลล่าสุดแล้ว · ข้อมูลที่กรอกยังอยู่ กรุณาตรวจรูปและผลตรวจอีกครั้ง');
  }
  async canLeave() {
    if (this.commandNavigation) return true;
    if (
      this.command.busy() ||
      this.command.uncertain() ||
      this.upload.busy() ||
      this.upload.uncertain()
    )
      return false;
    if (!this.dirty() && !this.photoDirty()) return true;
    if (this.leaveDecision) return this.leaveDecision;
    this.discard.set(true);
    this.leaveDecision = new Promise<boolean>((resolve) => (this.pendingLeave = resolve));
    try { return await this.leaveDecision; } finally { this.leaveDecision = null; }
  }
  confirmLeave(ok: boolean) {
    this.discard.set(false);
    if (ok) {
      this.photoSlot.set(null);
      this.photoFile = null;
      this.revokeLocal();
    }
    const pending = this.pendingLeave;
    this.pendingLeave = null;
    pending?.(ok);
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() || this.photoDirty() || this.blocked()) event.preventDefault();
  }
  async back() {
    await this.router.navigate(['/qc']);
  }
  passedChanged(row: ResultRow) {
    if (row.passed === true && !row.observedValue.trim()) row.observedValue = 'ตรงตามแบบ';
  }
  markAllPassed() {
    for (const row of this.results) {
      row.passed = true;
      if (!row.observedValue.trim()) row.observedValue = 'ตรงตามแบบ';
    }
  }
  resultPayload() {
    return this.results
      .filter((r) => r.passed !== null || !!r.observedValue.trim() || !!r.defectCode.trim())
      .map((r) => ({
        code: r.code,
        observedValue: r.observedValue.trim(),
        passed: r.passed === true,
        defectCode: r.defectCode.trim() || null,
      }));
  }
  validateResults() {
    const fields: Record<string, string> = {};
    for (const row of this.results) {
      if (row.passed !== null || row.observedValue.trim() || row.defectCode.trim()) {
        if (row.passed === null || !row.observedValue.trim())
          fields[row.code] = 'ระบุผลผ่าน/ไม่ผ่านและค่าหรือข้อสังเกต';
        if (row.observedValue.length > 2000) fields[row.code] = 'ข้อสังเกตต้องไม่เกิน2,000ตัวอักษร';
      }
    }
    this.fields.set(fields);
    return !Object.keys(fields).length;
  }
  async saveResults() {
    const d = this.detail();
    if (!d || !d.canEdit || this.blocked() || !this.validateResults()) return;
    if (
      [this.accept, this.rework, this.hold, this.scrap].some(
        (x) => !Number.isFinite(x) || x < 0 || Number(x.toFixed(6)) !== x,
      ) ||
      this.balance() < -0.0000001
    ) {
      this.fields.set({
        ...this.fields(),
        outcomes: 'จำนวนร่างต้องไม่ติดลบ และผลรวมต้องไม่เกินจำนวนตรวจ',
      });
      return;
    }
    await this.command.run<QualityMutation>(
      '/quality/inspections/' + this.id + '/results',
      {
        expectedVersion: d.version,
        results: this.resultPayload(),
        outcomes: {
          accept: this.accept,
          rework: this.rework,
          hold: this.hold,
          scrap: this.scrap,
          remark: this.remark.trim() || null,
        },
      },
      async () => {
        await this.fetch(true);
        this.baseline = this.snapshot();
        this.notice.set('บันทึกร่างผลตรวจและจำนวนแล้ว');
      },
    );
  }
  total() {
    return this.accept + this.rework + this.hold + this.scrap;
  }
  balance() {
    return this.num(this.detail()?.quantity) - this.total();
  }
  hasUnsavedResults() {
    const server = this.detail()?.results ?? [];
    return (
      this.resultPayload().some((r) => {
        const saved = server.find((x) => x.code === r.code);
        return (
          !saved ||
          saved.observedValue !== r.observedValue ||
          saved.passed !== r.passed ||
          (saved.defectCode ?? '') !== (r.defectCode ?? '')
        );
      }) || server.some((r) => !this.resultPayload().some((x) => x.code === r.code))
    );
  }
  beginFinalize() {
    const d = this.detail();
    if (!d || this.blocked() || !this.auth.has('qc.approve')) return;
    const quantities = [this.accept, this.rework, this.hold, this.scrap];
    if (
      quantities.some((x) => !Number.isFinite(x) || x < 0 || Number(x.toFixed(6)) !== x) ||
      Math.abs(this.balance()) > 0.0000001
    ) {
      this.fields.set({
        ...this.fields(),
        outcomes: 'ผลรวมต้องเท่าจำนวนตรวจ และแต่ละจำนวนต้องไม่ติดลบ',
      });
      return;
    }
    if (this.hasUnsavedResults()) {
      this.notice.set('บันทึกผล Checklist ก่อนยืนยันผลตรวจ');
      return;
    }
    if (!d.canFinalize) {
      this.notice.set('กรอกผลและแนบภาพที่บังคับให้ครบก่อนยืนยันผลตรวจ');
      return;
    }
    this.fields.set({});
    this.confirmFinal.set(true);
  }
  async finalize() {
    const d = this.detail();
    if (!d || this.blocked()) return;
    const dispositions = [
      ['ACCEPT', this.accept],
      ['REWORK', this.rework],
      ['HOLD', this.hold],
      ['SCRAP', this.scrap],
    ]
      .filter((x) => Number(x[1]) > 0)
      .map((x) => ({ code: String(x[0]), quantity: Number(x[1]), targetWorkCenterId: null }));
    await this.command.run<components['schemas']['QualityFinalized']>(
      '/quality/inspections/' + this.id + '/finalize',
      { expectedVersion: d.version, dispositions, remark: this.remark.trim() || null },
      async () => {
        await this.fetch(false);
        this.confirmFinal.set(false);
        this.notice.set(
          'ยืนยันผลแล้ว · คลังรับได้เฉพาะจำนวนผ่าน ส่วนงานแก้ให้ Planner สร้าง WO ใหม่',
        );
      },
    );
  }
  slotCurrent(slot: QualitySlot) {
    return slot.history[0] ?? null;
  }
  slotReady(slot: QualitySlot) {
    return !!this.slotCurrent(slot)?.fileId;
  }
  blocker(code: string) {
    if (code === 'legacy_qc_evidence_review_required')
      return 'ต้องตรวจทานหลักฐานเดิมและกำหนดด้านรูป';
    if (code === 'qc_results_incomplete') return 'ยังบันทึก Checklist ที่บังคับไม่ครบ';
    if (code.startsWith('photo_required:')) {
      const [, side, slot] = code.split(':');
      return (
        'รอรูป ' +
        (this.detail()?.photoSlots.find((x) => x.side === side && String(x.slot) === slot)?.label ??
          side)
      );
    }
    return code;
  }
  openPhoto(slot: QualitySlot) {
    if (this.blocked() || !this.detail()?.canEdit || this.detail()?.legacyReviewRequired) return;
    this.upload.clear();
    this.command.clear();
    this.photoFile = null;
    this.photoCaption = '';
    this.photoReason = '';
    this.photoError.set('');
    this.revokeLocal();
    this.photoSlot.set(slot);
    this.photoBaseline = this.photoSnapshot();
  }
  private photoSnapshot() {
    return JSON.stringify([
      this.photoFile?.name ?? '',
      this.photoFile?.size ?? 0,
      this.photoCaption,
      this.photoReason,
    ]);
  }
  photoDirty() {
    return !!this.photoSlot() && this.photoSnapshot() !== this.photoBaseline;
  }
  closePhoto() {
    if (
      this.upload.busy() ||
      this.upload.uncertain() ||
      this.command.busy() ||
      this.command.uncertain()
    )
      return;
    if (this.photoDirty()) {
      this.discard.set(true);
      this.pendingLeave = (ok) => {
        if (ok) this.photoSlot.set(null);
      };
    } else {
      this.photoSlot.set(null);
      this.revokeLocal();
    }
  }
  async chooseFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.photoError.set('');
    if (!file) return;
    const generation = ++this.fileGeneration;
    const slot = this.photoSlot();
    this.photoFile = null;
    this.revokeLocal();
    if (!/\.(png|jpe?g|webp)$/i.test(file.name) || file.size <= 0 || file.size > 20 * 1024 * 1024) {
      this.photoError.set('เลือก PNG/JPEG/WebP ที่ไม่ว่าง ขนาดไม่เกิน20 MiB');
      return;
    }
    this.decodingPhoto.set(true);
    try {
      const image = await createImageBitmap(file);
      image.close();
      if (generation === this.fileGeneration && this.photoSlot() === slot) {
        this.photoFile = file;
        this.photoLocal.set(URL.createObjectURL(file));
      }
    } catch {
      if (generation === this.fileGeneration)
        this.photoError.set('เปิดภาพนี้ไม่ได้ กรุณาเลือกไฟล์ภาพที่สมบูรณ์');
    } finally {
      if (generation === this.fileGeneration) this.decodingPhoto.set(false);
    }
  }
  private revokeLocal() {
    if (this.photoLocal()) URL.revokeObjectURL(this.photoLocal());
    this.photoLocal.set('');
  }
  async savePhoto() {
    const d = this.detail(),
      slot = this.photoSlot(),
      file = this.photoFile;
    if (!d || !slot || this.blocked()) return;
    if (!file || !this.photoReason.trim()) {
      this.photoError.set('เลือกรูปและระบุเหตุผลการแนบ / แทนรูป');
      return;
    }
    this.photoError.set('');
    await this.upload.run(
      this.id,
      d.version,
      slot.side,
      slot.slot,
      file,
      this.photoCaption.trim(),
      this.photoReason.trim(),
      async () => {
        await this.fetch(true);
        this.photoSlot.set(null);
        this.photoFile = null;
        this.revokeLocal();
        this.notice.set('บันทึกรูปแล้ว · ผล Checklist ที่กรอกยังอยู่');
      },
    );
  }
  async previewFile(fileId: string, label: string) {
    if (this.previewBusy()) return;
    this.closePreview();
    this.previewBusy.set(true);
    this.previewError.set('');
    try {
      const blob = await this.api.file(fileId);
      this.preview.set({ url: URL.createObjectURL(blob), label });
    } catch (e) {
      this.previewError.set(problemMessage(e));
    } finally {
      this.previewBusy.set(false);
    }
  }
  closePreview() {
    if (this.preview()) URL.revokeObjectURL(this.preview()!.url);
    this.preview.set(null);
  }
  beginRemove(slot: QualitySlot) {
    if (this.blocked()) return;
    this.command.clear();
    this.removeReason = '';
    this.removePhoto.set(slot);
  }
  async remove() {
    const slot = this.removePhoto(),
      d = this.detail();
    if (!slot || !d || this.blocked()) return;
    if (!this.removeReason.trim()) {
      this.notice.set('ระบุเหตุผลที่นำรูปออก');
      return;
    }
    await this.command.run<QualityMutation>(
      '/quality/inspections/' + this.id + '/photos',
      {
        expectedVersion: d.version,
        side: slot.side,
        slot: slot.slot,
        fileId: null,
        caption: null,
        reason: this.removeReason.trim(),
      },
      async () => {
        await this.fetch(true);
        this.removePhoto.set(null);
        this.notice.set('นำรูปปัจจุบันออกแล้ว · รูปเก่ายังดูได้ในประวัติ');
      },
    );
  }
  async reviewLegacy() {
    const d = this.detail();
    if (!d || this.blocked() || !this.legacyReason.trim()) return;
    await this.command.run<QualityMutation>(
      '/quality/inspections/' + this.id + '/review-legacy',
      { expectedVersion: d.version, reason: this.legacyReason.trim() },
      async () => {
        await this.fetch(true);
        this.legacyReview.set(false);
        this.notice.set('เก็บข้อกำหนดรูปสี่ด้านแล้ว · กรุณาจัดรูปเดิมให้ตรงด้าน หรือแนบรูปใหม่');
      },
    );
  }
  async openSource(id: string) {
    if (this.sourceBusy()) return;
    this.sourceId = id;
    this.sourceOpen.set(true);
    this.sourceBusy.set(true);
    this.source.set(null);
    this.sourceError.set('');
    try {
      this.source.set(await this.api.source(this.id, id));
    } catch (e) {
      this.sourceError.set(problemMessage(e));
    } finally {
      this.sourceBusy.set(false);
    }
  }
  retrySource() {
    void this.openSource(this.sourceId);
  }
}
