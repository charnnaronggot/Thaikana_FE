import { CommonModule, Location } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import {
  FinanceApi,
  FinanceWorkspace,
  FinanceSources,
  FinanceInvoice,
  FinancePayment,
  FinanceBilling,
  FinanceAdjustment,
  FinanceReceipt,
  FinanceKind,
  FinanceTab,
  FinanceMutation,
  FinanceOutput,
  financeError,
  normalizeEvidence,
} from '../services/finance-api.service';
import { FinanceCommands } from '../services/finance-commands.service';
import { moneySum, moneyRemaining, validMoney } from '../models/finance-money';

type Mode =
  | 'invoice'
  | 'invoice-edit'
  | 'payment'
  | 'payment-edit'
  | 'allocate'
  | 'evidence'
  | 'billing'
  | 'adjustment'
  | 'adjustment-edit'
  | 'confirm';
type Amount = {
  id: string;
  label: string;
  version: number | string;
  available: number;
  amount: number;
  selected: boolean;
};
@Component({
  imports: [CommonModule, FormsModule, RouterLink, Drawer, StateMessage],
  templateUrl: './finance-workspace.component.html',
  styleUrl: './finance-workspace.component.scss',
})
export class FinanceWorkspacePage {
  readonly auth = inject(AuthService);
  readonly commands = inject(FinanceCommands);
  private api = inject(FinanceApi);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private owner = {};
  queue = signal<FinanceWorkspace | null>(null);
  invoice = signal<FinanceInvoice | null>(null);
  payment = signal<FinancePayment | null>(null);
  billing = signal<FinanceBilling | null>(null);
  adjustment = signal<FinanceAdjustment | null>(null);
  receipt = signal<FinanceReceipt | null>(null);
  outputs = signal<FinanceOutput[]>([]);
  outputLoading = signal(false);
  outputError = signal('');
  sources = signal<FinanceSources | null>(null);
  loading = signal(false);
  formLoading = signal(false);
  error = signal('');
  formError = signal('');
  formUnavailable = signal(false);
  notice = signal('');
  fields = signal<Record<string, string>>({});
  mode = signal<Mode | null>(null);
  discard = signal(false);
  files = signal<File[]>([]);
  tab: FinanceTab = 'invoices';
  page = 1;
  search = '';
  status = '';
  sourceSearch = '';
  allocationSearch = '';
  rows: Amount[] = [];
  model = this.empty();
  private baseline = '';
  private generation = 0;
  private viewGeneration = 0;
  private adjustmentInvoice: FinanceInvoice | null = null;
  confirmation: {
    title: string;
    message: string;
    kind: string;
    path: string;
    body: unknown;
  } | null = null;
  readonly tabs: { key: FinanceTab; label: string }[] = [
    { key: 'invoices', label: 'Invoice' },
    { key: 'outstanding', label: 'ยอดค้าง' },
    { key: 'billings', label: 'ใบวางบิล' },
    { key: 'payments', label: 'รับเงิน' },
    { key: 'receipts', label: 'ใบเสร็จ' },
    { key: 'adjustments', label: 'ลดหนี้ / เพิ่มหนี้' },
  ];
  readonly names: Record<string, string> = {
    DRAFT: 'ร่าง',
    ISSUED: 'ออกแล้ว',
    CANCELLED: 'ยกเลิก',
    CONFIRMED: 'ยืนยันแล้ว',
    REVERSED: 'ย้อนแล้ว',
    VOIDED: 'ยกเลิกใบเสร็จ',
    UNPAID: 'รอชำระ',
    PARTIAL: 'รับบางส่วน',
    PAID: 'รับครบ',
    CREDITED: 'ลดหนี้ครบ',
    CREDIT: 'ลดหนี้',
    DEBIT: 'เพิ่มหนี้',
  };
  readonly num = Number;
  constructor() {
    this.commands.attach(this.owner, async (result) => {
      const r = result as FinanceMutation;
      this.mode.set(null);
      this.files.set([]);
      this.notice.set('บันทึก ' + r.number + ' แล้ว');
      if (r.kind === 'document') {
        await this.loadOutputs();
        return;
      }
      await this.load();
      await this.open((r.kind + 's') as FinanceKind, r.id);
    });
    const params = this.route.snapshot.paramMap;
    void this.load();
    const kind = params.get('kind') as FinanceKind | null;
    const id = params.get('id');
    if (kind && id && !this.commands.pending()) void this.open(kind, id);
  }
  ngOnDestroy() {
    this.generation++;
    this.viewGeneration++;
    this.commands.detach(this.owner);
  }
  empty() {
    return {
      order: '',
      delivery: '',
      due: '',
      date: new Date().toLocaleDateString('en-CA'),
      method: 'TRANSFER',
      reference: '',
      amount: 0,
      allocation: 0,
      reason: '',
      type: 'CREDIT',
      acknowledge: false,
    };
  }
  blocked() {
    return (
      this.loading() ||
      this.formLoading() ||
      this.commands.busy() ||
      !!this.commands.pending() ||
      this.commands.uncertain()
    );
  }
  hasDetail() {
    return !!(
      this.invoice() ||
      this.payment() ||
      this.billing() ||
      this.adjustment() ||
      this.receipt()
    );
  }
  label(value: string) {
    return this.names[value] ?? value;
  }
  method(value: string) {
    return (
      (
        { TRANSFER: 'โอนเงิน', CASH: 'เงินสด', CHEQUE: 'เช็คที่รับเงินแล้ว' } as Record<
          string,
          string
        >
      )[value] ?? value
    );
  }
  ledgerType(value: string) {
    return (
      (
        {
          INVOICE: 'ออก Invoice',
          PAYMENT_CONFIRMED: 'ยืนยันรับเงินจริง',
          PAYMENT_ALLOCATED: 'จัดสรรชำระ Invoice',
          PAYMENT_REVERSED: 'ย้อนรับเงิน / การจัดสรร',
          CREDIT_NOTE: 'ออกใบลดหนี้',
          DEBIT_NOTE: 'ออกใบเพิ่มหนี้',
          ADJUSTMENT_REVERSED: 'ย้อนการปรับหนี้',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  fileSize(value: number | string) {
    const bytes = Number(value);
    return bytes < 1024
      ? bytes + ' B'
      : (bytes / 1024).toLocaleString('th-TH', { maximumFractionDigits: 1 }) + ' KB';
  }
  sourceLine(id: string) {
    return this.sources()?.lines.find((x) => x.id === id);
  }
  statuses() {
    return this.tab === 'payments'
      ? ['DRAFT', 'CONFIRMED', 'REVERSED', 'CANCELLED']
      : this.tab === 'receipts'
        ? ['ISSUED', 'VOIDED']
        : this.tab === 'adjustments' || this.tab === 'billings'
          ? ['DRAFT', 'ISSUED', 'CANCELLED']
          : ['DRAFT', 'ISSUED', 'UNPAID', 'PARTIAL', 'PAID', 'CREDITED', 'CANCELLED'];
  }
  clearDetail(updateUrl = true) {
    this.viewGeneration++;
    this.invoice.set(null);
    this.payment.set(null);
    this.billing.set(null);
    this.adjustment.set(null);
    this.receipt.set(null);
    this.outputs.set([]);
    this.outputError.set('');
    if (updateUrl) this.location.replaceState('/finance');
  }
  async changeTab(tab: FinanceTab) {
    if (this.blocked() || this.mode()) return;
    this.tab = tab;
    this.status = '';
    this.page = 1;
    this.clearDetail();
    await this.load();
  }
  async load(reset = false) {
    if (reset) this.page = 1;
    this.loading.set(true);
    this.error.set('');
    const actor = this.auth.user()?.id;
    try {
      const result = await this.api.workspace(this.tab, this.search, this.status, this.page);
      if (this.auth.user()?.id === actor) this.queue.set(result);
    } catch (e) {
      this.error.set(financeError(e));
    } finally {
      this.loading.set(false);
    }
  }
  async open(kind: FinanceKind, id: string) {
    this.loading.set(true);
    this.error.set('');
    const actor = this.auth.user()?.id;
    this.clearDetail(false);
    const generation = this.viewGeneration;
    this.location.replaceState('/finance/' + kind + '/' + id);
    try {
      if (kind === 'invoices') {
        const d = await this.api.invoice(id);
        if (this.auth.user()?.id === actor && generation === this.viewGeneration)
          this.invoice.set(d);
      } else if (kind === 'payments') {
        const d = await this.api.payment(id);
        if (this.auth.user()?.id === actor && generation === this.viewGeneration)
          this.payment.set(d);
      } else if (kind === 'billings') {
        const d = await this.api.billing(id);
        if (this.auth.user()?.id === actor && generation === this.viewGeneration)
          this.billing.set(d);
      } else if (kind === 'adjustments') {
        const d = await this.api.adjustment(id);
        if (this.auth.user()?.id === actor && generation === this.viewGeneration)
          this.adjustment.set(d);
      } else if (kind === 'receipts') {
        const d = await this.api.receipt(id);
        if (this.auth.user()?.id === actor && generation === this.viewGeneration)
          this.receipt.set(d);
      } else throw Error('ไม่พบประเภทเอกสาร');
      await this.loadOutputs();
    } catch (e) {
      if (generation === this.viewGeneration) this.error.set(financeError(e));
    } finally {
      if (generation === this.viewGeneration) this.loading.set(false);
    }
  }
  async refresh() {
    if (this.invoice()) await this.open('invoices', this.invoice()!.invoice.id);
    else if (this.payment()) await this.open('payments', this.payment()!.payment.id);
    else if (this.billing()) await this.open('billings', this.billing()!.billing.id);
    else if (this.adjustment()) await this.open('adjustments', this.adjustment()!.adjustment.id);
    else if (this.receipt()) await this.open('receipts', this.receipt()!.receipt.id);
    else await this.load();
  }
  private snapshot() {
    return JSON.stringify({
      model: this.model,
      rows: this.rows,
      files: this.files().map((f) => [f.name, f.size, f.lastModified]),
    });
  }
  private clean() {
    this.baseline = this.snapshot();
  }
  dirty() {
    return !!this.mode() && this.snapshot() !== this.baseline;
  }
  async begin(mode: Mode) {
    if (this.blocked() || this.mode()) return;
    this.model = this.empty();
    this.rows = [];
    this.files.set([]);
    this.fields.set({});
    this.formError.set('');
    this.formUnavailable.set(false);
    this.commands.clearError();
    this.confirmation = null;
    this.mode.set(mode);
    this.clean();
    const generation = ++this.generation;
    this.formLoading.set(true);
    try {
      if (mode === 'invoice' || mode === 'invoice-edit') {
        const d = mode === 'invoice-edit' ? this.invoice() : null;
        this.model.order = d?.invoice.orderId ?? '';
        this.model.delivery = d?.deliveryId ?? '';
        this.model.due = d?.invoice.dueDate ?? '';
        const sources = await this.api.sources(
          this.model.order,
          this.model.delivery,
          d?.invoice.id ?? '',
        );
        if (generation !== this.generation) return;
        this.sources.set(sources);
        this.sourceRows();
        if (d)
          for (const row of this.rows) {
            const old = d.items.find((x) => x.orderItemId === row.id);
            if (old) {
              row.selected = true;
              row.amount = Number(old.quantity);
            }
          }
      } else if (mode === 'payment' || mode === 'billing') {
        const d = this.invoice()!;
        this.model.due = d.invoice.dueDate;
        this.model.amount = Number(d.invoice.outstanding);
        this.model.allocation = this.model.amount;
        this.rows = [
          {
            id: d.invoice.id,
            label: d.invoice.number,
            version: d.invoice.version,
            available: Number(d.invoice.outstanding),
            amount: Number(d.invoice.outstanding),
            selected: true,
          },
        ];
      } else if (mode === 'payment-edit') {
        const d = this.payment()!;
        this.model.amount = Number(d.payment.amount);
        this.model.date = d.payment.paymentDate;
        this.model.method = d.payment.method;
        this.model.reference = d.payment.reference;
        this.rows = d.allocations.map((x) => ({
          id: x.invoiceId,
          label: x.invoiceNo,
          version: x.currentInvoiceVersion,
          available: Number(x.currentOutstanding),
          amount: Number(x.amount),
          selected: true,
        }));
      } else if (mode === 'allocate') {
        const choices = await this.api.workspace('outstanding', '', '', 1, 50);
        if (generation !== this.generation) return;
        this.rows = choices.invoices
          .filter((x) => x.customerId === this.payment()!.payment.customerId)
          .map((x) => ({
            id: x.id,
            label: x.number,
            version: x.version,
            available: Number(x.outstanding),
            amount: 0,
            selected: false,
          }));
      } else if (mode === 'adjustment' || mode === 'adjustment-edit') {
        const a = mode === 'adjustment-edit' ? this.adjustment() : null;
        const d = a ? await this.api.invoice(a.adjustment.invoiceId) : this.invoice()!;
        if (generation !== this.generation) return;
        if (a) {
          this.model.type = a.adjustment.type;
          this.model.reason = a.adjustment.reason;
        }
        this.adjustmentInvoice = d;
        this.rows = d.items.map((x) => {
          const old = a?.items.find((l) => l.invoiceItemId === x.id);
          return {
            id: x.id,
            label: x.product,
            version: d.invoice.version,
            available: Number(x.net),
            amount: Number(old?.net ?? 0),
            selected: !!old,
          };
        });
      }
      this.clean();
    } catch (e) {
      if (generation === this.generation) this.formError.set(financeError(e));
    } finally {
      if (generation === this.generation) this.formLoading.set(false);
    }
  }
  private sourceRows() {
    this.rows = (this.sources()?.lines ?? []).map((x) => ({
      id: x.id,
      label: x.product + ' · ' + x.revision + ' · ' + x.unit,
      version: this.sources()!.sourceVersion ?? 0,
      available: Number(x.available),
      amount: 0,
      selected: false,
    }));
  }
  async chooseSource() {
    const generation = ++this.generation;
    this.formLoading.set(true);
    this.formError.set('');
    try {
      const s = await this.api.sources(
        this.model.order,
        this.model.delivery,
        this.mode() === 'invoice-edit' ? this.invoice()!.invoice.id : '',
        this.sourceSearch,
      );
      if (generation !== this.generation) return;
      this.sources.set(s);
      this.sourceRows();
    } catch (e) {
      if (generation === this.generation) this.formError.set(financeError(e));
    } finally {
      if (generation === this.generation) this.formLoading.set(false);
    }
  }
  chooseOrder() {
    this.model.delivery = '';
    void this.chooseSource();
  }
  async searchOrders() {
    if (this.model.order) return;
    await this.chooseSource();
  }
  async searchAllocations() {
    const generation = ++this.generation;
    this.formLoading.set(true);
    try {
      const result = await this.api.workspace('outstanding', this.allocationSearch, '', 1, 50);
      if (generation !== this.generation) return;
      const existing = this.rows.filter((x) => x.selected);
      const customer = this.payment()?.payment.customerId ?? this.invoice()?.invoice.customerId;
      const matches = result.invoices
        .filter((x) => x.customerId === customer && !existing.some((e) => e.id === x.id))
        .map((x) => ({
          id: x.id,
          label: x.number,
          version: x.version,
          available: Number(x.outstanding),
          amount: this.mode() === 'billing' ? Number(x.outstanding) : 0,
          selected: false,
        }));
      this.rows = [...existing, ...matches];
    } catch (e) {
      this.formError.set(financeError(e));
    } finally {
      if (generation === this.generation) this.formLoading.set(false);
    }
  }
  selected() {
    return this.rows.filter((x) => x.selected);
  }
  allocated() {
    return moneySum(this.selected().map((x) => Number(x.amount || 0)));
  }
  unallocated() {
    return moneyRemaining(this.model.amount, this.allocated());
  }
  private validate() {
    const errors: Record<string, string> = {};
    const mode = this.mode();
    if (mode === 'invoice' || mode === 'invoice-edit') {
      if (!this.model.order) errors['order'] = 'เลือก SO ต้นทาง';
      if (!this.model.due) errors['due'] = 'ระบุวันครบกำหนดชำระ';
    }
    if (
      ['invoice', 'invoice-edit', 'billing', 'adjustment', 'adjustment-edit', 'allocate'].includes(
        mode ?? '',
      ) &&
      !this.selected().length
    )
      errors['rows'] = 'เลือกรายการอย่างน้อยหนึ่งรายการ';
    for (const row of this.selected())
      if (
        !Number.isFinite(Number(row.amount)) ||
        Number(row.amount) <= 0 ||
        (!['adjustment', 'adjustment-edit', 'billing'].includes(mode ?? '') &&
          Number(row.amount) > row.available)
      )
        errors[row.id] = 'ระบุยอดมากกว่า 0 และไม่เกินยอดคงเหลือ';
    if (mode === 'payment' || mode === 'payment-edit') {
      if (!this.model.date) errors['date'] = 'ระบุวันรับเงินจริง';
      if (!this.model.reference.trim())
        errors['reference'] = 'ระบุเลขอ้างอิงธนาคารหรือเลขที่รับเงินสด';
      if (!Number.isFinite(this.model.amount) || this.model.amount <= 0)
        errors['amount'] = 'ระบุเงินรับจริงมากกว่า 0';
      if (!validMoney(this.model.amount))
        errors['amount'] = 'ระบุเงินรับจริงมากกว่า 0 และไม่เกินสองทศนิยม';
      if (this.allocated() > this.model.amount) errors['rows'] = 'ยอดจัดสรรเกินเงินรับจริง';
    }
    if (mode === 'allocate' && this.allocated() > Number(this.payment()!.payment.unallocated))
      errors['rows'] = 'ยอดจัดสรรเกินเงินที่ยังไม่จัดสรร';
    if (
      ['payment', 'payment-edit', 'allocate', 'adjustment', 'adjustment-edit'].includes(mode ?? '')
    )
      for (const row of this.selected())
        if (!validMoney(Number(row.amount)))
          errors[row.id] = 'ระบุยอดมากกว่า 0 และไม่เกินสองทศนิยม';
    if ((mode === 'adjustment' || mode === 'adjustment-edit') && !this.model.reason.trim())
      errors['reason'] = 'ระบุเหตุผลของการลดหนี้หรือเพิ่มหนี้';
    if (mode === 'evidence' && !this.files().length) errors['files'] = 'เลือกหลักฐานรับเงินจริง';
    if (mode === 'confirm') {
      if (!this.model.acknowledge) errors['acknowledge'] = 'ตรวจข้อมูลและยืนยันก่อนดำเนินการ';
      if (this.confirmation?.kind.match(/cancel|reverse/) && !this.model.reason.trim())
        errors['reason'] = 'ระบุเหตุผลเพื่อเก็บประวัติ';
    }
    this.fields.set(errors);
    return Object.keys(errors).length === 0;
  }
  async reloadForm() {
    if (this.commands.busy() || this.commands.pending() || this.formLoading()) return;
    const mode = this.mode();
    if (!mode) return;
    const generation = ++this.generation;
    this.formLoading.set(true);
    this.formError.set('');
    this.formUnavailable.set(false);
    try {
      if (mode === 'invoice' || mode === 'invoice-edit') {
        if (mode === 'invoice-edit') await this.refresh();
        const sources = await this.api.sources(
          this.model.order,
          this.model.delivery,
          mode === 'invoice-edit' ? this.invoice()!.invoice.id : '',
        );
        if (generation !== this.generation) return;
        const previous = this.rows;
        this.sources.set(sources);
        this.sourceRows();
        for (const row of this.rows) {
          const old = previous.find((x) => x.id === row.id);
          if (old) {
            row.selected = old.selected;
            row.amount = old.amount;
          }
        }
        if (mode === 'invoice-edit' && this.invoice()?.invoice.status !== 'DRAFT')
          this.formUnavailable.set(true);
      } else {
        await this.refresh();
        if (generation !== this.generation) return;
        if (mode === 'confirm' && this.confirmation) {
          const kind = this.confirmation.kind;
          const target = kind.startsWith('invoice_')
            ? this.invoice()?.invoice
            : kind.startsWith('payment_')
              ? this.payment()?.payment
              : kind.startsWith('billing_')
                ? this.billing()?.billing
                : this.adjustment()?.adjustment;
          if (!target) throw Error('โหลดเอกสารไม่ได้ กรุณาปิดหน้าต่างและตรวจสิทธิ์อีกครั้ง');
          this.confirmation.body = { expectedVersion: target.version };
          this.model.acknowledge = false;
          const required =
            kind === 'payment_reverse'
              ? 'CONFIRMED'
              : kind === 'adjustment_reverse'
                ? 'ISSUED'
                : kind === 'billing_cancel'
                  ? null
                  : 'DRAFT';
          if (
            (required && target.status !== required) ||
            target.status === 'CANCELLED' ||
            target.status === 'REVERSED'
          )
            this.formUnavailable.set(true);
        } else if (['payment', 'payment-edit', 'allocate', 'billing'].includes(mode)) {
          for (const row of this.rows) {
            const d = await this.api.invoice(row.id);
            if (generation !== this.generation) return;
            row.version = d.invoice.version;
            row.available = Number(d.invoice.outstanding);
          }
          if (
            (mode === 'payment-edit' && this.payment()?.payment.status !== 'DRAFT') ||
            (mode === 'allocate' && this.payment()?.payment.status !== 'CONFIRMED')
          )
            this.formUnavailable.set(true);
        } else if (mode === 'adjustment' || mode === 'adjustment-edit') {
          this.adjustmentInvoice =
            mode === 'adjustment-edit'
              ? await this.api.invoice(this.adjustment()!.adjustment.invoiceId)
              : this.invoice();
          if (mode === 'adjustment-edit' && this.adjustment()?.adjustment.status !== 'DRAFT')
            this.formUnavailable.set(true);
        } else if (mode === 'evidence' && this.payment()?.payment.status !== 'DRAFT')
          this.formUnavailable.set(true);
      }
      if (generation !== this.generation) return;
      this.commands.clearError();
      if (this.formUnavailable())
        this.formError.set(
          'สถานะเอกสารเปลี่ยนแล้ว ปิดหน้าต่างและเปิดเอกสารปัจจุบันก่อนทำรายการต่อ',
        );
      else this.notice.set('โหลดข้อมูลล่าสุดแล้ว ร่างเดิมยังอยู่ กรุณาตรวจยอดและยืนยันอีกครั้ง');
    } catch (e) {
      if (generation === this.generation) this.formError.set(financeError(e));
    } finally {
      if (generation === this.generation) this.formLoading.set(false);
    }
  }
  async save() {
    if (this.blocked() || this.formUnavailable() || !this.validate()) return;
    let kind = '',
      path = '',
      body: unknown = {};
    const m = this.mode();
    const i = m === 'adjustment-edit' ? this.adjustmentInvoice : this.invoice();
    const p = this.payment();
    const invoiceItems = this.selected().map((x) => ({
      salesOrderItemId: x.id,
      quantity: Number(x.amount),
    }));
    const allocations = this.selected().map((x) => ({
      invoiceId: x.id,
      expectedVersion: x.version,
      amount: Number(x.amount),
    }));
    if (m === 'invoice' || m === 'invoice-edit') {
      kind = m === 'invoice' ? 'invoice_create' : 'invoice_edit';
      path = m === 'invoice' ? '/invoices' : `/invoices/${i!.invoice.id}/draft`;
      body = {
        ...(m === 'invoice'
          ? { salesOrderId: this.model.order, deliveryId: this.model.delivery || null }
          : { expectedVersion: i!.invoice.version }),
        expectedSourceVersion: this.sources()!.sourceVersion,
        dueDate: this.model.due,
        items: invoiceItems,
      };
    } else if (m === 'payment' || m === 'payment-edit') {
      kind = m === 'payment' ? 'payment_create' : 'payment_edit';
      path = m === 'payment' ? '/payments' : `/payments/${p!.payment.id}/draft`;
      body = {
        ...(m === 'payment'
          ? { customerId: i!.invoice.customerId }
          : { expectedVersion: p!.payment.version }),
        paymentDate: this.model.date,
        method: this.model.method,
        reference: this.model.reference.trim(),
        amount: this.model.amount,
        allocations,
      };
    } else if (m === 'allocate') {
      kind = 'payment_allocate';
      path = `/payments/${p!.payment.id}/allocate`;
      body = { expectedVersion: p!.payment.version, allocations };
    } else if (m === 'evidence') {
      kind = 'payment_evidence';
      path = `/payments/${p!.payment.id}/evidence`;
      body = { expectedVersion: p!.payment.version };
    } else if (m === 'billing') {
      kind = 'billing_create';
      path = '/billings';
      body = {
        dueDate: this.model.due || null,
        invoices: this.selected().map((x) => ({ invoiceId: x.id, expectedVersion: x.version })),
      };
    } else if (m === 'adjustment' || m === 'adjustment-edit') {
      kind = m === 'adjustment' ? 'adjustment_create' : 'adjustment_edit';
      path =
        m === 'adjustment'
          ? '/adjustments'
          : `/adjustments/${this.adjustment()!.adjustment.id}/draft`;
      body = {
        ...(m === 'adjustment'
          ? { invoiceId: i!.invoice.id, type: this.model.type }
          : { expectedVersion: this.adjustment()!.adjustment.version }),
        expectedInvoiceVersion: i!.invoice.version,
        reason: this.model.reason.trim(),
        items: this.selected().map((x) => ({ invoiceItemId: x.id, netAmount: Number(x.amount) })),
      };
    } else if (m === 'confirm' && this.confirmation) {
      kind = this.confirmation.kind;
      path = this.confirmation.path;
      body = {
        ...(this.confirmation.body as object),
        ...(kind.match(/cancel|reverse/) ? { reason: this.model.reason.trim() } : {}),
      };
    }
    if (!kind) return;
    await this.commands.run('finance.' + kind, '/finance' + path, body, this.files(), this.title());
  }
  async action(
    title: string,
    message: string,
    kind: string,
    path: string,
    version: number | string,
  ) {
    await this.begin('confirm');
    if (this.mode() !== 'confirm') return;
    this.confirmation = { title, message, kind, path, body: { expectedVersion: version } };
    this.clean();
  }
  title() {
    return this.mode() === 'confirm'
      ? (this.confirmation?.title ?? 'ยืนยันรายการ')
      : ((
          {
            invoice: 'สร้างร่าง Invoice',
            'invoice-edit': 'แก้ร่าง Invoice',
            payment: 'เตรียมรับเงิน',
            'payment-edit': 'แก้ร่างรับเงิน',
            allocate: 'จัดสรรเงินรับแล้ว',
            evidence: 'แนบหลักฐานรับเงิน',
            billing: 'สร้างร่างใบวางบิล',
            adjustment: 'เตรียมลดหนี้ / เพิ่มหนี้',
            'adjustment-edit': 'แก้ร่างลดหนี้ / เพิ่มหนี้',
          } as Record<string, string>
        )[this.mode() ?? ''] ?? '');
  }
  close() {
    if (this.commands.busy()) return;
    if (this.commands.pending()) {
      this.abandon();
      return;
    }
    if (this.dirty()) this.discard.set(true);
    else this.abandon();
  }
  abandon() {
    this.generation++;
    this.formLoading.set(false);
    this.mode.set(null);
    this.discard.set(false);
    this.files.set([]);
    this.confirmation = null;
  }
  canLeave() {
    if (this.commands.busy()) return false;
    if (this.dirty() && !this.commands.pending()) {
      this.discard.set(true);
      return false;
    }
    return true;
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() && !this.commands.pending()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  selectFiles(event: Event) {
    this.files.set(
      Array.from((event.target as HTMLInputElement).files ?? []).map(normalizeEvidence),
    );
  }
  recoverFiles(event: Event) {
    void this.commands.reselect(Array.from((event.target as HTMLInputElement).files ?? []));
  }
  documentSource() {
    const a = this.adjustment();
    if (a)
      return {
        kind: 'adjustment',
        id: a.adjustment.id,
        version: a.adjustment.version,
        ready: a.adjustment.status === 'ISSUED',
        canManage: this.auth.has('document.manage'),
      };
    const i = this.invoice();
    if (i)
      return {
        kind: 'invoice',
        id: i.invoice.id,
        version: i.invoice.version,
        ready: i.invoice.status === 'ISSUED',
        canManage: this.auth.has('document.manage'),
      };
    const b = this.billing();
    if (b)
      return {
        kind: 'billing',
        id: b.billing.id,
        version: b.billing.version,
        ready: b.billing.status === 'ISSUED',
        canManage: this.auth.has('document.manage'),
      };
    const r = this.receipt();
    if (r)
      return {
        kind: 'receipt',
        id: r.receipt.id,
        version: r.receipt.version,
        ready: true,
        canManage: this.auth.has('document.manage'),
      };
    return null;
  }
  async loadOutputs() {
    const source = this.documentSource();
    if (!source) return;
    this.outputLoading.set(true);
    this.outputError.set('');
    try {
      const list = await this.api.outputs(source.kind, source.id);
      if (this.documentSource()?.id === source.id) this.outputs.set(list);
    } catch (e) {
      this.outputError.set(financeError(e));
    } finally {
      this.outputLoading.set(false);
    }
  }
  async requestPdf() {
    const source = this.documentSource();
    if (!source || this.blocked()) return;
    await this.commands.run(
      'finance.document_request',
      `/finance/documents/${source.kind}/${source.id}`,
      { expectedVersion: source.version },
      [],
      'สร้าง PDF การเงิน',
      source.id,
    );
  }
  async retryPdf(output: FinanceOutput) {
    const source = this.documentSource();
    if (!source || this.blocked()) return;
    await this.commands.run(
      'finance.document_retry',
      `/finance/documents/${output.id}/retry`,
      { expectedVersion: source.version },
      [],
      'ลองสร้าง PDF เดิม',
      source.id,
    );
  }
  async download(id: string, name: string) {
    try {
      const blob = await this.api.file(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      this.error.set(financeError(e));
    }
  }
}
