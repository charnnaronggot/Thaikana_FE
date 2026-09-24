import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { documentSource, AfterSaleKind } from '../../domain/documents';
import {
  Delivery as DeliveryModel,
  DocumentRecord,
  Quotation,
  SalesOrder,
  WorkOrder,
  Payment,
} from '../../domain/models';
import type { Content } from 'pdfmake/interfaces';
import { PdfService } from '../../shared/pdf';
import { Badge, Feature, StateMessage } from '../../shared/ui';

@Component({
  imports: [ReactiveFormsModule, Badge, StateMessage],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">DOCUMENT CONTROL</p>
        <h1>เอกสาร</h1>
        <p class="muted">PDF snapshot · พิมพ์หลาย WO · เอกสารหลังขาย · ประวัติ</p>
      </div>
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (notice()) {
      <div class="notice success" role="status">{{ notice() }}</div>
    }
    @if (session.can('Sales', 'Planner', 'Delivery')) {
      <section class="card">
        <div class="section-heading"><h2>ออกเอกสาร PDF</h2></div>
        <form [formGroup]="form" (ngSubmit)="issue()">
          <div class="form-grid three">
            <label
              >ชนิดเอกสาร<select formControlName="kind" (change)="resetReference()">
                @if (session.can('Planner')) {
                  <option value="WorkOrder">ใบงานผลิต</option>
                }
                @if (session.can('Delivery')) {
                  <option value="Label">ป้ายกล่อง</option>
                }
                @if (session.can('Sales')) {
                  <option value="Invoice">Invoice</option>
                  <option value="Billing">Billing</option>
                  <option value="Receipt">Receipt</option>
                }
              </select></label
            >
            @if (form.controls.kind.value !== 'WorkOrder') {
              <label
                >อ้างอิง<select formControlName="referenceId">
                  @for (x of options(); track x.id) {
                    <option [value]="x.id">{{ x.label }}</option>
                  }
                </select></label
              >
            }
          </div>
          @if (form.controls.kind.value === 'WorkOrder') {
            <p class="muted">เลือกหลายใบเพื่อพิมพ์เป็น PDF ชุดเดียว</p>
            <div class="check-list">
              @for (w of store.state().workOrders; track w.id) {
                <label
                  ><input
                    type="checkbox"
                    [checked]="selected().includes(w.id)"
                    (change)="toggle(w.id)"
                  />{{ w.number }} · {{ w.snapshot.name }} · {{ w.quantity }} ชิ้น</label
                >
              }
            </div>
          }
          <div class="actions">
            <button class="primary" [disabled]="busy()">สร้างและเก็บ PDF</button>
          </div>
        </form>
      </section>
    }
    @if (session.can('Sales')) {
      <section class="card">
        <div class="section-heading"><h2>บันทึกรับเงิน</h2></div>
        <form [formGroup]="payment" (ngSubmit)="recordPayment()">
          <div class="form-grid three">
            <label
              >Invoice<select formControlName="invoiceId">
                @for (d of invoices(); track d.id) {
                  <option [value]="d.id">{{ d.number }} · {{ money(d.total) }}</option>
                }
              </select></label
            ><label
              >จำนวนเงิน<input
                type="number"
                min="0.01"
                step="0.01"
                formControlName="amount" /></label
            ><label>เลขอ้างอิงรับเงิน<input formControlName="reference" /></label>
          </div>
          <button class="primary" [disabled]="busy() || payment.invalid">
            บันทึกเหตุการณ์รับเงิน
          </button>
        </form>
        <p class="muted">สถานะรับเงินเกิดจากรายการบันทึกรับเงินจริงเท่านั้น</p>
      </section>
    }
    <section class="card">
      <div class="section-heading"><h2>ประวัติเอกสารที่ออกแล้ว</h2></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>เลขที่</th>
              <th>ชนิด</th>
              <th>อ้างอิง</th>
              <th>วันที่ออก</th>
              <th class="numeric">ยอด</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (d of store.state().documents; track d.id) {
              <tr>
                <td>
                  <strong>{{ d.number }}</strong>
                </td>
                <td><app-badge [value]="d.kind" /></td>
                <td>{{ d.referenceId }}</td>
                <td>{{ date(d.createdAt) }}</td>
                <td class="numeric">{{ money(d.total) }}</td>
                <td>
                  <div class="actions">
                    <button (click)="open(d)">เปิด PDF ที่ออกจริง</button
                    ><button (click)="download(d)">ดาวน์โหลด</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (!store.state().documents.length) {
        <div class="empty">ยังไม่มีเอกสาร</div>
      }
    </section>
  `,
})
export class Documents extends Feature {
  private fb = inject(FormBuilder);
  pdf = inject(PdfService);
  selected = signal<string[]>([]);
  form = this.fb.nonNullable.group({ kind: ['WorkOrder' as AfterSaleKind], referenceId: [''] });
  payment = this.fb.nonNullable.group({
    invoiceId: ['', Validators.required],
    amount: [0.01, [Validators.required, Validators.min(0.01)]],
    reference: ['', Validators.required],
  });
  constructor() {
    super();
    if (this.session.can('Sales') && !this.session.can('Planner'))
      this.form.controls.kind.setValue('Invoice');
    else if (this.session.can('Delivery') && !this.session.can('Planner'))
      this.form.controls.kind.setValue('Label');
    this.resetReference();
  }
  invoices() {
    return this.store.state().documents.filter((d) => d.kind === 'Invoice');
  }
  options() {
    const s = this.store.state(),
      kind = this.form.controls.kind.value;
    if (kind === 'Label') return s.deliveries.map((d) => ({ id: d.id, label: d.number }));
    if (kind === 'Invoice')
      return s.orders
        .filter((o) => s.deliveries.some((d) => d.orderId === o.id && d.status === 'Delivered'))
        .map((o) => ({ id: o.id, label: o.number + ' · ' + o.customer }));
    if (kind === 'Billing') return this.invoices().map((d) => ({ id: d.id, label: d.number }));
    if (kind === 'Receipt')
      return s.payments.map((p) => ({
        id: p.id,
        label:
          (this.invoices().find((d) => d.id === p.invoiceId)?.number ?? '') +
          ' · ' +
          this.money(p.amount),
      }));
    return [];
  }
  resetReference() {
    this.form.controls.referenceId.setValue(this.options()[0]?.id ?? '');
  }
  toggle(id: string) {
    this.selected.update((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  }
  rows(kind: AfterSaleKind, snapshot: unknown, total: number): Content[] {
    if (kind === 'WorkOrder')
      return (snapshot as WorkOrder[]).flatMap((w) => [
        {
          text:
            w.number +
            ' · ' +
            w.snapshot.name +
            ' / R' +
            w.snapshot.revision +
            ' · ' +
            w.quantity +
            ' ชิ้น · ' +
            w.dueDate,
          bold: true,
        },
        { text: 'Drawing ' + w.snapshot.drawingNumber + ' · ' + w.snapshot.spec },
        { text: 'หมายเหตุ ' + (w.printNote || '-'), margin: [0, 0, 0, 12] },
      ]);
    if (kind === 'Label') {
      const d = snapshot as DeliveryModel;
      return [
        { text: d.number + ' · ' + d.boxes + ' กล่อง', bold: true },
        { text: 'จัดส่งถึง ' + d.address },
        { text: 'ขนส่ง ' + d.carrier + ' / ' + d.reference },
        ...d.lines.map((l) => ({
          text: l.name + ' · ' + l.quantity + ' ชิ้น · Rev ' + l.revisionId,
        })),
      ];
    }
    if (kind === 'Invoice' || kind === 'Billing') {
      const x = snapshot as {
        order: SalesOrder;
        quotation: Quotation;
        totals: { net: number; vat: number; total: number };
      };
      return [
        { text: x.order.number + ' · PO ' + x.order.po, bold: true },
        { text: 'ลูกค้า ' + x.order.customer + ' · ' + x.order.address },
        ...x.quotation.lines.map((l) => ({
          text:
            l.name + ' · ' + l.quantity + ' ' + l.unit + ' × ' + this.money(l.unitPrice) + ' บาท',
        })),
        {
          text:
            'สุทธิ ' + this.money(x.totals.net) + ' บาท · VAT ' + this.money(x.totals.vat) + ' บาท',
          margin: [0, 12, 0, 0],
        },
        { text: 'ยอดรวม ' + this.money(total) + ' บาท', bold: true },
      ];
    }
    const x = snapshot as { payment: Payment; invoice: { order: SalesOrder } };
    return [
      { text: 'รับจาก ' + x.invoice.order.customer },
      { text: 'อ้างอิง ' + x.payment.reference + ' · ' + this.date(x.payment.at) },
      { text: 'จำนวนเงิน ' + this.money(total) + ' บาท', bold: true },
    ];
  }
  async issue() {
    const kind = this.form.controls.kind.value,
      ids = this.selected(),
      referenceId = this.form.controls.referenceId.value;
    try {
      const src = documentSource(this.store.state(), kind, referenceId, ids);
      const blob = await this.pdf.make(src.title, this.rows(kind, src.snapshot, src.total));
      const ok = await this.run('docs.issue', { kind, referenceId, ids, pdf: blob });
      if (ok) this.selected.set([]);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
  async recordPayment() {
    const ok = await this.run('payment.record', this.payment.getRawValue());
    if (ok) this.payment.patchValue({ amount: 0.01, reference: '' });
  }
  asset(d: DocumentRecord) {
    return this.store.state().assets.find((a) => a.id === d.assetId)?.blob;
  }
  open(d: DocumentRecord) {
    const blob = this.asset(d);
    if (blob) this.pdf.open(blob);
  }
  download(d: DocumentRecord) {
    const blob = this.asset(d);
    if (blob) this.pdf.download(blob, d.number + '.pdf');
  }
}
