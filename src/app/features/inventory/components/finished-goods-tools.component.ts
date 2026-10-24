import { CommonModule } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { components } from '../../../core/services/api/generated/native-schema';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { QualityApi } from '../../qc/services/quality-api.service';

type Workspace = components['schemas']['FinishedGoodsWorkspace'];
type Entitlement = components['schemas']['FinishedGoodsEntitlement'];
@Component({
  selector: 'app-finished-goods-tools',
  imports: [CommonModule, FormsModule, Drawer, StateMessage],
  providers: [MutationSession],
  templateUrl: './finished-goods-tools.component.html',
  styleUrl: './finished-goods-tools.component.scss',
})
export class FinishedGoodsTools {
  enabled = input(true);
  initialSearch = input('');
  changed = output<void>();
  readonly command = inject(MutationSession);
  private api = inject(QualityApi);
  open = signal(false);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  discard = signal(false);
  fields = signal<Record<string, string>>({});
  data = signal<Workspace | null>(null);
  search = '';
  selectedId = '';
  locationId = '';
  quantity = 1;
  batchNo = '';
  private baseline = '';
  num(value: number | string | null | undefined) {
    return Number(value ?? 0);
  }
  canLeave() {
    return !this.busy() && !this.open() && !this.command.busy() && !this.command.uncertain();
  }
  selected() {
    return this.data()?.entitlements.find((x) => x.dispositionId === this.selectedId);
  }
  locations() {
    const plant = this.selected()?.plantId;
    return this.data()?.locations.filter((x) => x.plantId === plant) ?? [];
  }
  private snapshot() {
    return JSON.stringify([this.selectedId, this.locationId, this.quantity, this.batchNo]);
  }
  async begin(search = '') {
    if (!this.enabled() || !this.canLeave() || this.busy()) return;
    this.command.clear();
    this.search = search;
    this.notice.set('');
    this.fields.set({});
    this.batchNo = '';
    this.selectedId = '';
    await this.load();
    if (this.error()) return;
    this.selectedId = this.data()?.entitlements[0]?.dispositionId ?? '';
    this.choose();
    this.baseline = this.snapshot();
    this.open.set(true);
  }
  choose() {
    const row = this.selected();
    this.quantity = this.num(row?.remaining) || 1;
    this.locationId =
      this.locations().find((x) => x.code === 'FG')?.id ?? this.locations()[0]?.id ?? '';
    this.fields.set({});
  }
  async load() {
    if (this.busy() || this.command.busy() || this.command.uncertain()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.finishedGoods(this.search));
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  close() {
    if (this.command.busy() || this.command.uncertain()) return;
    if (this.snapshot() !== this.baseline) this.discard.set(true);
    else this.abandon();
  }
  abandon() {
    this.open.set(false);
    this.discard.set(false);
    this.command.clear();
  }
  async reloadConflict() {
    if (this.command.busy() || this.command.uncertain()) return;
    this.command.clear();
    await this.load();
    this.notice.set(
      'โหลดสิทธิ์รับล่าสุดแล้ว · จำนวนและล็อตที่กรอกยังอยู่ กรุณาตรวจคงเหลือก่อนบันทึก',
    );
  }
  async save() {
    const row = this.selected();
    if (!row || this.busy() || this.command.busy() || this.command.uncertain()) return;
    const errors: Record<string, string> = {};
    if (!this.locations().some((x) => x.id === this.locationId))
      errors['location'] = 'เลือกที่จัดเก็บในโรงงานของ WO';
    if (
      !Number.isFinite(this.quantity) ||
      this.quantity <= 0 ||
      this.quantity > this.num(row.remaining) ||
      Number(this.quantity.toFixed(6)) !== this.quantity
    )
      errors['quantity'] = 'ระบุจำนวนไม่เกินยอดผ่านที่ยังรับได้';
    if (!this.batchNo.trim() || this.batchNo.length > 100)
      errors['batch'] = 'ระบุเลขล็อตไม่เกิน100ตัวอักษร';
    this.fields.set(errors);
    if (Object.keys(errors).length) return;
    await this.command.run<components['schemas']['FinishedGoodsReceipt']>(
      '/inventory/finished-goods/receive',
      {
        expectedVersion: row.version,
        dispositionId: row.dispositionId,
        locationId: this.locationId,
        quantity: this.quantity,
        batchNo: this.batchNo.trim(),
      },
      () => {
        this.open.set(false);
        this.changed.emit();
      },
    );
  }
}
