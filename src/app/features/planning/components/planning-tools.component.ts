import { Component, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NativeApi } from '../../modules/native-api.service';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { PlanningCompletionTools } from './planning-completion.component';

type Readiness = components['schemas']['WorkOrderReadiness'];
type Configure = components['schemas']['ConfigureWorkOrderRequest'];
type Version = components['schemas']['PlanningVersionRequest'];
type DemandPreview = components['schemas']['PlanningDemandPreview'];
interface Options {
  plants: { id: string; code: string; name: string }[];
  stations: { id: string; plantId: string; code: string; name: string; isFinalQc: boolean }[];
  revisions: { id: string; code: string; name: string; revisionCode: string }[];
  demands: { id: string; productRevisionId: string; orderNo: string; name: string; orderedQty: number; cancelledQty: number; dueDate: string }[];
}
@Component({
  selector: 'app-planning-tools', imports: [FormsModule, CommonModule, RouterLink, Drawer, StateMessage,PlanningCompletionTools],
  providers: [MutationSession], templateUrl: './planning-tools.component.html', styleUrl: './planning-tools.component.scss',
})
export class PlanningTools {
  readonly completionTools=viewChild(PlanningCompletionTools);
  workOrderId = input<string>();
  changed = output<void>();
  openWorkOrder=output<string>();
  private api = inject(NativeApi);
  command = inject(MutationSession);
  readiness = signal<Readiness | null>(null);
  repairInput=signal<components['schemas']['ReworkInputSummary']|null>(null);
  options = signal<Options | null>(null);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  form = signal<'request' | 'process' | null>(null);
  discard = signal(false);
  formError = signal('');
  demandPreview = signal<DemandPreview | null>(null);
  demandBusy = signal(false);
  demandError = signal('');
  private demandGeneration = 0;
  baseline = '';
  plantId = '';
  demandType = 'SALES_ORDER';
  salesOrderItemId = '';
  revisionId = '';
  quantity = 1;
  dueDate = '';
  priority = 0;
  startDate = '';
  qualityStationId = '';
  steps: { workCenterId: string; name: string; standardMinutes: number }[] = [];
  private generation = 0;
  readonly blockers: Record<string, string> = {
    rework_input_not_transferred:'Store ยังไม่ยืนยันรับชิ้นงานแก้ไขจากต้นทางครบ',
    no_production_target:'ไม่มีเป้าหมายผลิตคงเหลือ · ให้ Store คืนวัสดุที่ยังไม่ใช้',
    process_required: 'ยังไม่กำหนดขั้นผลิต', process_review_required: 'Planner ยังไม่ทบทวนขั้นผลิต',
    planned_start_required: 'ยังไม่กำหนดวันเริ่ม', material_reservation_shortage: 'ยังจองวัสดุไม่ครบ',
    material_not_issued: 'Store ยังเบิกวัสดุไม่ครบ', inactive_plant: 'โรงงานปิดใช้งาน',
    design_not_ready: 'แบบยังไม่พร้อม', inactive_station: 'มีสถานีที่ปิดใช้งาน',
  };
  constructor() { effect(() => { this.workOrderId(); void this.load(); }); }
  canLeave() { return !this.command.busy() && !this.command.uncertain() && !this.form() && (this.completionTools()?.canLeave() ?? true); }
  get stations() { return (this.options()?.stations ?? []).filter(s => s.plantId === this.plantId); }
  productionStations() { return this.stations.filter(s => !s.isFinalQc); }
  qualityStations() { return this.stations.filter(s => s.isFinalQc); }
  async load() {
    const id = this.workOrderId(), generation = ++this.generation;
    this.busy.set(true); this.error.set('');
    try {
      const [options,ready,input]=await Promise.all([
        this.api.get<Options>('/planning/options'),
        id?this.api.get<Readiness>('/planning/work-orders/'+id+'/readiness'):Promise.resolve(null),
        id?this.api.get<components['schemas']['ReworkInputSummary'][]>('/planning/work-orders/'+id+'/rework-input'):Promise.resolve([]),
      ]);
      if (generation !== this.generation) return;
      this.options.set(options); this.readiness.set(ready);this.repairInput.set(input[0]??null);
      if (this.completionTools()?.canLeave()) void this.completionTools()?.load();
    } catch (e) { if (generation === this.generation) this.error.set(problemMessage(e)); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  private snapshot() { return JSON.stringify([this.plantId, this.demandType, this.salesOrderItemId, this.revisionId, this.quantity, this.dueDate, this.priority, this.startDate, this.qualityStationId, this.steps]); }
  async begin(kind: 'request' | 'process') {
    if (!this.canLeave() || this.busy()) return;
    this.command.clear(); this.formError.set(''); this.notice.set('');
    this.plantId = this.options()?.plants[0]?.id ?? '';
    this.demandType = 'SALES_ORDER'; this.salesOrderItemId = ''; this.revisionId = ''; this.quantity = 1; this.dueDate = ''; this.priority = 0; this.demandPreview.set(null); this.demandError.set('');
    this.steps = []; this.qualityStationId = ''; this.startDate = this.readiness()?.plannedStart ?? '';
    if (kind === 'process') {
      try {
        this.busy.set(true);
        const detail = await this.api.detail('work-orders', this.workOrderId()!);
        const header = detail['header'] as Record<string, unknown>;
        this.plantId = String(header['plantId']); this.dueDate = String(header['dueDate']);
        const process = JSON.parse(String(header['processSnapshot']));
        this.steps = (process.steps ?? []).map((s: { workCenterId: string; name: string; standardMinutes: number }) => ({ ...s }));
        this.qualityStationId = process.qualityCheckpoint?.id ?? '';
        if (!this.steps.length) this.addStep();
      } catch (e) { this.error.set(problemMessage(e)); return; }
      finally { this.busy.set(false); }
    }
    this.form.set(kind); this.baseline = this.snapshot();
  }
  async chooseDemand() {
    const generation = ++this.demandGeneration;
    this.demandPreview.set(null); this.demandError.set(''); this.revisionId = '';
    const demand = this.options()?.demands.find(d => d.id === this.salesOrderItemId);
    if (!demand || !this.plantId || this.demandType !== 'SALES_ORDER') { this.demandBusy.set(false); return; }
    this.dueDate = demand.dueDate; this.demandBusy.set(true);
    try {
      const preview = await this.api.get<DemandPreview>('/planning/demands/' + demand.id + '/coverage', { plantId: this.plantId });
      if (generation !== this.demandGeneration) return;
      this.demandPreview.set(preview); this.revisionId = demand.productRevisionId; this.quantity = Number(preview.recommendedProduction ?? 0);
    } catch (e) { if (generation === this.demandGeneration) this.demandError.set(problemMessage(e)); }
    finally { if (generation === this.demandGeneration) this.demandBusy.set(false); }
  }
  async allocateFg() {
    if (!this.salesOrderItemId || !this.plantId || this.command.busy() || this.command.uncertain()) return;
    await this.command.run('/sales-order-items/' + this.salesOrderItemId + '/allocate-fg', { plantId: this.plantId }, async () => { await this.chooseDemand(); this.notice.set('จัดสรร FG แล้ว'); });
  }
  hasAvailableFg() { return Number(this.demandPreview()?.availableFg ?? 0) > 0; }
  addStep() { this.steps = [...this.steps, { workCenterId: '', name: '', standardMinutes: 0 }]; }
  chooseStation(index: number) { const step = this.steps[index]; step.name = this.stations.find(s => s.id === step.workCenterId)?.name ?? ''; }
  move(index: number, delta: number) { const target = index + delta; if (target < 0 || target >= this.steps.length) return; [this.steps[index], this.steps[target]] = [this.steps[target], this.steps[index]]; this.steps = [...this.steps]; }
  close() {
    if (this.command.busy() || this.command.uncertain()) return;
    if (this.snapshot() !== this.baseline) this.discard.set(true); else this.form.set(null);
  }
  abandon() { this.discard.set(false); this.form.set(null); this.command.clear(); }
  async save() {
    if (this.command.busy() || this.command.uncertain() || this.demandBusy()) return;
    this.formError.set('');
    let path: string, body: unknown;
    if (this.form() === 'request') {
      if (!this.plantId || !this.revisionId || !this.dueDate || this.quantity <= 0 || (this.demandType === 'SALES_ORDER' && !this.salesOrderItemId)) { this.formError.set('เลือกลูกค้า/สินค้า โรงงาน จำนวน และกำหนดส่งให้ครบ'); return; }
      path = '/planning-requests'; body = { demandType: this.demandType, salesOrderItemId: this.demandType === 'SALES_ORDER' ? this.salesOrderItemId : null, productRevisionId: this.revisionId, plantId: this.plantId, quantity: this.quantity, dueDate: this.dueDate, priority: this.priority };
    } else {
      if (!this.startDate || !this.qualityStationId || !this.steps.length || this.steps.some(s => !s.workCenterId || !s.name.trim() || s.standardMinutes < 0)) { this.formError.set('ระบุวันเริ่ม ขั้นผลิต และจุดตรวจคุณภาพให้ครบ'); return; }
      path = '/planning/work-orders/' + this.workOrderId() + '/process';
      body = { expectedVersion: this.readiness()!.version, plannedStart: this.startDate, steps: this.steps, qualityStationId: this.qualityStationId } satisfies Configure;
    }
    await this.command.run(path, body, async () => { this.form.set(null); this.notice.set('บันทึกแล้ว'); await this.load(); this.changed.emit(); });
  }
  async act(action: 'review' | 'reserve' | 'release') {
    const ready = this.readiness(); if (!ready || !this.canLeave() || this.busy()) return;
    const body = { expectedVersion: ready.version } satisfies Version;
    await this.command.run('/planning/work-orders/' + this.workOrderId() + '/' + action, body,
      async () => { this.notice.set(action === 'release' ? 'Release แล้ว · ส่งต่อ Store เบิกวัสดุ' : action === 'reserve' ? 'ตรวจและจองวัสดุแล้ว' : 'ทบทวนขั้นผลิตแล้ว'); await this.load(); this.changed.emit(); });
  }
  async retry() { await this.command.retry(); }
}
