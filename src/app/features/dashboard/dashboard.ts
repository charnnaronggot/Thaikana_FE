import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge, Feature } from '../../shared/ui';
import { dashboardMetrics, progress, searchRecords } from '../../domain/dashboard';
import { SalesOrder } from '../../domain/models';
@Component({
  imports: [RouterLink, Badge],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">THAIKANA / OVERVIEW</p>
        <h1>ภาพรวมงานผลิต</h1>
        <p class="muted">ความคืบหน้าหลายสินค้าและหลาย WO จากข้อมูล Demo ชุดเดียวกัน</p>
      </div>
    </div>
    <section class="card">
      <label
        >ค้นหาทั้งระบบ<input
          type="search"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
          placeholder="เลขใบเสนอราคา, PO, WO, สินค้า, วัสดุ, Barcode..."
      /></label>
      @if (query().trim()) {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>เลขที่ / รหัส</th>
                <th>รายละเอียด</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (h of hits(); track h.kind + h.id) {
                <tr>
                  <td><app-badge [value]="h.kind" /></td>
                  <td>
                    <strong>{{ h.title }}</strong>
                  </td>
                  <td>{{ h.detail }}</td>
                  <td><a [routerLink]="h.route">เปิด →</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!hits().length) {
          <div class="empty">ไม่พบข้อมูลที่ตรงกัน</div>
        }
      }
    </section>
    <div class="metrics">
      <a routerLink="/sales" class="metric card"
        ><span>ใบเสนอราคาค้าง</span><strong>{{ metrics().openQuotes }}</strong></a
      ><a routerLink="/production" class="metric card"
        ><span>WO กำลังดำเนินการ</span><strong>{{ metrics().activeWo }}</strong></a
      ><a routerLink="/qc" class="metric card"
        ><span>รอตรวจ QC</span><strong>{{ metrics().qcQueue }}</strong></a
      ><a routerLink="/delivery" class="metric card"
        ><span>FG พร้อมส่ง</span><strong>{{ metrics().readyDispatch }}</strong></a
      >
    </div>
    <div class="metrics">
      <a routerLink="/planning" class="metric card"
        ><span>WO เกินกำหนด</span><strong>{{ metrics().overdueWo }}</strong></a
      ><a routerLink="/inventory" class="metric card"
        ><span>วัสดุต่ำกว่าจุดสั่งซื้อ</span><strong>{{ metrics().materialShortage }}</strong></a
      ><a routerLink="/qc" class="metric card"
        ><span>QC ไม่ผ่าน</span><strong>{{ metrics().qcFailed }}</strong></a
      ><a routerLink="/delivery" class="metric card"
        ><span>ส่งถึงแล้ว</span><strong>{{ metrics().delivered }}</strong></a
      >
    </div>
    <section class="card">
      <div class="section-heading"><h2>คำสั่งขายและความคืบหน้า</h2></div>
      @for (o of store.state().orders; track o.id) {
        <div class="section-heading">
          <div>
            <h3>{{ o.number }} · {{ o.customer }}</h3>
            <p class="muted">PO {{ o.po }} · {{ o.dueDate }}</p>
          </div>
          <app-badge [value]="status(o)" />
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th class="numeric">สั่ง</th>
                <th class="numeric">WO</th>
                <th class="numeric">กำลังผลิต</th>
                <th class="numeric">รอ QC</th>
                <th class="numeric">รับ FG</th>
                <th class="numeric">จัดสรร</th>
                <th class="numeric">ส่ง</th>
                <th class="numeric">รับแล้ว</th>
              </tr>
            </thead>
            <tbody>
              @for (p of progress(o); track p.id) {
                <tr>
                  <td>{{ p.name }}</td>
                  <td class="numeric">{{ p.ordered }}</td>
                  <td class="numeric">{{ p.woCount }}</td>
                  <td class="numeric">{{ p.inProduction }}</td>
                  <td class="numeric">{{ p.qcPending }}</td>
                  <td class="numeric">{{ p.fgReceived }}</td>
                  <td class="numeric">{{ p.allocated }}</td>
                  <td class="numeric">{{ p.dispatched }}</td>
                  <td class="numeric">{{ p.delivered }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @empty {
        <div class="empty">ยังไม่มีคำสั่งขาย <a routerLink="/sales">สร้างใบเสนอราคา →</a></div>
      }
    </section>
  `,
})
export class Dashboard extends Feature {
  query = signal('');
  metrics = computed(() => dashboardMetrics(this.store.state()));
  hits = computed(() => searchRecords(this.store.state(), this.query()));
  progress(o: SalesOrder) {
    return progress(this.store.state(), o);
  }
  status(o: SalesOrder) {
    return o.lines.every((l) => l.delivered === l.quantity)
      ? 'Delivered'
      : o.lines.some((l) => l.dispatched)
        ? 'Partial'
        : 'Pending';
  }
}
