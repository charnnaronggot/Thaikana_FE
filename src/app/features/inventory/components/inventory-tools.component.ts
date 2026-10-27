import { Component, inject, input, output, signal,viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NativeApi } from '../../modules/native-api.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { problemMessage } from '../../../core/services/api/api-client.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { ReworkInputTools } from './rework-input-tools.component';
import { FinishedGoodsTools } from './finished-goods-tools.component';

type Options = components['schemas']['InventoryWorkspaceOptions'];
type Bucket = components['schemas']['InventoryBucketChoice'];
type Action = 'prepare' | 'receive' | 'issue' | 'return' | 'reverse' | 'transfer' | 'scrap' | 'adjust';
@Component({
  selector: 'app-inventory-tools', imports: [CommonModule, FormsModule, Drawer, StateMessage,ReworkInputTools,FinishedGoodsTools], providers: [MutationSession],
  templateUrl: './inventory-tools.component.html', styleUrl: './inventory-tools.component.scss',
})
export class InventoryTools {
  readonly reworkInput=viewChild(ReworkInputTools);
  readonly finishedGoods=viewChild(FinishedGoodsTools);qcNumber=input('');
  changed = output<void>();
  private api = inject(NativeApi);
  readonly command = inject(MutationSession);
  options = signal<Options | null>(null);
  action = signal<Action | null>(null);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  discard = signal(false);
  readonly titles: Record<Action, string> = { prepare: 'เตรียมใบเบิกตาม WO', receive: 'รับวัสดุเข้า', issue: 'เบิกวัสดุจริง', return: 'คืนวัสดุ', reverse: 'ย้อนรายการ', transfer: 'โอนตำแหน่งจัดเก็บ', scrap: 'ตัดวัสดุเสีย', adjust: 'ปรับยอดจากการตรวจนับ' };
  readonly actions = Object.keys(this.titles) as Action[];
  search = '';
  model = this.empty();
  private baseline = '';
  private empty() { return { itemId: '', locationId: '', batchNo: '', externalReference: '', quantity: 1, unitCost: 0, freeOfCharge:false,costSource:'',workOrderId: '', requestId: '', bucketId: '', reservationId: '', originalId: '', targetLocationId: '', reason: '' }; }
  canLeave() { return !this.command.busy() && !this.command.uncertain() && !this.action() && (this.reworkInput()?.canLeave()??true) && (this.finishedGoods()?.canLeave()??true); }
  async load() {
    this.busy.set(true); this.error.set('');
    try { this.options.set(await this.api.get<Options>('/inventory/workspace/options', { search: this.search })); }
    catch (e) { this.options.set(null); this.error.set(problemMessage(e)); }
    finally { this.busy.set(false); }
  }
  async begin(action: Action) {
    if (!this.canLeave() || this.busy()) return;
    this.command.clear(); this.model = this.empty(); this.notice.set(''); this.search = '';
    await this.load(); if (!this.options() || this.error()) return;
    this.action.set(action); this.baseline = JSON.stringify(this.model);
  }
  close() {
    if (this.command.busy() || this.command.uncertain()) return;
    if (JSON.stringify(this.model) !== this.baseline) this.discard.set(true); else this.action.set(null);
  }
  abandon() { this.discard.set(false); this.action.set(null); this.command.clear(); }
  bucket(): Bucket | undefined { return this.options()?.buckets?.find(b => b.id === this.model.bucketId); }
  request() { return this.options()?.requests?.find(r => r.id === this.model.requestId); }
  original() { return this.options()?.originals?.find(r => r.id === this.model.originalId); }
  selectedItem() { return this.options()?.items?.find(i => i.id === this.model.itemId); }
  issueRequests() { return (this.options()?.requests ?? []).filter(r => Number(r.remaining) > 0); }
  buckets() { const request = this.request(); return (this.options()?.buckets ?? []).filter(b => this.action() !== 'issue' || (request && b.itemId === request.itemId && b.category === 'UNRESTRICTED')); }
  reservations() { const request = this.request(); return (this.options()?.reservations ?? []).filter(r => r.componentId === request?.componentId && r.bucketId === this.model.bucketId && Number(r.outstanding) > 0); }
  originals() { return (this.options()?.originals ?? []).filter(o => Number(this.action() === 'return' ? o.remainingReturn : o.remainingReverse) > 0); }
  targetLocations() { const bucket = this.bucket(); return bucket ? (this.options()?.locations ?? []).filter(l => l.plantId === bucket.plantId && l.id !== bucket.locationId) : []; }
  chooseRequest() { this.model.bucketId = ''; this.model.reservationId = ''; this.model.quantity = Math.max(0, Number(this.request()?.remaining ?? 0)); }
  chooseBucket() { this.model.reservationId = ''; this.model.targetLocationId = ''; if (this.reservations().length === 1) this.model.reservationId = this.reservations()[0].id!; }
  chooseOriginal() { const original = this.original(); this.model.bucketId = original?.bucketId ?? ''; this.model.quantity = Number(this.action() === 'return' ? original?.remainingReturn ?? 0 : original?.remainingReverse ?? 0); }
  delta() { const action = this.action(), qty = Number(this.model.quantity); return action === 'reverse' ? -Math.sign(Number(this.original()?.quantity ?? 0)) * qty : action === 'issue' || action === 'scrap' || action === 'transfer' ? -qty : qty; }
  after() { return Number(this.bucket()?.onHand ?? 0) + this.delta(); }
  async save() {
    const action = this.action(); if (!action || this.command.busy() || this.command.uncertain() || this.busy()) return;
    this.error.set('');
    const model = this.model, bucket = this.bucket(), qty = Number(model.quantity);
    let path: string, body: unknown;
    if (action === 'prepare') {
      const wo = this.options()?.workOrders?.find(w => w.id === model.workOrderId);
      if (!wo) { this.error.set('เลือก WO ที่ Release แล้ว'); return; }
      path = '/inventory/work-orders/' + wo.id + '/prepare-issue'; body = { expectedVersion: wo.version } satisfies components['schemas']['PrepareMaterialIssueRequest'];
    } else if (action === 'receive') {
      const knownCost=model.unitCost>0&&!model.freeOfCharge||model.unitCost===0&&model.freeOfCharge&&!!model.costSource.trim();
      if (!model.itemId || !model.locationId || !(qty > 0) || !knownCost || !model.externalReference.trim() || (this.selectedItem()?.batchManaged && !model.batchNo.trim())) { this.error.set('กรอกวัสดุ ตำแหน่ง จำนวน ต้นทุน แหล่งอ้างอิง และ Lot ให้ครบ · ราคาศูนย์ต้องยืนยันว่าไม่มีค่าใช้จ่ายและระบุเหตุผล'); return; }
      path = '/inventory/receive-material'; body = { externalReference: model.externalReference.trim(), items: [{ itemId: model.itemId, locationId: model.locationId, quantity: qty, unitCost: Number(model.unitCost), batchNo: model.batchNo.trim() || null,freeOfCharge:model.freeOfCharge,costSource:model.freeOfCharge?model.externalReference.trim()+' · '+model.costSource.trim():model.externalReference.trim() }] } satisfies components['schemas']['ReceiveMaterial'];
    } else {
      if (!bucket || !Number.isFinite(qty) || (action === 'adjust' ? qty === 0 : qty <= 0)) { this.error.set('เลือกรายการสต็อกและจำนวนให้ถูกต้อง'); return; }
      const expectedVersion = bucket.version;
      path = '/inventory/' + action;
      if (action === 'issue') {
        const request = this.request();
        if (!request || (request.componentId && !model.reservationId)) { this.error.set('เลือกใบเบิกและยอดจองของวัสดุนี้'); return; }
        body = { requestItemId: request.id!, bucketId: bucket.id!, reservationId: model.reservationId || null, quantity: qty, expectedVersion } satisfies components['schemas']['IssueMaterialRequest'];
      } else {
        if (!model.reason.trim()) { this.error.set('ระบุเหตุผลก่อนบันทึก'); return; }
        if (action === 'return' || action === 'reverse') {
          if (!this.original()) { this.error.set('เลือกเอกสารต้นฉบับ'); return; }
          body = { originalItemId: model.originalId, quantity: qty, reason: model.reason.trim(), expectedVersion } satisfies components['schemas']['ReturnMaterialRequest'];
        } else if (action === 'transfer') {
          if (!model.targetLocationId) { this.error.set('เลือกตำแหน่งปลายทางในโรงงานเดียวกัน'); return; }
          body = { sourceBucketId: bucket.id!, targetLocationId: model.targetLocationId, targetCategory: bucket.category!, quantity: qty, reason: model.reason.trim(), expectedVersion } satisfies components['schemas']['TransferStockRequest'];
        } else if (action === 'scrap') body = { bucketId: bucket.id!, quantity: qty, reason: model.reason.trim(), expectedVersion } satisfies components['schemas']['ScrapStockRequest'];
        else {
          if (qty > 0 && !(model.unitCost > 0)) { this.error.set('ปรับเพิ่มต้องระบุต้นทุนที่ตรวจสอบแล้ว'); return; }
          body = { bucketId: bucket.id!, quantityDelta: qty, unitCost: qty > 0 ? Number(model.unitCost) : null, reason: model.reason.trim(), expectedVersion } satisfies components['schemas']['AdjustStockRequest'];
        }
      }
    }
    await this.command.run<{ documentId?: string }>(path, body, async result => { this.action.set(null); this.notice.set(action === 'prepare' ? 'เตรียมใบเบิกแล้ว · ยังต้องยืนยันเบิกวัสดุจริง' : 'บันทึกสำเร็จ' + (result.documentId ? ' · เอกสาร ' + result.documentId : '')); await this.load(); this.changed.emit(); });
  }
  retry() { return this.command.retry(); }
}
