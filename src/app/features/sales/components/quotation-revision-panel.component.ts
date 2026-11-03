import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DocumentExport } from '../../../shared/components/document-export.component';
import { RevisionRow } from '../../../shared/components/revision-row.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient, problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { WorkflowGuide } from '../../../shared/components/workflow-guide.component';
import { FilePreview } from '../../../shared/components/file-preview.component';
import { lineProgress, quoteExpired, suggestedProduct, workflowGuidance } from '../models/workflow';
import { businessDateInput } from '../../../shared/utils/business-date';
import { MutationSession } from '../../../shared/utils/mutation-session';
import {
  CostSuggestion,
  lineStatus,
  lineStatusLabels,
  markedUpPrice,
  overheadFromPercent,
  prefillCosts,
  pricingPreview,
  quotationSummary,
} from '../models/pricing';
import { SettingsApi } from '../../settings/settings-api.service';
import {
  LineDesignChange,
  ManagedFile,
  PriceLine,
  ProductRevision,
  Quotation,
  QuotationRevision,
  SalesOrder,
} from '../models/sales-api.models';
@Component({
  selector: 'app-quotation-revisions',
  imports: [
    FormsModule,
    DecimalPipe,
    DatePipe,
    StateMessage,
    RevisionRow,
    DocumentExport,
    Drawer,
    WorkflowGuide,
    FilePreview,
  ],
  providers: [MutationSession],
  templateUrl: './quotation-revision-panel.component.html',
  styles: `
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    .revision-line {
      border-top: 1px solid var(--border);
      padding: 16px 0;
    }
    .revision-history {
      display: grid;
      gap: 12px;
      margin-top: 24px;
    }
    .snapshot-line {
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .requirement-change {
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin: 16px 0;
    }
    .change-history {
      margin-top: 24px;
      overflow-wrap: anywhere;
    }
    .change-history article {
      padding: 12px 0;
      border-top: 1px solid var(--border);
    }
    .pricing-section {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface, #f7f9fc);
      min-width: 0;
    }
    .pricing-section h4 {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 500;
    }
    .cost-summary h4 {
      color: var(--primary);
    }
    .material-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 6px 12px;
      padding: 12px 0;
      border-top: 1px solid var(--border);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .material-row small {
      grid-column: 1 / -1;
    }
    .selling-price h4 {
      color: #177245;
    }
    .profit-preview h4 {
      color: #966000;
    }
    .pricing-section dl {
      margin: 10px 0 0;
      font-size: 12px;
    }
    .pricing-section dl div {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
    }
    .pricing-section dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .pricing-section .total {
      border-top: 1px solid var(--border);
      margin-top: 6px;
      padding-top: 8px;
      font-weight: 600;
    }
    .pricing-section small {
      display: block;
      overflow-wrap: anywhere;
      font-size: 11px;
    }
    .price-total {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
    }
    .line-heading,
    .cost-heading,
    .pricing-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .line-heading strong {
      font-size: 14px;
    }
    .line-heading p {
      margin: 4px 0;
      font-size: 12px;
      color: var(--muted);
    }
    .line-state {
      padding: 4px 8px;
      border-radius: 5px;
      background: #edf2fa;
      color: var(--primary);
      font-size: 11px;
    }
    .line-state.ready {
      color: #966000;
      background: #fff4d6;
    }
    .line-state.priced {
      color: #177245;
      background: #e4f4ec;
    }
    .line-state.pending {
      color: #5b6676;
      background: #eef0f3;
    }
    .heading-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .material-cost {
      font-size: 12px;
    }
    .cost-source {
      font-size: 11px;
      color: var(--primary);
      margin: 0;
      overflow-wrap: anywhere;
    }
    .below-cost {
      color: #b42318;
      background: #fdecea;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      margin: 8px 0 0;
    }
    .quote-summary {
      margin-top: 16px;
      padding: 12px;
      border: 1px solid var(--primary);
      border-radius: 8px;
      min-width: 0;
    }
    .quote-summary h4 {
      margin: 0 0 8px;
      font-size: 13px;
      color: var(--primary);
    }
    .quote-summary dl {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px 16px;
      margin: 0;
      font-size: 12px;
    }
    .quote-summary dd {
      margin: 2px 0 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .quote-summary .below-cost,
    .quote-summary .not-ready {
      padding: 4px 6px;
      margin: 0;
    }
    .quote-summary .not-ready {
      color: #966000;
    }
    .valid-until {
      font-size: 12px;
      max-width: 220px;
    }
    .handoff-list {
      padding-left: 20px;
      overflow-wrap: anywhere;
    }
    .next-action {
      font-size: 12px;
      color: var(--muted);
      margin: 0;
    }
    .pricing-actions {
      margin: 12px 0;
    }
    .pricing-actions p {
      font-size: 12px;
      margin: 0;
      color: var(--muted);
    }
    details {
      margin-top: 10px;
    }
    summary {
      cursor: pointer;
      font-size: 12px;
      color: var(--primary);
      padding: 6px 0;
    }
    .latest-document {
      border-top: 1px solid var(--border);
      margin-top: 20px;
      padding-top: 16px;
    }
    .history-block {
      margin-top: 20px;
    }
    .change-link {
      justify-self: start;
      font-size: 12px;
      background: transparent;
      border: 0;
      color: var(--muted);
      padding: 4px 0;
    }
    .edit-notice {
      padding: 10px 12px;
      background: #fff8e7;
      border-radius: 6px;
      font-size: 12px;
    }
    .design-ready {
      font-size: 12px;
      margin: 0;
    }
  `,
})
export class QuotationRevisionPanel {
  readonly quotationId = input.required<string>();
  readonly changed = output<Quotation>();
  readonly closed = output<void>();
  private discardOnClose = false;
  async reloadAndNotify() {
    await this.load();
    if (this.error()) throw new Error(this.error());
    const quote = this.quotation();
    if (quote) this.changed.emit(quote);
  }
  async afterExport() {
    try {
      await this.reloadAndNotify();
    } catch (e) {
      this.error.set(problemMessage(e));
    }
  }
  readonly blocked = output<boolean>();
  readonly auth = inject(AuthService);
  readonly mutation = inject(MutationSession);
  readonly designChanges = signal<LineDesignChange[]>([]);
  readonly changeItem = signal<string | null>(null);
  readonly pricingDirty = signal(false);
  readonly previewFile = signal<string | null>(null);
  readonly bulkOpen = signal(false);
  readonly defaultOverhead = signal<number | null>(null);
  readonly lineStatusLabels = lineStatusLabels;
  private settingsApi = inject(SettingsApi);
  private suggestions: Record<string, CostSuggestion> = {};
  /** Where the prefilled Labor/Overhead came from, per quotation line (internal, editable). */
  costSources: Record<string, { suggestion?: CostSuggestion; defaultRate?: number }> = {};
  validUntil = '';
  readonly today = businessDateInput();
  readonly pendingHandoff = computed(
    () => this.quotation()?.items?.filter((x) => x.designState === 'NotSent') ?? [],
  );
  product(line: PriceLine) {
    return this.products().find((p) => p.id === line.productRevisionId);
  }
  specification(line: PriceLine) {
    try {
      const value = JSON.parse(this.product(line)?.specification ?? '{}');
      return [value.description, value.dimensions, value.finish]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(' · ');
    } catch {
      return '';
    }
  }
  canPreview(mime: string) {
    return ['application/pdf', 'image/png', 'image/jpeg'].includes(mime);
  }
  async downloadDrawing(file: { fileId: string; originalName: string }) {
    try {
      const blob = await this.api.file(file.fileId),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = file.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(problemMessage(e));
    }
  }
  readonly discardOpen = signal(false);
  readonly expired = computed(() => quoteExpired(this.quotation()?.validUntil, businessDateInput()));
  readonly handoffTarget = signal<PriceLine | null>(null);
  readonly guidance = computed(
    () =>
      workflowGuidance[this.quotation()?.workflowStage ?? 'ReadyToPrice'] ??
      workflowGuidance['ReadyToPrice'],
  );
  readonly steps = computed(() => {
    const stage = this.quotation()?.workflowStage;
    const active =
      stage === 'Accepted'
        ? 5
        : ['ReadyToIssue', 'ReadyToSend'].includes(stage ?? '')
          ? 3
          : stage === 'AwaitingCustomer'
            ? 4
            : stage === 'ReadyToPrice'
              ? 2
              : 1;
    return ['รับ Requirement', 'แบบและต้นทุน', 'ตั้งราคา', 'ส่งใบเสนอราคา', 'รับคำสั่งซื้อ'].map(
      (label, i) => ({ label, complete: i < active, current: i === active }),
    );
  });
  readonly latest = computed(() => this.revisions().at(-1));
  readonly hasPricedRevision = computed(
    () =>
      !!this.latest()?.lines?.length &&
      this.latest()!.lines!.every((l) => !!l.productRevisionId && (l.unitPrice ?? 0) > 0),
  );
  readonly lineProgress = lineProgress;
  item(line: PriceLine) {
    return this.quotation()?.items?.find((x) => x.id === line.quotationItemId);
  }
  requestReload() {
    this.discardOnClose = false;
    if (this.pricingDirty()) this.discardOpen.set(true);
    else void this.afterExport();
  }
  requestClose() {
    if (this.mutation.busy() || this.mutation.uncertain() || this.uploading() ||
        this.changeItem() || this.handoffTarget() || this.bulkOpen() || this.previewFile()) return;
    if (this.pricingDirty()) {
      this.discardOnClose = true;
      this.discardOpen.set(true);
    } else this.closed.emit();
  }
  async discard() {
    this.discardOpen.set(false);
    this.pricingDirty.set(false);
    this.priceOnly = false;
    if (this.discardOnClose) {
      this.discardOnClose = false;
      this.closed.emit();
      return;
    }
    await this.afterExport();
  }
  async handoffAll() {
    const count = this.pendingHandoff().length;
    await this.mutation.run('/quotations/' + this.quotationId() + '/designs', {}, async () => {
      this.bulkOpen.set(false);
      this.notice.set('ส่ง Made By Order ' + count + ' รายการให้ Design แล้ว · ติดตามความคืบหน้ารายสินค้าได้ที่นี่');
      await this.reloadAndNotify();
    });
  }
  async handoff() {
    const line = this.handoffTarget();
    if (!line) return;
    await this.mutation.run(
      '/designs',
      { quotationId: this.quotationId(), quotationItemId: line.quotationItemId },
      async () => {
        this.handoffTarget.set(null);
        this.notice.set('ส่งโจทย์ให้ Design แล้ว · ติดตามความคืบหน้ารายการนี้ได้ที่นี่');
        await this.reloadAndNotify();
      },
    );
  }
  changeDescription = '';
  changeSpecifications = '';
  changeReason = '';
  readonly canPriceOnly = computed(() => {
    const latest = this.revisions().at(-1);
    return (
      !!latest &&
      this.quotation()?.items?.every((item) => {
        const id = latest.lines?.find((x) => x.quotationItemId === item.id)?.productRevisionId;
        return (
          !item.requiredDesignId ||
          this.products().some((p) => p.id === id && p.designId === item.requiredDesignId)
        );
      }) === true
    );
  });
  constructor() {
    effect(() =>
      this.blocked.emit(
        this.mutation.busy() ||
          this.mutation.uncertain() ||
          this.pricingDirty() ||
          this.uploading() ||
          !!this.changeItem() ||
          !!this.handoffTarget() ||
          this.bulkOpen() ||
          !!this.previewFile(),
      ),
    );
  }
  private api = inject(ApiClient);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly quotation = signal<Quotation | null>(null);
  readonly products = signal<ProductRevision[]>([]);
  readonly revisions = signal<QuotationRevision[]>([]);
  readonly lines = signal<PriceLine[]>([]);
  readonly editable = computed(
    () =>
      this.auth.has('quotation.manage') &&
      !['Accepted', 'Cancelled'].includes(this.quotation()?.status ?? '') &&
      !this.loading(),
  );
  priceOnly = false;
  pricingMethods: Record<string, string> = {};
  markups: Record<string, number> = {};
  cost(line: PriceLine) {
    return this.productOptions(line).find((p) => p.id === line.productRevisionId)?.cost ?? null;
  }
  canPrice(line: PriceLine) {
    return this.cost(line) !== null;
  }
  lineValid(line: PriceLine) {
    const percent = line.salesOverheadMethod === 'PERCENT';
    return (
      this.canPrice(line) &&
      line.salesLaborCost != null && Number.isFinite(line.salesLaborCost) && line.salesLaborCost >= 0 && line.salesLaborCost <= 1000000000 &&
      (percent
        ? line.salesOverheadRate != null && Number.isFinite(line.salesOverheadRate) && line.salesOverheadRate >= 0 && line.salesOverheadRate <= 1000
        : line.salesOverheadCost != null && Number.isFinite(line.salesOverheadCost) && line.salesOverheadCost >= 0 && line.salesOverheadCost <= 1000000000) &&
      line.salesUnitCost !== null &&
      line.salesUnitCost !== undefined &&
      Number.isFinite(line.salesUnitCost) &&
      line.salesUnitCost >= 0 &&
      line.salesUnitCost < 100000000000000 &&
      Number.isFinite(line.unitPrice) &&
      line.unitPrice! > 0 &&
      Number.isFinite(line.discountPercent) &&
      line.discountPercent! >= 0 &&
      line.discountPercent! < 100
    );
  }
  validPricing() {
    return this.lines().length > 0 && this.lines().every((line) => this.lineValid(line));
  }
  status(line: PriceLine) {
    const saved = this.latest()?.lines?.find((x) => x.quotationItemId === line.quotationItemId);
    return lineStatus(this.item(line)?.designState, saved?.unitPrice, saved?.salesUnitCost);
  }
  /** Internal quotation summary of the editor values: revenue before VAT, total COGS, margin, lines not ready. */
  summary() {
    return quotationSummary(
      this.lines().map((line) => ({
        quantity: this.item(line)?.quantity ?? 0,
        unitPrice: line.unitPrice ?? 0,
        discountPercent: line.discountPercent ?? 0,
        cogs: line.salesUnitCost ?? null,
        ready: this.lineValid(line),
      })),
    );
  }
  selectRevision(line: PriceLine, id: string | undefined) {
    line.productRevisionId = id;
    line.unitPrice = 0;
    line.discountPercent = 0;
    line.salesUnitCost = null;
    line.salesLaborCost = null;
    line.salesOverheadCost = null;
    line.salesOverheadMethod = 'AMOUNT';
    line.salesOverheadRate = null;
    delete this.costSources[line.quotationItemId!];
    this.pricingMethods[line.quotationItemId!] = 'manual';
    void this.prefill([line]);
  }
  /** Prefill Labor/Overhead (editable) from the server suggestion or the default overhead %; never marks the form dirty. */
  async prefill(targets: PriceLine[]) {
    targets = targets.filter((line) => !!line.productRevisionId && !!this.cost(line));
    if (!targets.length || !this.auth.has('quotation.manage')) return;
    const missing = [...new Set(targets.map((x) => x.productRevisionId!))].filter((id) => !this.suggestions[id]);
    if (missing.length) {
      try {
        const rows = await this.api.get<CostSuggestion[]>(
          '/quotations/' + this.quotationId() + '/cost-suggestions?' +
            missing.map((id) => 'productRevisionId=' + encodeURIComponent(id)).join('&'),
        );
        for (const row of rows) this.suggestions[row.productRevisionId] = row;
      } catch {
        // A suggestion is optional; Sales can always enter Labor/Overhead manually.
      }
    }
    for (const line of targets) {
      if (line.salesLaborCost != null || line.salesOverheadCost != null) continue;
      const suggestion = this.suggestions[line.productRevisionId!];
      const values = prefillCosts(suggestion, this.defaultOverhead());
      if (!values) continue;
      Object.assign(line, values);
      this.costSources[line.quotationItemId!] = suggestion?.basis
        ? { suggestion }
        : { defaultRate: values.salesOverheadRate ?? undefined };
      this.recompute(line);
    }
    this.lines.update((lines) => [...lines]);
  }
  setOverheadMethod(line: PriceLine, method: 'AMOUNT' | 'PERCENT') {
    line.salesOverheadMethod = method;
    if (method === 'PERCENT') line.salesOverheadRate ??= this.defaultOverhead() ?? 0;
    else line.salesOverheadRate = null;
    this.cogsChanged(line);
  }
  applyMarkup(line: PriceLine) {
    const markup = this.markups[line.quotationItemId!] ?? 30;
    if (
      line.salesUnitCost != null &&
      Number.isFinite(line.salesUnitCost) &&
      line.salesUnitCost >= 0 &&
      Number.isFinite(markup) &&
      markup >= 0
    )
      line.unitPrice = markedUpPrice(line.salesUnitCost, markup);
    else line.unitPrice = 0;
  }
  /** COGS preview = frozen Material + Labor + Overhead (THB or % of Material + Labor); the server recomputes on save. */
  recompute(line: PriceLine) {
    const material = this.cost(line)?.material;
    if (line.salesOverheadMethod === 'PERCENT')
      line.salesOverheadCost =
        material != null && line.salesLaborCost != null && line.salesOverheadRate != null && line.salesOverheadRate <= 1000
          ? overheadFromPercent(material, line.salesLaborCost, line.salesOverheadRate)
          : null;
    line.salesUnitCost = material != null && line.salesLaborCost != null && line.salesOverheadCost != null &&
      [line.salesLaborCost, line.salesOverheadCost].every(value => Number.isFinite(value) && value >= 0 && value <= 1000000000)
      ? Math.round((material + line.salesLaborCost + line.salesOverheadCost) * 1e6) / 1e6 : null;
    if (this.pricingMethods[line.quotationItemId!] === 'markup') this.applyMarkup(line);
  }
  cogsChanged(line: PriceLine) {
    this.recompute(line);
    this.pricingDirty.set(true);
  }
  preview(line: PriceLine) {
    const cost = this.cost(line);
    const item = this.quotation()?.items?.find((x) => x.id === line.quotationItemId);
    return cost &&
      item &&
      line.salesUnitCost != null &&
      Number.isFinite(line.salesUnitCost) &&
      line.salesUnitCost >= 0
      ? pricingPreview(
          item.quantity ?? 0,
          line.unitPrice ?? 0,
          line.discountPercent ?? 0,
          line.salesUnitCost,
        )
      : null;
  }
  canExport(revision: QuotationRevision) {
    return (
      !!revision.lines?.length &&
      revision.lines.every(
        (l) =>
          !!l.productRevisionId &&
          (l.unitPrice ?? 0) > 0 &&
          (l.discountPercent ?? 0) < 100 &&
          !!this.products().find((p) => p.id === l.productRevisionId)?.cost,
      )
    );
  }
  customerPo = '';
  dueDate = '';
  evidence = signal<ManagedFile | null>(null);
  uploading = signal(false);
  selectedRevision = signal<QuotationRevision | null>(null);
  ngOnInit() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [quotation, products, revisions, changes, defaults] = await Promise.all([
        this.api.get<Quotation>('/quotations/' + this.quotationId()),
        this.auth.has('product_revision.view')
          ? this.api.get<ProductRevision[]>('/product-revisions')
          : Promise.resolve([]),
        this.api.get<QuotationRevision[]>('/quotation-revisions', {
          quotationId: this.quotationId(),
        }),
        this.api.get<LineDesignChange[]>(
          '/quotations/' + this.quotationId() + '/line-design-changes',
        ),
        this.auth.has('quotation.manage')
          ? this.settingsApi.defaults().catch(() => null)
          : Promise.resolve(null),
      ]);
      this.defaultOverhead.set(defaults?.defaultOverheadPercent ?? null);
      this.suggestions = {};
      this.costSources = {};
      this.validUntil = quotation.validUntil?.slice(0, 10) ?? '';
      this.quotation.set(quotation);
      this.products.set(products);
      this.revisions.set(revisions);
      this.designChanges.set(changes);
      this.pricingDirty.set(false);
      this.pricingMethods = {};
      this.markups = {};
      if (!this.canPriceOnly()) this.priceOnly = false;
      const latest = revisions.at(-1);
      this.selectedRevision.set(latest ?? null);
      this.lines.set(
        (quotation.items ?? []).map((item) => {
          const previous = latest?.lines?.find((x) => x.quotationItemId === item.id);
          const id = previous?.productRevisionId ?? item.productRevisionId ?? undefined;
          const valid = products.some(
            (p) =>
              p.id === id &&
              p.status === 'Approved' &&
              (!item.requiredDesignId || p.designId === item.requiredDesignId),
          );
          this.pricingMethods[item.id!] = 'manual';
          return {
            quotationItemId: item.id,
            productRevisionId: valid ? id : suggestedProduct(item, products),
            unitPrice: previous?.unitPrice ?? item.unitPrice ?? 0,
            discountPercent: previous?.discountPercent ?? item.discountPercent ?? 0,
            salesUnitCost: previous?.salesLaborCost != null && previous?.salesOverheadCost != null
              ? previous.salesUnitCost : null,
            salesLaborCost: previous?.salesLaborCost ?? item.salesLaborCost ?? null,
            salesOverheadCost: previous?.salesOverheadCost ?? item.salesOverheadCost ?? null,
            // A price-only revision keeps the previous components; legacy rows without a method were THB per unit.
            salesOverheadMethod: previous?.salesOverheadMethod ?? item.salesOverheadMethod ?? 'AMOUNT',
            salesOverheadRate: previous?.salesOverheadRate ?? item.salesOverheadRate ?? null,
          };
        }),
      );
      await this.prefill(this.lines());
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  productOptions(line: PriceLine) {
    const previous = this.revisions()
      .at(-1)
      ?.lines?.find((x) => x.quotationItemId === line.quotationItemId);
    const item = this.quotation()?.items?.find((x) => x.id === line.quotationItemId);
    return this.products().filter(
      (p) =>
        (p.quotationItemId === line.quotationItemId ||
          (!!item?.requiredDesignId && p.designId === item.requiredDesignId) ||
          (!item?.requiredDesignId && p.id === item?.productRevisionId)) &&
        p.status === 'Approved' &&
        (!item?.requiredDesignId || p.designId === item.requiredDesignId) &&
        (!this.priceOnly || p.id === previous?.productRevisionId),
    );
  }
  currentDesign(id: string | undefined) {
    return this.quotation()?.items?.find((x) => x.id === id)?.requiredDesignId;
  }
  openDesignChange(line: PriceLine) {
    if (this.pricingDirty()) {
      this.error.set('บันทึกหรือยกเลิกการแก้ราคาก่อนเปลี่ยนโจทย์ออกแบบ');
      return;
    }
    this.changeItem.set(line.quotationItemId!);
    this.changeDescription = this.lineName(line);
    this.changeSpecifications = '';
    this.changeReason = '';
    this.error.set('');
  }
  cancelDesignChange() {
    if (!this.mutation.busy() && !this.mutation.uncertain()) this.changeItem.set(null);
  }
  async changeDesign() {
    const item = this.changeItem(),
      quote = this.quotation();
    if (
      !item ||
      !quote ||
      !this.changeDescription.trim() ||
      !this.changeSpecifications.trim() ||
      !this.changeReason.trim()
    )
      return;
    await this.mutation.run<LineDesignChange>(
      '/quotations/' + quote.id + '/lines/' + item + '/design-change',
      {
        expectedVersion: quote.version,
        description: this.changeDescription.trim(),
        specifications: this.changeSpecifications.trim(),
        reason: this.changeReason.trim(),
      },
      async (result) => {
        this.changeItem.set(null);
        this.priceOnly = false;
        this.notice.set('ส่งเฉพาะรายการที่เปลี่ยนไป Design แล้ว · รายการอื่นและเอกสารเดิมยังอยู่');
        await this.reloadAndNotify();
      },
    );
  }
  lineName(line: PriceLine) {
    return (
      this.quotation()?.items?.find((x) => x.id === line.quotationItemId)?.description ??
      'รายการสินค้า'
    );
  }
  setPriceOnly(value: boolean) {
    this.priceOnly = value;
    if (value) {
      const latest = this.revisions().at(-1);
      this.lines.update((lines) =>
        lines.map((line) => ({
          ...line,
          productRevisionId: latest?.lines?.find((x) => x.quotationItemId === line.quotationItemId)
            ?.productRevisionId,
        })),
      );
    }
  }
  productLabel(id: string | undefined) {
    const product = this.products().find((x) => x.id === id);
    return product ? product.productCode + ' · R' + product.revision : 'แบบที่อนุมัติ';
  }
  async createRevision() {
    if (!this.validPricing()) {
      this.error.set('รอแบบและต้นทุนอ้างอิงจาก Design แล้วกรอก COGS และราคาขายให้ครบก่อนบันทึก');
      return;
    }
    await this.mutation.run<QuotationRevision>(
      '/quotation-revisions',
      {
        quotationId: this.quotationId(),
        priceOnly: this.priceOnly,
        lines: this.lines().map((line) => ({
          ...line,
          salesOverheadMethod: line.salesOverheadMethod ?? 'AMOUNT',
          salesOverheadRate: line.salesOverheadMethod === 'PERCENT' ? line.salesOverheadRate : null,
        })),
        expectedVersion: this.quotation()?.version,
        // Only a changed validity is sent; otherwise the new revision keeps the current date.
        validUntil:
          this.validUntil && this.validUntil !== this.quotation()?.validUntil?.slice(0, 10)
            ? this.validUntil
            : null,
      },
      async () => {
        this.notice.set('บันทึกราคาขายแล้ว · พร้อมตรวจและออกใบเสนอราคา');
        await this.reloadAndNotify();
      },
    );
  }
  async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      this.evidence.set(await this.api.upload<ManagedFile>('/files', file));
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.uploading.set(false);
    }
  }
  async accept() {
    if (!this.auth.has('sales_order.manage')) return;
    const revision = this.revisions().at(-1);
    if (!revision?.id || this.expired() || !this.customerPo.trim() || !this.evidence()?.id || !this.dueDate) return;
    await this.mutation.run<SalesOrder>(
      '/quotation-revisions/' + revision.id + '/accept',
      {
        customerPoNumber: this.customerPo.trim(),
        evidenceFileId: this.evidence()!.id,
        dueDate: this.dueDate,
      },
      async (order) => {
        this.notice.set('รับ PO แล้ว · ' + order.number);
        this.evidence.set(null);
        await this.reloadAndNotify();
      },
    );
  }
}
