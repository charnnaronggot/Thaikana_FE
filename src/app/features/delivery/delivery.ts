import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Badge, Feature, Overlay, StateMessage } from '../../shared/ui';
import { Allocation, Delivery as DeliveryModel, OrderLine, SalesOrder } from '../../domain/models';

@Component({
  imports: [ReactiveFormsModule, RouterLink, Badge, Overlay, StateMessage],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">FULFILLMENT / DISPATCH</p>
        <h1>จัดส่งสินค้า</h1>
        <p class="muted">จัดสรร FG · หยิบและบรรจุ · ส่งบางส่วน · ยืนยันรับสินค้า</p>
      </div>
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (notice()) {
      <div class="notice success" role="status">{{ notice() }}</div>
    }
    <div class="tabs">
      <button [class.active]="tab() === 'orders'" (click)="tab.set('orders')">คำสั่งขาย</button
      ><button [class.active]="tab() === 'history'" (click)="tab.set('history')">
        ประวัติส่งของ
      </button>
    </div>
    @if (tab() === 'orders') {
      @for (order of store.state().orders; track order.id) {
        <section class="card">
          <div class="section-heading">
            <div>
              <h2>{{ order.number }} · {{ order.customer }}</h2>
              <p class="muted">PO {{ order.po }} · กำหนด {{ order.dueDate }}</p>
            </div>
            <app-badge [value]="orderStatus(order)" />
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สินค้า / Revision</th>
                  <th class="numeric">สั่ง</th>
                  <th class="numeric">FG จัดสรร</th>
                  <th class="numeric">ส่งแล้ว</th>
                  <th class="numeric">รับแล้ว</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (line of order.lines; track line.id) {
                  <tr>
                    <td>
                      <strong>{{ line.name }}</strong
                      ><small>{{ revision(line.productRevisionId) }}</small>
                    </td>
                    <td class="numeric">{{ line.quantity }}</td>
                    <td class="numeric">{{ line.allocated }}</td>
                    <td class="numeric">{{ line.dispatched }}</td>
                    <td class="numeric">{{ line.delivered }}</td>
                    <td>
                      <div class="actions">
                        @if (
                          session.can('Delivery') &&
                          line.allocated < line.quantity &&
                          available(line) > 0
                        ) {
                          <button (click)="openAllocate(order, line)">จัดสรร FG</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (session.can('Delivery')) {
            <button class="primary" (click)="openDispatch(order)" [disabled]="!dispatchable(order)">
              หยิบ / บรรจุ / ส่งของ
            </button>
          }
        </section>
      } @empty {
        <div class="empty">
          <h2>ยังไม่มีคำสั่งขาย</h2>
          <a routerLink="/sales">เริ่มที่ใบเสนอราคา →</a>
        </div>
      }
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ใบส่งของ</th>
              <th>คำสั่งขาย</th>
              <th>รายการ</th>
              <th>ขนส่ง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of store.state().deliveries; track d.id) {
              <tr>
                <td>
                  <strong>{{ d.number }}</strong
                  ><small>{{ date(d.dispatchedAt) }}</small>
                </td>
                <td>{{ orderNumber(d.orderId) }}</td>
                <td>{{ d.lines.length }} รายการ / {{ deliveryQty(d) }} ชิ้น</td>
                <td>
                  {{ d.carrier }}<small>{{ d.reference }}</small>
                </td>
                <td><app-badge [value]="d.status" /></td>
                <td>
                  @if (d.status === 'Dispatched' && session.can('Delivery')) {
                    <button (click)="openReceive(d)">ยืนยันรับสินค้า</button>
                  } @else {
                    {{ d.receiver }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!store.state().deliveries.length) {
        <div class="empty">ยังไม่มีรายการจัดส่ง</div>
      }
    }
    @if (mode() === 'allocate') {
      <app-overlay title="จัดสรร FG" (close)="mode.set('')"
        ><form [formGroup]="allocateForm" (ngSubmit)="allocate()">
          <p>
            {{ selectedLine?.name }} · ค้างจัดสรร
            {{ (selectedLine?.quantity ?? 0) - (selectedLine?.allocated ?? 0) }} · FG พร้อม
            {{ selectedLine ? available(selectedLine) : 0 }}
          </p>
          <label>จำนวนจัดสรร<input type="number" min="1" formControlName="quantity" /></label>
          <div class="actions">
            <button type="button" (click)="mode.set('')">ยกเลิก</button
            ><button class="primary" [disabled]="busy() || allocateForm.invalid">
              บันทึกจัดสรร
            </button>
          </div>
        </form></app-overlay
      >
    }
    @if (mode() === 'dispatch') {
      <app-overlay title="หยิบ บรรจุ และส่งของ" (close)="mode.set('')"
        ><form [formGroup]="dispatchForm" (ngSubmit)="dispatch()">
          <p>{{ selectedOrder?.number }} · ตรวจสินค้าและ Revision ก่อนส่ง</p>
          <div class="form-grid">
            <label
              >รายการ FG ที่จัดสรร<select formControlName="allocationId">
                @for (a of allocations(); track a.id) {
                  <option [value]="a.id">
                    {{ allocationLabel(a) }} · คงเหลือ {{ a.quantity - a.dispatched }}
                  </option>
                }
              </select></label
            ><label
              >สแกนรหัส FG Lot<input
                formControlName="scanCode"
                autocomplete="off"
                placeholder="FG-..." /></label
            ><label>จำนวนที่จะส่ง<input type="number" min="1" formControlName="quantity" /></label
            ><label>จำนวนกล่อง<input type="number" min="1" formControlName="boxes" /></label
            ><label>ผู้ขนส่ง<input formControlName="carrier" /></label
            ><label>เลขอ้างอิงขนส่ง<input formControlName="reference" /></label
            ><label>ที่อยู่จัดส่ง<input formControlName="address" /></label>
          </div>
          <p class="muted">ส่งบางส่วนได้ โดยทำใบส่งของถัดไปสำหรับยอดคงเหลือ</p>
          <div class="actions">
            <button type="button" (click)="mode.set('')">ยกเลิก</button
            ><button class="primary" [disabled]="busy() || dispatchForm.invalid">
              ยืนยัน Dispatch
            </button>
          </div>
        </form></app-overlay
      >
    }
    @if (mode() === 'receive') {
      <app-overlay title="ยืนยันรับสินค้า" [dialog]="true" (close)="mode.set('')"
        ><form [formGroup]="receiveForm" (ngSubmit)="receive()">
          <p>{{ selectedDelivery?.number }} · {{ deliveryQty(selectedDelivery!) }} ชิ้น</p>
          <label>ชื่อผู้รับ<input formControlName="receiver" /></label
          ><label>หลักฐานการรับ / เลขอ้างอิง<input formControlName="proof" /></label
          ><label>พิกัด (ถ้ามี)<input formControlName="coordinates" /></label>
          <div class="actions">
            <button type="button" (click)="mode.set('')">ยกเลิก</button
            ><button class="primary" [disabled]="busy() || receiveForm.invalid">
              ยืนยัน Delivered
            </button>
          </div>
        </form></app-overlay
      >
    }
  `,
})
export class Delivery extends Feature {
  private fb = inject(FormBuilder);
  tab = signal('orders');
  mode = signal('');
  selectedOrder: SalesOrder | null = null;
  selectedLine: OrderLine | null = null;
  selectedDelivery: DeliveryModel | null = null;
  allocateForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
  });
  dispatchForm = this.fb.nonNullable.group({
    allocationId: ['', Validators.required],
    scanCode: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    boxes: [1, [Validators.required, Validators.min(1)]],
    carrier: ['', Validators.required],
    reference: ['', Validators.required],
    address: ['', Validators.required],
  });
  receiveForm = this.fb.nonNullable.group({
    receiver: ['', Validators.required],
    proof: ['', Validators.required],
    coordinates: [''],
  });
  allocations() {
    return this.store
      .state()
      .allocations.filter((a) => a.orderId === this.selectedOrder?.id && a.quantity > a.dispatched);
  }
  revision(id: string) {
    const r = this.store.state().revisions.find((r) => r.id === id);
    return r ? r.code + ' / R' + r.revision : id;
  }
  available(l: OrderLine) {
    return this.store
      .state()
      .fg.filter((f) => f.revisionId === l.productRevisionId)
      .reduce((n, f) => n + f.quantity - f.reserved, 0);
  }
  orderStatus(o: SalesOrder) {
    return o.lines.every((l) => l.delivered === l.quantity)
      ? 'Delivered'
      : o.lines.some((l) => l.dispatched)
        ? 'Partial'
        : 'Pending';
  }
  dispatchable(o: SalesOrder) {
    return this.store
      .state()
      .allocations.some((a) => a.orderId === o.id && a.quantity > a.dispatched);
  }
  orderNumber(id: string) {
    return this.store.state().orders.find((o) => o.id === id)?.number ?? id;
  }
  deliveryQty(d: DeliveryModel) {
    return d.lines.reduce((n, l) => n + l.quantity, 0);
  }
  allocationLabel(a: Allocation) {
    const l = this.selectedOrder?.lines.find((l) => l.id === a.lineId);
    const f = this.store.state().fg.find((f) => f.id === a.lotId);
    return (l?.name ?? '') + ' · ' + (f?.code ?? '');
  }
  openAllocate(o: SalesOrder, l: OrderLine) {
    this.selectedOrder = o;
    this.selectedLine = l;
    this.allocateForm.setValue({ quantity: Math.min(l.quantity - l.allocated, this.available(l)) });
    this.mode.set('allocate');
    this.error.set('');
  }
  async allocate() {
    if (!this.selectedOrder || !this.selectedLine) return;
    const ok = await this.run('delivery.allocate', {
      orderId: this.selectedOrder.id,
      lineId: this.selectedLine.id,
      ...this.allocateForm.getRawValue(),
    });
    if (ok) this.mode.set('');
  }
  openDispatch(o: SalesOrder) {
    this.selectedOrder = o;
    const a = this.store
      .state()
      .allocations.find((a) => a.orderId === o.id && a.quantity > a.dispatched);
    this.dispatchForm.reset({
      allocationId: a?.id ?? '',
      scanCode: '',
      quantity: a ? a.quantity - a.dispatched : 1,
      boxes: 1,
      carrier: '',
      reference: '',
      address: o.address,
    });
    this.mode.set('dispatch');
    this.error.set('');
  }
  async dispatch() {
    if (!this.selectedOrder) return;
    const p = this.dispatchForm.getRawValue();
    const ok = await this.run('delivery.dispatch', {
      orderId: this.selectedOrder.id,
      lines: [{ allocationId: p.allocationId, quantity: p.quantity, scanCode: p.scanCode }],
      boxes: p.boxes,
      carrier: p.carrier,
      reference: p.reference,
      address: p.address,
    });
    if (ok) {
      this.mode.set('');
      this.tab.set('history');
    }
  }
  openReceive(d: DeliveryModel) {
    this.selectedDelivery = d;
    this.receiveForm.reset({ receiver: '', proof: '', coordinates: '' });
    this.mode.set('receive');
    this.error.set('');
  }
  async receive() {
    if (!this.selectedDelivery) return;
    const ok = await this.run('delivery.delivered', {
      id: this.selectedDelivery.id,
      ...this.receiveForm.getRawValue(),
    });
    if (ok) this.mode.set('');
  }
}
