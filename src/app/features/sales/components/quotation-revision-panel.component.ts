import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DocumentExport } from '../../../shared/components/document-export.component';
import { RevisionRow } from '../../../shared/components/revision-row.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiClient, problemMessage } from '../../../core/services/api/api-client.service';
import { StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
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
    RouterLink,
    FormsModule,
    DecimalPipe,
    DatePipe,
    StateMessage,
    RevisionRow,
    DocumentExport,
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
  `,
})
export class QuotationRevisionPanel {
  readonly quotationId = input.required<string>();
  readonly changed = output();
  readonly blocked = output<boolean>();
  readonly auth = inject(AuthService);
  readonly mutation = inject(MutationSession);
  readonly designChanges = signal<LineDesignChange[]>([]);
  readonly changeItem = signal<string | null>(null);
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
      this.blocked.emit(this.mutation.busy() || this.mutation.uncertain() || !!this.changeItem()),
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
      !['Accepted', 'Cancelled'].includes(this.quotation()?.status ?? ''),
  );
  priceOnly = false;
  customerPo = '';
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
      const [quotation, products, revisions, changes] = await Promise.all([
        this.api.get<Quotation>('/quotations/' + this.quotationId()),
        this.api.get<ProductRevision[]>('/product-revisions'),
        this.api.get<QuotationRevision[]>('/quotation-revisions', {
          quotationId: this.quotationId(),
        }),
        this.api.get<LineDesignChange[]>(
          '/quotations/' + this.quotationId() + '/line-design-changes',
        ),
      ]);
      this.quotation.set(quotation);
      this.products.set(products);
      this.revisions.set(revisions);
      this.designChanges.set(changes);
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
          return {
            quotationItemId: item.id,
            productRevisionId: valid ? id : (item.productRevisionId ?? undefined),
            unitPrice: previous?.unitPrice ?? item.unitPrice ?? 0,
            discountPercent: previous?.discountPercent ?? item.discountPercent ?? 0,
          };
        }),
      );
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
        this.notice.set('ส่งเฉพาะรายการที่เปลี่ยนไป Design แล้ว · ' + result.designNumber);
        await this.load();
        this.changed.emit();
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
    if (this.lines().some((line) => !line.productRevisionId)) {
      this.error.set('เลือก Product Revision ที่อนุมัติครบทุก line ก่อนสร้าง Revision');
      return;
    }
    await this.mutation.run<QuotationRevision>(
      '/quotation-revisions',
      { quotationId: this.quotationId(), priceOnly: this.priceOnly, lines: this.lines() },
      async () => {
        this.notice.set('บันทึก snapshot ของแบบ BOM และราคาแล้ว');
        await this.load();
        this.changed.emit();
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
    const revision = this.revisions().at(-1);
    if (!revision?.id || !this.customerPo.trim() || !this.evidence()?.id) return;
    await this.mutation.run<SalesOrder>(
      '/quotation-revisions/' + revision.id + '/accept',
      { customerPoNumber: this.customerPo.trim(), evidenceFileId: this.evidence()!.id },
      async (order) => {
        this.notice.set('รับ PO แล้ว · ' + order.number);
        this.evidence.set(null);
        await this.load();
        this.changed.emit();
      },
    );
  }
}
