import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Badge, Feature, StateMessage } from '../../shared/ui';
import { ListFilter } from '../../shared/list-filter';
import { materialDemand, readiness } from '../../domain/planning';
import { OrderLine, SalesOrder, WorkOrder } from '../../domain/models';
import { PdfService } from '../../shared/pdf';
@Component({
  imports: [ReactiveFormsModule, RouterLink, Badge, StateMessage, ListFilter],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">PRODUCTION PLANNING</p>
        <h1>วางแผนผลิต</h1>
        <p class="muted">ตรวจความพร้อม · จัดสรรสินค้าคงคลัง · สร้าง Work Order</p>
      </div>
      @if (session.can('Planner')) {
        <button class="primary" (click)="stock()">+ ผลิตเติมสต็อก</button>
      }
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (notice()) {
      <div class="notice success" role="status">{{ notice() }}</div>
    }
    <div class="tabs">
      <button [class.active]="tab() === 'orders'" (click)="tab.set('orders')">
        คำสั่งขายรอวางแผน</button
      ><button [class.active]="tab() === 'wo'" (click)="tab.set('wo')">Work Orders</button>
    </div>
    @if (planning()) {
      <section class="card">
        <div class="section-heading">
          <h2>{{ orderId ? 'วางแผนจากคำสั่งขาย' : 'ผลิตเก็บสต็อก' }}</h2>
          <button (click)="planning.set(false)">ปิดแผน</button>
        </div>
        <form [formGroup]="form">
          <div class="form-grid three">
            <label
              >Product Revision<select formControlName="revisionId" (change)="refreshQuantities()">
                @for (r of approved(); track r.id) {
                  <option [value]="r.id">{{ r.code }} · {{ r.name }} / R{{ r.revision }}</option>
                }
              </select></label
            ><label>กำหนดส่ง<input type="date" formControlName="dueDate" /></label
            ><label
              >ความสำคัญ<select formControlName="priority">
                <option>Normal</option>
                <option>High</option>
              </select></label
            ><label
              >จัดสรร FG (พร้อม {{ available() }})<input
                type="number"
                formControlName="fgQuantity"
                [readonly]="!orderId" /></label
            ><label>จำนวนผลิตเพิ่ม<input type="number" formControlName="makeQuantity" /></label
            ><label>เหตุผล / หมายเหตุ<input formControlName="reason" /></label>
          </div>
        </form>
        <p class="muted">ระบบจะ snapshot Revision, Drawing, BOM และจำนวน ณ เวลาสร้าง WO</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>วัสดุ</th>
                <th class="numeric">ต้องใช้</th>
                <th class="numeric">On hand</th>
                <th class="numeric">Reserved</th>
                <th class="numeric">Available</th>
              </tr>
            </thead>
            <tbody>
              @for (d of demand(); track d.id) {
                <tr>
                  <td>{{ d.name }}</td>
                  <td class="numeric">{{ d.qty }}</td>
                  <td class="numeric">{{ d.onHand }}</td>
                  <td class="numeric">{{ d.reserved }}</td>
                  <td class="numeric" [class.danger-text]="d.onHand - d.reserved < d.qty">
                    {{ d.onHand - d.reserved }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @for (e of readinessErrors(); track e) {
          <div class="notice warning">{{ e }}</div>
        }
        <div class="actions" style="margin-top:18px">
          <button
            class="primary"
            (click)="create()"
            [disabled]="
              busy() || form.invalid || !!readinessErrors().length || !session.can('Planner')
            "
          >
            จัดสรร FG / สร้าง Work Order</button
          ><button (click)="deny()" [disabled]="busy() || !session.can('Planner')">
            Denied พร้อมเหตุผล
          </button>
        </div>
      </section>
    }
    @if (tab() === 'orders') {
      <app-filter
        [count]="orders().length"
        placeholder="ค้นหา SO / PO / ลูกค้า"
        (change)="query.set($event.query)"
      />
      @for (o of orders(); track o.id) {
        <section class="card">
          <div class="section-heading">
            <div>
              <h2>{{ o.number }} · {{ o.customer }}</h2>
              <small>PO {{ o.po || '—' }} · กำหนดส่ง {{ o.dueDate }} · ลูกค้ายอมรับแล้ว</small>
            </div>
            <a [routerLink]="['/sales', o.quoteId]">ดูใบเสนอราคา</a>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>สินค้า</th>
                  <th class="numeric">สั่ง</th>
                  <th class="numeric">วางแผนแล้ว</th>
                  <th class="numeric">จัดสรร FG</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (l of o.lines; track l.id) {
                  <tr>
                    <td>{{ l.name }}</td>
                    <td class="numeric">{{ l.quantity }}</td>
                    <td class="numeric">{{ l.planned }}</td>
                    <td class="numeric">{{ l.allocated }}</td>
                    <td>
                      <button
                        (click)="plan(o, l)"
                        [disabled]="l.planned >= l.quantity || !session.can('Planner')"
                      >
                        ตรวจความพร้อม
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @empty {
        <div class="empty">
          <h2>ยังไม่มีคำสั่งขาย</h2>
          <p>บันทึกลูกค้ายอมรับใบเสนอราคาเพื่อส่งเข้าวางแผน</p>
          <a routerLink="/sales">ไปงานขาย →</a>
        </div>
      }
    } @else {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>WO / สินค้า</th>
              <th>Revision</th>
              <th class="numeric">จำนวน</th>
              <th>กำหนดส่ง</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (w of store.state().workOrders; track w.id) {
              <tr>
                <td>
                  <strong>{{ w.number }}</strong
                  ><small>{{ w.snapshot.name }}</small>
                </td>
                <td>{{ w.snapshot.code }} / R{{ w.snapshot.revision }}</td>
                <td class="numeric">{{ w.quantity }}</td>
                <td>{{ w.dueDate }}</td>
                <td><app-badge [value]="w.status" /></td>
                <td>
                  <div class="actions">
                    <a [routerLink]="['/inventory']" [queryParams]="{ wo: w.id }">วัสดุ</a
                    ><button (click)="print(w)">Preview ใบงาน</button>
                    @if (session.can('Planner')) {
                      <button (click)="note(w)">หมายเหตุพิมพ์</button
                      ><button (click)="cancel(w)" [disabled]="w.status !== 'Ready'">ยกเลิก</button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class Planning extends Feature {
  private fb = inject(FormBuilder);
  pdf = inject(PdfService);
  tab = signal('orders');
  planning = signal(false);
  query = signal('');
  orderId = '';
  lineId = '';
  remaining = 0;
  approved = computed(() => this.store.state().revisions.filter((r) => r.status === 'Approved'));
  orders = computed(() =>
    this.store
      .state()
      .orders.filter((o) =>
        (o.number + ' ' + o.customer + ' ' + o.po)
          .toLowerCase()
          .includes(this.query().toLowerCase()),
      ),
  );
  form = this.fb.nonNullable.group({
    revisionId: ['rev-cabinet-1', Validators.required],
    fgQuantity: [0, Validators.min(0)],
    makeQuantity: [1, Validators.min(0)],
    dueDate: ['2026-10-15', Validators.required],
    priority: ['Normal' as 'Normal' | 'High'],
    reason: [''],
  });
  available() {
    return this.store
      .state()
      .fg.filter((f) => f.revisionId === this.form.controls.revisionId.value)
      .reduce((n, f) => n + f.quantity - f.reserved, 0);
  }
  refreshQuantities() {
    if (this.orderId) {
      const fg = Math.min(this.remaining, this.available());
      this.form.patchValue({ fgQuantity: fg, makeQuantity: this.remaining - fg });
    }
  }
  plan(o: SalesOrder, l: OrderLine) {
    this.orderId = o.id;
    this.lineId = l.id;
    this.remaining = l.quantity - l.planned;
    this.form.patchValue({ revisionId: l.productRevisionId, dueDate: o.dueDate, reason: '' });
    this.refreshQuantities();
    this.planning.set(true);
    this.error.set('');
  }
  stock() {
    this.orderId = '';
    this.lineId = '';
    this.form.reset({
      revisionId: this.approved()[0]?.id ?? '',
      fgQuantity: 0,
      makeQuantity: 1,
      dueDate: '2026-10-15',
      priority: 'Normal',
      reason: 'ผลิตเติมสต็อก',
    });
    this.planning.set(true);
  }
  demand() {
    const r = this.store
      .state()
      .revisions.find((r) => r.id === this.form.controls.revisionId.value);
    return r
      ? Object.entries(materialDemand(r, this.form.controls.makeQuantity.value)).map(
          ([id, qty]) => {
            const m = this.store.state().materials.find((m) => m.id === id);
            return {
              id,
              qty,
              name: m?.code ?? id,
              onHand: m?.onHand ?? 0,
              reserved: m?.reserved ?? 0,
            };
          },
        )
      : [];
  }
  readinessErrors() {
    return readiness(
      this.store.state(),
      this.store.state().revisions.find((r) => r.id === this.form.controls.revisionId.value),
      this.form.controls.makeQuantity.value,
    );
  }
  async create() {
    const ok = await this.run('planning.create', {
      ...this.form.getRawValue(),
      orderId: this.orderId || undefined,
      lineId: this.lineId || undefined,
    });
    if (ok) {
      this.planning.set(false);
      this.tab.set('wo');
    }
  }
  async deny() {
    const reason = prompt('เหตุผลที่ยังไม่อนุญาตให้วางแผน');
    if (reason)
      await this.run('planning.deny', {
        id: this.lineId || this.form.controls.revisionId.value,
        reason,
      });
  }
  async cancel(w: WorkOrder) {
    const reason = prompt('เหตุผลยกเลิก WO');
    if (reason) await this.run('wo.cancel', { id: w.id, reason });
  }
  async note(w: WorkOrder) {
    const note = prompt('หมายเหตุสำหรับพิมพ์ (ไม่เปลี่ยน Drawing/BOM)', w.printNote);
    if (note !== null) await this.run('wo.note', { id: w.id, note });
  }
  async print(w: WorkOrder) {
    try {
      const blob = await this.pdf.make('ใบงาน ' + w.number, [
        { text: w.snapshot.name + ' / R' + w.snapshot.revision },
        { text: 'เลขแบบ ' + w.snapshot.drawingNumber },
        { text: 'Sales: ' + w.salesName },
        { text: 'จำนวน ' + w.quantity + ' · กำหนดส่ง ' + w.dueDate },
        { text: w.snapshot.spec },
        { text: w.printNote, margin: [0, 16, 0, 0] },
      ]);
      this.pdf.open(blob);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}
