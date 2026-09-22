import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Badge, Feature, Overlay, StateMessage } from '../../shared/ui';
import { ListFilter } from '../../shared/list-filter';
import { PdfService } from '../../shared/pdf';
import { Quotation, QuoteLine } from '../../domain/models';
import { priceLine, quoteTotals } from '../../domain/money';
@Component({
  imports: [ReactiveFormsModule, RouterLink, Badge, Overlay, StateMessage, ListFilter],
  templateUrl: './sales.html',
})
export class Sales extends Feature {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  pdf = inject(PdfService);
  params = toSignal(this.route.paramMap);
  selected = computed(() =>
    this.store.state().quotations.find((q) => q.id === this.params()?.get('id')),
  );
  isNew = computed(() => this.params()?.get('id') === 'new');
  filter = signal({ query: '', status: '' });
  rows = computed(() =>
    this.store
      .state()
      .quotations.filter(
        (q) =>
          (q.number + ' ' + q.customer + ' ' + q.po)
            .toLowerCase()
            .includes(this.filter().query.toLowerCase()) &&
          (!this.filter().status ||
            q.status === this.filter().status ||
            q.decision === this.filter().status),
      )
      .slice()
      .reverse(),
  );
  form = this.fb.nonNullable.group({
    customer: ['', Validators.required],
    contact: [''],
    address: [''],
    dueDate: ['2026-10-15', Validators.required],
    validUntil: ['2026-10-01', Validators.required],
  });
  drawer = signal(false);
  editing: string | undefined;
  line = this.fb.group({
    kind: this.fb.nonNullable.control<'Existing' | 'MadeToOrder'>('MadeToOrder'),
    productRevisionId: this.fb.control<string | null>(null),
    name: this.fb.nonNullable.control('', Validators.required),
    category: this.fb.nonNullable.control('เฟอร์นิเจอร์สแตนเลส'),
    quantity: this.fb.nonNullable.control(1, [Validators.required, Validators.min(0.001)]),
    unit: this.fb.nonNullable.control('ชิ้น', Validators.required),
    spec: this.fb.nonNullable.control(''),
    finish: this.fb.nonNullable.control('Hairline'),
    requirement: this.fb.nonNullable.control(''),
    unitPrice: this.fb.control<number | null>(null),
    discount: this.fb.nonNullable.control(0, [Validators.min(0), Validators.max(100)]),
  });
  lineValues = toSignal(this.line.valueChanges);
  priceMethod = signal('manual');
  markup = signal(30);
  decision = signal(false);
  response = this.fb.nonNullable.group({
    decision: ['Accepted' as 'Accepted' | 'Rejected' | 'Expired'],
    evidence: [''],
    po: [''],
    reason: [''],
  });
  revision = signal(false);
  revisionLines = signal<string[]>([]);
  revisionReason = this.fb.nonNullable.control('');
  approved = computed(() => this.store.state().revisions.filter((r) => r.status === 'Approved'));
  history = computed(() =>
    this.store.state().quotations.filter((q) => q.number === this.selected()?.number),
  );
  totals = quoteTotals;
  lineTotal = priceLine;
  cost(l: QuoteLine) {
    return this.store.state().revisions.find((r) => r.id === l.productRevisionId)?.cost ?? null;
  }
  preview() {
    this.lineValues();
    return priceLine(
      this.line.getRawValue(),
      this.store.state().revisions.find((r) => r.id === this.line.controls.productRevisionId.value)
        ?.cost ?? null,
    );
  }
  async create() {
    if (this.form.invalid) return;
    const id = await this.run<string>('quote.save', this.form.getRawValue());
    if (id) {
      this.form.markAsPristine();
      await this.router.navigate(['/sales', id]);
    }
  }
  openLine(l?: QuoteLine) {
    this.editing = l?.id;
    this.error.set('');
    this.line.reset(
      l ?? {
        kind: 'MadeToOrder',
        productRevisionId: null,
        name: '',
        category: 'เฟอร์นิเจอร์สแตนเลส',
        quantity: 1,
        unit: 'ชิ้น',
        spec: '',
        finish: 'Hairline',
        requirement: '',
        unitPrice: null,
        discount: 0,
      },
    );
    this.drawer.set(true);
  }
  chooseProduct(e: Event) {
    const r = this.store
      .state()
      .revisions.find((r) => r.id === (e.target as HTMLSelectElement).value);
    if (r)
      this.line.patchValue({
        productRevisionId: r.id,
        name: r.name,
        spec: r.spec,
        kind: 'Existing',
      });
  }
  closeLine() {
    if (this.confirmClose(this.line.dirty)) this.drawer.set(false);
  }
  async saveLine(another = false) {
    if (this.line.invalid) return;
    const ok = await this.run('quote.line', {
      quoteId: this.selected()!.id,
      line: { ...this.line.getRawValue(), id: this.editing ?? '' },
    });
    if (ok) {
      this.line.markAsPristine();
      if (another) this.openLine();
      else this.drawer.set(false);
    }
  }
  async sendDesign() {
    await this.run('quote.design', { id: this.selected()!.id });
  }
  async remove(l: QuoteLine) {
    if (confirm('ลบ ' + l.name + '?'))
      await this.run('quote.removeLine', { quoteId: this.selected()!.id, lineId: l.id });
  }
  async issue() {
    const q = this.selected()!;
    this.busy.set(true);
    this.error.set('');
    try {
      const blob = await this.pdf.make(q.number + ' / R' + q.revision, [
        { text: 'ลูกค้า: ' + q.customer },
        { text: 'วันหมดอายุ: ' + q.validUntil, margin: [0, 0, 0, 12] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              ['สินค้า / แบบ', 'จำนวน', 'ราคา', 'ยอดสุทธิ'],
              ...q.lines.map((l) => [
                l.name +
                  '\n' +
                  (this.store.state().revisions.find((r) => r.id === l.productRevisionId)
                    ?.drawingNumber ?? ''),
                l.quantity,
                this.money(l.unitPrice),
                this.money(priceLine(l).net),
              ]),
            ],
          },
        },
        {
          text:
            'รวมก่อน VAT ' +
            this.money(quoteTotals(q.lines, q.vatRate).net) +
            ' · รวมสุทธิ ' +
            this.money(quoteTotals(q.lines, q.vatRate).total),
          margin: [0, 15, 0, 0],
        },
      ]);
      this.busy.set(false);
      await this.run('quote.issue', { id: q.id, pdf: blob });
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
  viewPdf() {
    const d = this.store
      .state()
      .documents.find((d) => d.referenceId === this.selected()?.id && d.kind === 'Quotation');
    const a = this.store.state().assets.find((a) => a.id === d?.assetId);
    if (a) this.pdf.open(a.blob);
  }
  async recordDecision() {
    const ok = await this.run('quote.decision', {
      id: this.selected()!.id,
      ...this.response.getRawValue(),
    });
    if (ok) this.decision.set(false);
  }
  toggleRevision(id: string) {
    this.revisionLines.update((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }
  async revise(kind: 'price' | 'design') {
    const id = await this.run<string>('quote.revise', {
      id: this.selected()!.id,
      kind,
      lineIds: this.revisionLines(),
      reason: this.revisionReason.value,
    });
    if (id) {
      this.revision.set(false);
      await this.router.navigate(['/sales', id]);
    }
  }
  applyMarkup() {
    const c = this.store
      .state()
      .revisions.find((r) => r.id === this.line.controls.productRevisionId.value)?.cost;
    if (c != null)
      this.line.controls.unitPrice.setValue(Math.round(c * (1 + this.markup() / 100) * 100) / 100);
  }
}
