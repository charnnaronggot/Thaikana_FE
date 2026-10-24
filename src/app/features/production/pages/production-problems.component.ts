import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient, problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import {
  ProblemCommand,
  ProductionProblemsApi,
  ProblemWorkspace,
  ProblemDetail,
  ProblemOperation,
  ProblemRow,
} from '../services/production-problems.service';

@Component({
  imports: [CommonModule, FormsModule, RouterLink, Drawer, StateMessage],
  providers: [ProblemCommand],
  templateUrl: './production-problems.component.html',
  styleUrl: './production-problems.component.scss',
})
export class ProductionProblemsPage {
  readonly auth = inject(AuthService);
  readonly command = inject(ProblemCommand);
  private api = inject(ProductionProblemsApi);
  private http = inject(ApiClient);
  private route = inject(ActivatedRoute);
  data = signal<ProblemWorkspace | null>(null);
  detail = signal<ProblemDetail | null>(null);
  operation = signal<ProblemOperation | null>(null);
  loading = signal(false);
  detailBusy = signal(false);
  error = signal('');
  detailError = signal('');
  notice = signal('');
  formError = signal('');
  formCode = signal('');
  fields = signal<Record<string, string>>({});
  mode = signal<'report' | 'evidence' | 'review' | null>(null);
  verifying = signal(false);
  discard = signal(false);
  files = signal<File[]>([]);
  search = '';
  status = '';
  stationId = '';
  operationId = '';
  page = 1;
  model = this.empty();
  private baseline = '';
  private generation = 0;
  private detailGeneration = 0;
  readonly statuses = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'OPEN', label: 'แจ้งใหม่' },
    { value: 'ACKNOWLEDGED', label: 'รับเรื่อง' },
    { value: 'RESOLVED', label: 'แก้แล้ว' },
  ];
  empty() {
    return {
      executionId: '',
      code: 'QUALITY',
      description: '',
      quantity: 1,
      username: '',
      secret: '',
      delegated: false,
      reason: '',
      action: 'ACKNOWLEDGE',
    };
  }
  num(v: unknown) {
    return Number(v ?? 0);
  }
  isStation() {
    return this.auth.user()?.accountType === 'Station';
  }
  board() {
    return this.isStation() ? '/station' : '/production';
  }
  statusText(value: string) {
    return this.statuses.find((x) => x.value === value)?.label ?? value;
  }
  run() {
    return this.operation()?.executions.find((x) => x.id === this.model.executionId);
  }
  delegated() {
    return this.isStation()
      ? this.model.delegated
      : !!this.run() && this.run()!.ownerId !== this.auth.user()?.id;
  }
  needsPin() {
    return this.isStation() || this.delegated();
  }
  canReportAs(owner: string) {
    return (
      this.isStation() || owner === this.auth.user()?.id || this.auth.has('production.override')
    );
  }
  blocked() {
    return (
      this.loading() ||
      this.detailBusy() ||
      this.verifying() ||
      this.command.busy() ||
      this.command.uncertain()
    );
  }
  dirty() {
    return JSON.stringify(this.model) !== this.baseline || this.files().length > 0;
  }
  canLeave() {
    return (
      !this.verifying() &&
      !this.command.busy() &&
      !this.command.uncertain() &&
      (!this.mode() ||
        !this.dirty() ||
        window.confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?'))
    );
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if ((this.mode() && this.dirty()) || this.command.busy() || this.command.uncertain())
      event.preventDefault();
  }
  async ngOnInit() {
    this.operationId = this.route.snapshot.queryParamMap.get('operationId') ?? '';
    await this.load();
    const id = this.route.snapshot.queryParamMap.get('id');
    if (id) await this.openId(id);
  }
  async load(reset = false) {
    if (this.mode() || this.command.busy() || this.command.uncertain()) return;
    if (reset) this.page = 1;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.list({
        page: this.page,
        pageSize: 20,
        search: this.search,
        status: this.status,
        ...(this.stationId ? { stationId: this.stationId } : {}),
        ...(this.operationId ? { operationId: this.operationId } : {}),
      });
      if (generation === this.generation) this.data.set(data);
    } catch (e) {
      if (generation === this.generation) this.error.set(problemMessage(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  reset() {
    this.search = '';
    this.status = '';
    this.stationId = '';
    void this.load(true);
  }
  async open(row: ProblemRow) {
    await this.openId(row.id);
  }
  async openId(id: string) {
    if (this.mode() || this.blocked()) return;
    const generation = ++this.detailGeneration;
    this.detailBusy.set(true);
    this.detailError.set('');
    try {
      const detail = await this.api.detail(id);
      if (generation === this.detailGeneration) this.detail.set(detail);
    } catch (e) {
      this.detailError.set(problemMessage(e));
    } finally {
      this.detailBusy.set(false);
    }
  }
  async begin(mode: 'report' | 'evidence' | 'review') {
    if (this.blocked() || this.mode()) return;
    this.formError.set('');
    this.formCode.set('');
    this.fields.set({});
    this.command.clear();
    this.files.set([]);
    this.model = this.empty();
    this.verifying.set(true);
    try {
      const id = mode === 'report' ? this.operationId : this.detail()?.problem.operationId;
      if (!id) throw Error('เลือกงานจากบอร์ดผลิตก่อน');
      const op = await this.api.operation(id);
      this.operation.set(op);
      if (mode === 'report' && !op.canReport)
        throw Error('งานนี้ยังไม่พร้อมรับรายงานปัญหา หรือสิทธิ์ไม่เพียงพอ');
      if (mode === 'evidence' && !this.detail()?.canAddEvidence)
        throw Error('งานนี้ไม่สามารถเพิ่มหลักฐานได้');
      this.model.executionId =
        mode === 'report'
          ? (op.executions.find((x) => !x.legacyReviewRequired && this.canReportAs(x.ownerId))
              ?.id ?? '')
          : (this.detail()?.executionId ?? '');
      if (mode === 'review')
        this.model.action =
          this.detail()?.problem.status === 'RESOLVED'
            ? 'REOPEN'
            : this.detail()?.problem.status === 'OPEN'
              ? 'ACKNOWLEDGE'
              : 'RESOLVE';
      this.ownerChanged();
      this.baseline = JSON.stringify(this.model);
      this.mode.set(mode);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : problemMessage(e));
    } finally {
      this.verifying.set(false);
    }
  }
  ownerChanged() {
    this.model.secret = '';
    this.model.username = this.isStation()
      ? this.model.delegated
        ? ''
        : (this.run()?.ownerUsername ?? '')
      : (this.auth.user()?.username ?? '');
  }
  chooseFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    this.files.set(
      Array.from(input.files ?? []).map((file) =>
        /\.pdf$/i.test(file.name) &&
        ['', 'application/octet-stream', 'application/x-pdf', 'application/acrobat'].includes(
          file.type,
        )
          ? new File([file], file.name, {
              type: 'application/pdf',
              lastModified: file.lastModified,
            })
          : file,
      ),
    );
    this.fields.update((x) => ({ ...x, files: '' }));
  }
  close() {
    if (this.verifying() || this.command.busy() || this.command.uncertain()) return;
    if (this.dirty()) this.discard.set(true);
    else this.abandon();
  }
  abandon() {
    this.model.secret = '';
    this.files.set([]);
    this.mode.set(null);
    this.discard.set(false);
    this.command.clear();
  }
  async reloadConflict() {
    if (this.blocked()) return;
    this.verifying.set(true);
    try {
      const op = this.operation();
      if (op) this.operation.set(await this.api.operation(op.operationId));
      const d = this.detail();
      if (d) this.detail.set(await this.api.detail(d.problem.id));
      this.command.clear();
      this.formError.set('');
      this.formCode.set('');
      this.notice.set('โหลดข้อมูลล่าสุดแล้ว · ร่างที่กรอกยังอยู่ ตรวจสอบก่อนบันทึกอีกครั้ง');
    } catch (e) {
      this.formError.set(problemMessage(e));
    } finally {
      this.verifying.set(false);
    }
  }
  async save() {
    const mode = this.mode(),
      op = this.operation(),
      d = this.detail();
    if (!mode || !op || this.blocked()) return;
    const fields: Record<string, string> = {};
    if (mode !== 'review') {
      if (!this.run() || this.run()?.legacyReviewRequired)
        fields['executionId'] = 'เลือกรอบผลิตที่ตรวจสอบแล้ว';
      if (this.isStation() && !this.model.username.trim())
        fields['username'] = 'ระบุบัญชีผู้ทำรายการ';
      if (this.needsPin() && !/^\d{6}$/.test(this.model.secret))
        fields['secret'] = 'ระบุ PIN ของผู้ทำรายการ 6 หลัก';
      if (this.delegated() && !this.model.reason.trim())
        fields['reason'] = 'ระบุเหตุผลที่หัวหน้างานทำแทน';
      if (
        this.files().length > 5 ||
        this.files().some(
          (x) =>
            !x.size ||
            !['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(x.type),
        ) ||
        this.files().reduce((n, x) => n + x.size, 0) > 20 * 1024 * 1024
      )
        fields['files'] = 'แนบภาพ PNG/JPEG/WebP หรือ PDF ไม่เกิน 5 ไฟล์ รวม 20 MiB';
      if (mode === 'evidence' && !this.files().length)
        fields['files'] = 'เลือกไฟล์หลักฐานอย่างน้อย 1 ไฟล์';
    }
    if (mode === 'report') {
      if (!this.model.code.trim() || this.model.code.trim().length > 40)
        fields['code'] = 'ระบุประเภทปัญหา ไม่เกิน 40 ตัวอักษร';
      if (!this.model.description.trim()) fields['description'] = 'อธิบายสิ่งที่พบ';
      if (
        !Number.isFinite(this.model.quantity) ||
        this.model.quantity <= 0 ||
        this.model.quantity > this.num(this.run()?.input) ||
        Math.abs(Math.round(this.model.quantity * 1e6) - this.model.quantity * 1e6) > 0.00001
      )
        fields['quantity'] =
          'จำนวนต้องมากกว่าศูนย์ ไม่เกิน input รอบที่เลือก และทศนิยมไม่เกิน 6 ตำแหน่ง';
    }
    if (mode === 'review' && !this.model.reason.trim())
      fields['reason'] = 'ระบุผลตรวจสอบหรือเหตุผล';
    this.fields.set(fields);
    this.formError.set('');
    if (Object.keys(fields).length) return;
    let path: string, body: unknown;
    if (mode === 'review') {
      path = '/production/problems/' + d!.problem.id + '/review';
      body = {
        expectedVersion: d!.problem.version,
        action: this.model.action,
        reason: this.model.reason.trim(),
      } satisfies components['schemas']['ReviewProductionProblem'];
    } else {
      this.verifying.set(true);
      try {
        const proof = await this.http.post<components['schemas']['StationVerification']>(
          '/action-verifications',
          {
            operationId: op.operationId,
            action: 'PROBLEM',
            expectedVersion: op.version,
            executionId: this.model.executionId,
            problemId: mode === 'evidence' ? d!.problem.id : null,
            username: this.model.username || null,
            secret: this.needsPin() ? this.model.secret : null,
            reason: this.delegated() ? this.model.reason.trim() : null,
          } satisfies components['schemas']['VerificationRequest'],
        );
        this.model.secret = '';
        if (mode === 'report') {
          path = '/production/problems' + (this.files().length ? '/upload' : '');
          body = {
            operationId: op.operationId,
            expectedVersion: proof.version,
            executionId: this.model.executionId,
            verificationId: proof.verificationId,
            code: this.model.code.trim(),
            description: this.model.description.trim(),
            quantity: this.model.quantity,
          } satisfies components['schemas']['ReportProblem'];
        } else {
          path = '/production/problems/' + d!.problem.id + '/evidence';
          body = {
            expectedVersion: d!.problem.version,
            operationVersion: proof.version,
            executionId: this.model.executionId,
            verificationId: proof.verificationId,
          } satisfies Pick<
            components['schemas']['ReportProblem'],
            'expectedVersion' | 'executionId' | 'verificationId'
          > & { operationVersion: components['schemas']['ProblemOperation']['version'] };
        }
      } catch (e) {
        this.model.secret = '';
        this.formCode.set(e instanceof HttpErrorResponse ? (e.error?.code ?? '') : '');
        this.formError.set(
          this.formCode() === 'invalid_credentials'
            ? 'PIN ไม่ถูกต้องหรือถูกล็อก · ผิด 5 ครั้งล็อก 15 นาที'
            : problemMessage(e),
        );
        return;
      } finally {
        this.verifying.set(false);
      }
    }
    await this.command.run(path, body, this.files(), async (result) => {
      const id = (result as { id: string }).id;
      const refreshed = await this.api.detail(id);
      // Explicit refresh after a confirmed command; retries never repeat the write.
      const rows = await this.api.list({
        page: this.page,
        pageSize: 20,
        search: this.search,
        status: this.status,
        ...(this.stationId ? { stationId: this.stationId } : {}),
        ...(this.operationId ? { operationId: this.operationId } : {}),
      });
      this.data.set(rows);
      this.detail.set(refreshed);
      this.files.set([]);
      this.mode.set(null);
      this.notice.set(
        mode === 'report'
          ? 'แจ้งปัญหาแล้ว · หัวหน้างานตรวจสอบ แล้วส่ง Planning หากต้องสร้างงานแก้ไข'
          : mode === 'evidence'
            ? 'เพิ่มหลักฐานแล้ว'
            : 'บันทึกผลตรวจสอบแล้ว',
      );
    });
  }
  async download(id: string, name: string) {
    try {
      const blob = await this.api.file(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.detailError.set(problemMessage(e));
    }
  }
}
