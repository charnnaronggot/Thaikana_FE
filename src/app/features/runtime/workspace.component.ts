import { MutationSession } from '../../shared/utils/mutation-session';
import type { ProductRevision, Quotation } from '../sales/models/sales-api.models';
import { QuotationProductPicker } from '../sales/components/quotation-product-picker.component';
import { CustomerPicker } from '../customers/components/customer-picker.component';
import { Customer } from '../customers/models/customer.models';
import { SettingsApi } from '../settings/settings-api.service';
import { QuotationRevisionPanel } from '../sales/components/quotation-revision-panel.component';
import { workflowLabels } from '../sales/models/workflow';
import { DataTable } from '../../shared/components/data-table.component';
import { FilterBar } from '../../shared/components/filter-bar.component';
import { Component, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRecord, Page } from '../../core/models/api.models';
import { ApiClient, problemMessage } from '../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../shared/components/ui';
interface Tab {
  label: string;
  path: string;
  permission: string;
  columns: { key: string; label: string; money?: boolean; emptyText?: string }[];
  paged?: boolean;
}
const tabs: Record<string, Tab[]> = {
  sales: [
    {
      label: 'ใบเสนอราคา',
      path: '/quotations',
      permission: 'quotation.view',
      paged: true,
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'customerName', label: 'ลูกค้า' },
        { key: 'workflowLabel', label: 'ความคืบหน้า' },
        { key: 'updatedAt', label: 'แก้ไขล่าสุด' },
        { key: 'grandTotal', label: 'ยอดรวม', money: true, emptyText: 'รอตั้งราคา' },
      ],
    },
    {
      label: 'คำสั่งขาย',
      path: '/sales-orders',
      permission: 'sales_order.view',
      columns: [
        { key: 'number', label: 'เลขที่ SO' },
        { key: 'customerName', label: 'ลูกค้า' },
        { key: 'status', label: 'สถานะ' },
        { key: 'grandTotal', label: 'ยอดรวม', money: true },
      ],
    },
  ],
  design: [
    {
      label: 'งานออกแบบ',
      path: '/designs',
      permission: 'design.view',
      paged: true,
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'title', label: 'ชื่องาน' },
        { key: 'customerName', label: 'ลูกค้า' },
        { key: 'revision', label: 'REV' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'Product Revision',
      path: '/product-revisions',
      permission: 'product_revision.view',
      columns: [
        { key: 'productCode', label: 'รหัสสินค้า' },
        { key: 'productName', label: 'สินค้า' },
        { key: 'revision', label: 'REV' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
  ],
  planning: [
    {
      label: 'QC / Rework',
      path: '/quality',
      permission: 'qc.view',
      columns: [
        { key: 'number', label: 'เลขที่ QC' },
        { key: 'reworkQuantity', label: 'ส่งแก้งาน' },
        { key: 'reworkPlannedQuantity', label: 'วางแผนแล้ว' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'Work Orders',
      path: '/work-orders',
      permission: 'work_order.view',
      paged: true,
      columns: [
        { key: 'number', label: 'เลขที่ WO' },
        { key: 'productName', label: 'สินค้า' },
        { key: 'quantity', label: 'จำนวน' },
        { key: 'priority', label: 'ความสำคัญ' },
        { key: 'plannedEndDate', label: 'กำหนดเสร็จ' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'คำสั่งขาย',
      path: '/sales-orders',
      permission: 'sales_order.view',
      columns: [
        { key: 'number', label: 'เลขที่ SO' },
        { key: 'customerName', label: 'ลูกค้า' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
  ],
  inventory: [
    {
      label: 'ยอดคงเหลือ',
      path: '/inventory/items',
      permission: 'inventory.view',
      paged: true,
      columns: [
        { key: 'sku', label: 'รหัส' },
        { key: 'name', label: 'รายการ' },
        { key: 'locationName', label: 'คลัง' },
        { key: 'quantityOnHand', label: 'คงเหลือ' },
        { key: 'unit', label: 'หน่วย' },
      ],
    },
    {
      label: 'เบิก / คืน / Scrap',
      path: '/inventory/material-postings',
      permission: 'inventory.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'type', label: 'ประเภท' },
        { key: 'quantity', label: 'จำนวน' },
        { key: 'reason', label: 'เหตุผล' },
      ],
    },
  ],
  qc: [
    {
      label: 'ตรวจคุณภาพ',
      path: '/quality',
      permission: 'qc.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'acceptedQuantity', label: 'ผ่าน' },
        { key: 'rejectedQuantity', label: 'ไม่ผ่าน' },
        { key: 'reworkQuantity', label: 'Rework' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
  ],
  delivery: [
    {
      label: 'รอบส่งมอบ',
      path: '/delivery/shipments',
      permission: 'delivery.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'status', label: 'สถานะ' },
        { key: 'recipientName', label: 'ผู้รับ' },
        { key: 'deliveredAt', label: 'รับมอบเมื่อ' },
      ],
    },
    {
      label: 'Packages',
      path: '/delivery/packages',
      permission: 'delivery.view',
      columns: [
        { key: 'number', label: 'Package' },
        { key: 'barcode', label: 'Barcode' },
        { key: 'quantity', label: 'จำนวน' },
        { key: 'status', label: 'สถานะ' },
      ],
    },
  ],
  documents: [
    {
      label: 'Invoice',
      path: '/finance/invoices',
      permission: 'finance.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'amount', label: 'ยอด', money: true },
        { key: 'paidAmount', label: 'ชำระแล้ว', money: true },
        { key: 'outstandingAmount', label: 'คงค้าง', money: true },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'Billing',
      path: '/finance/billings',
      permission: 'finance.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'amount', label: 'ยอด', money: true },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'Payment',
      path: '/finance/payments',
      permission: 'finance.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'reference', label: 'อ้างอิง' },
        { key: 'amount', label: 'ยอด', money: true },
        { key: 'status', label: 'สถานะ' },
      ],
    },
    {
      label: 'Receipt',
      path: '/finance/receipts',
      permission: 'finance.view',
      columns: [
        { key: 'number', label: 'เลขที่' },
        { key: 'amount', label: 'ยอด', money: true },
        { key: 'status', label: 'สถานะ' },
      ],
    },
  ],
  users: [
    {
      label: 'ผู้ใช้',
      path: '/users',
      permission: 'user.view',
      paged: true,
      columns: [
        { key: 'username', label: 'Username' },
        { key: 'displayName', label: 'ชื่อ' },
        { key: 'accountType', label: 'ประเภทบัญชี' },
        { key: 'roles', label: 'Roles' },
        { key: 'isActive', label: 'ใช้งาน' },
      ],
    },
  ],
};
@Component({
  providers: [MutationSession],
  imports: [
    QuotationProductPicker,
    CustomerPicker,
    FormsModule,
    ReactiveFormsModule,
    Drawer,
    StateMessage,
    QuotationRevisionPanel,
    DataTable,
    FilterBar,
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent {
  readonly salesStatusLabels = {
    Draft: 'ร่าง',
    Issued: 'ออก PDF แล้ว',
    Sent: 'ส่งลูกค้าแล้ว',
    Accepted: 'ลูกค้ารับราคา',
    Cancelled: 'ยกเลิก',
  };
  readonly quoteMutation = inject(MutationSession);
  readonly quoteBlocked = computed(
    () => this.busy() || this.quoteMutation.busy() || this.quoteMutation.uncertain(),
  );
  readonly auth = inject(AuthService);
  private api = inject(ApiClient);
  private settings = inject(SettingsApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  feature = this.route.snapshot.data['feature'] as string;
  title = (
    {
      sales: 'ใบเสนอราคา',
      design: 'ออกแบบ',
      planning: 'วางแผนผลิต',
      inventory: 'คลังสินค้า',
      qc: 'ตรวจคุณภาพ',
      delivery: 'จัดส่ง',
      documents: 'เอกสารขาย',
      users: 'ผู้ใช้และสิทธิ์',
    } as Record<string, string>
  )[this.feature];
  description = (
    {
      sales: 'จัดการใบเสนอราคา Revision และคำสั่งขาย',
      design: 'ติดตามงานออกแบบ แบบอนุมัติ และ Product Revision',
      planning: 'วางแผนวัสดุ ขั้นตอนผลิต และปล่อย Work Order',
      inventory: 'ตรวจยอดคงเหลือและติดตามการเบิกคืนวัสดุ',
      qc: 'ตรวจคุณภาพ บันทึกหลักฐาน และติดตามงานแก้ไข',
      delivery: 'จัดการพัสดุ รอบส่ง และหลักฐานรับมอบ',
      documents: 'ติดตามเอกสารขาย การชำระเงิน และยอดคงค้าง',
      users: 'จัดการบัญชีผู้ใช้งาน บทบาท และขอบเขตสิทธิ์',
    } as Record<string, string>
  )[this.feature];
  searchPlaceholder =
    (
      {
        inventory: 'รหัส / ชื่อวัสดุ / คลัง',
        users: 'Username / ชื่อ / บทบาท',
        documents: 'เลขที่เอกสาร / อ้างอิง',
        delivery: 'เลขที่รอบส่ง / ผู้รับ / Barcode',
      } as Record<string, string>
    )[this.feature] ?? 'เลขที่ / ลูกค้า / สินค้า';
  availableTabs = computed(() => tabs[this.feature].filter((t) => this.auth.has(t.permission)));
  tab = signal<Tab>(
    tabs[this.feature].find((t) => t.path === '/work-orders') ?? tabs[this.feature][0],
  );
  rows = signal<ApiRecord[]>([]);
  selected = signal<ApiRecord | null>(null);
  total = signal(0);
  loading = signal(false);
  error = signal('');
  notice = signal('');
  actionError = signal('');
  detailLoading = signal(false);
  busy = signal(false);
  query = '';
  status = '';
  page = 1;
  readinessLines = signal<Record<string, number | string>[]>([]);
  deliveryMode: 'package' | 'shipment' = 'package';
  deliveryCreateOpen = signal(false);
  materialOpen = signal(false);
  qcStartOpen = signal(false);
  qcBlocked = signal(false);
  readonly quotationPanel = viewChild(QuotationRevisionPanel);
  closeDetail() {
    const pricing = this.quotationPanel();
    if (pricing) pricing.requestClose();
    else if (!this.qcBlocked() && !this.busy()) this.selected.set(null);
  }
  planOpen = signal(false);
  quoteOpen = signal(false);
  readonly quoteDirty = signal(false);
  readonly quoteDiscardOpen = signal(false);
  requestCloseQuote() {
    if (this.quoteBlocked()) return;
    if (this.quoteDirty()) this.quoteDiscardOpen.set(true);
    else this.quoteOpen.set(false);
  }
  discardQuote() {
    this.quoteDiscardOpen.set(false);
    this.quoteOpen.set(false);
    this.quoteDirty.set(false);
  }
  private loadGeneration = 0;
  quoteCustomer = signal<Customer | null>(null);
  quoteForm = this.fb.nonNullable.group({
    customerId: ['', Validators.required],
    number: ['', Validators.required],
    customerName: ['', Validators.required],
    customerAddress: [
      '',
      [Validators.required, Validators.maxLength(500), Validators.pattern(/\S/)],
    ],
    customerTaxId: [''],
    contactName: [''],
    quotationDate: [new Date().toISOString().slice(0, 10), Validators.required],
    validUntil: ['', Validators.required],
    vatRate: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    terms: [''],
    deliveryTerms: ['', Validators.maxLength(2000)],
    deliveryLocation: ['', Validators.maxLength(500)],
    shippingTerms: ['', Validators.maxLength(1000)],
    remarks: ['', Validators.maxLength(2000)],
    showBankDetails: [false],
  });
  readonly catalogProducts = signal<ProductRevision[]>([]);
  readonly units = signal<{ id: string; code: string; name: string }[]>([]);
  quoteLines = [this.newLine()];
  visibleRows = computed(() => {
    const rows = this.tab().paged
      ? this.rows()
      : this.rows().filter(
          (r) =>
            (!this.status || r['status'] === this.status) &&
            Object.values(r).join(' ').toLowerCase().includes(this.query.toLowerCase()),
        );
    return this.feature === 'sales' && this.tab().path === '/quotations'
      ? rows.map((r) => ({
          ...r,
          workflowLabel: workflowLabels[String(r['workflowStage'])] ?? r['status'],
          grandTotal: ['NeedsDesign', 'WaitingDesign', 'ReadyToPrice'].includes(
            String(r['workflowStage']),
          )
            ? null
            : r['grandTotal'],
        }))
      : rows;
  });
  visibleColumns = computed(() =>
    this.tab().columns.filter((x) => !x.money || this.auth.has('quotation.view')),
  );
  statuses = computed(() => this.feature === 'sales' && this.tab().path === '/quotations'
    ? Object.keys(this.salesStatusLabels)
    : [
    ...new Set(
      this.rows()
        .map((r) => r['status'])
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    ),
  ]);
  metrics = computed(() => {
    const rows = this.rows(),
      detail = this.tab().paged ? 'รายการในหน้านี้' : 'รายการทั้งหมด';
    const metric = (label: string, value: number) => ({ label, value, detail });
    const inStatus = (...states: string[]) =>
      rows.filter((r) => states.includes(String(r['status']))).length;
    const total = { label: 'ทั้งหมด', value: this.total(), detail: this.tab().label };
    if (this.feature === 'sales' && this.tab().path === '/quotations')
      return [
        total,
        metric('รอส่ง Design', rows.filter((r) => r['workflowStage'] === 'NeedsDesign').length),
        metric('รอแบบและต้นทุน', rows.filter((r) => r['workflowStage'] === 'WaitingDesign').length),
        metric(
          'Sales ทำต่อได้',
          rows.filter((r) =>
            ['ReadyToPrice', 'ReadyToIssue', 'ReadyToSend'].includes(String(r['workflowStage'])),
          ).length,
        ),
      ];
    if (this.feature === 'users')
      return [
        total,
        metric('เปิดใช้งาน', rows.filter((r) => r['isActive'] === true).length),
        metric('ระงับใช้งาน', rows.filter((r) => r['isActive'] === false).length),
        metric('บัญชีสถานี', rows.filter((r) => r['accountType'] === 'Station').length),
      ];
    if (this.feature === 'inventory' && this.tab().path === '/inventory/items')
      return [
        total,
        metric('มีสินค้าคงเหลือ', rows.filter((r) => Number(r['quantityOnHand']) > 0).length),
        metric(
          'คงเหลือศูนย์ / ติดลบ',
          rows.filter((r) => r['quantityOnHand'] != null && Number(r['quantityOnHand']) <= 0)
            .length,
        ),
        metric('คลังสินค้า', new Set(rows.map((r) => r['locationName']).filter(Boolean)).size),
      ];
    if (this.feature === 'inventory')
      return [
        total,
        metric('เบิกวัสดุ', rows.filter((r) => r['type'] === 'Issue').length),
        metric('คืนวัสดุ', rows.filter((r) => r['type'] === 'Return').length),
        metric(
          'Scrap / กลับรายการ',
          rows.filter((r) => ['Scrap', 'Reversal'].includes(String(r['type']))).length,
        ),
      ];
    if (this.feature === 'documents')
      return [
        total,
        metric('ร่าง', inStatus('Draft')),
        metric('ออกเอกสาร / ยืนยันแล้ว', inStatus('Issued', 'Confirmed', 'PartiallyPaid', 'Paid')),
        metric('ยกเลิก / กลับรายการ', inStatus('Cancelled', 'Reversed')),
      ];
    if (this.feature === 'delivery')
      return [
        total,
        metric('รอจัดส่ง', inStatus('Draft', 'Packed', 'Picked', 'Ready')),
        metric('อยู่ระหว่างจัดส่ง', inStatus('Dispatched')),
        metric('ส่งมอบแล้ว', inStatus('Delivered')),
      ];
    return [
      total,
      metric('ร่าง / รอดำเนินการ', inStatus('Draft', 'Pending', 'Ready', 'Released')),
      metric(
        'กำลังดำเนินการ',
        inStatus('Sent', 'Running', 'InProgress', 'InReview', 'OnHold', 'Paused'),
      ),
      metric('สำเร็จ', inStatus('Accepted', 'Approved', 'Completed', 'Delivered', 'Confirmed')),
    ];
  });
  canLeave() {
    return !this.qcBlocked() && !this.quoteBlocked() && !(this.quoteOpen() && this.quoteDirty());
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (!this.canLeave()) event.preventDefault();
  }
  async ngOnInit() {
    const designId =
      this.feature === 'design' ? this.route.snapshot.queryParamMap.get('designId') : null;
    const salesOrderId =
      this.feature === 'sales' ? this.route.snapshot.queryParamMap.get('salesOrderId') : null;
    this.tab.set(
      (salesOrderId ? this.availableTabs().find((t) => t.path === '/sales-orders') : null) ??
        this.availableTabs().find((t) => t.path === '/work-orders') ??
        this.availableTabs()[0] ??
        tabs[this.feature][0],
    );
    await this.load();
    const id =
      this.route.snapshot.paramMap.get('id') ??
      salesOrderId ??
      designId ??
      (this.feature === 'planning' ? this.route.snapshot.queryParamMap.get('workOrderId') : null);
    if (id) {
      try {
        this.selected.set(
          await this.api.get<ApiRecord>(
            (designId
              ? '/designs/'
              : salesOrderId
                ? '/sales-orders/'
                : this.feature === 'planning'
                  ? '/work-orders/'
                  : '/quotations/') + id,
          ),
        );
      } catch (e) {
        this.error.set(problemMessage(e));
      }
    }
  }
  selectTab(t: Tab) {
    this.tab.set(t);
    this.page = 1;
    this.query = '';
    this.status = '';
    this.selected.set(null);
    void this.load();
  }
  search() {
    this.page = 1;
    if (this.tab().paged) void this.load();
    else this.rows.set([...this.rows()]);
  }
  async load() {
    const generation = ++this.loadGeneration;
    const t = this.tab();
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.get<Page<ApiRecord> | ApiRecord[]>(
        t.path,
        t.paged ? { page: this.page, pageSize: 25, search: this.query, status: this.status } : {},
      );
      if (generation !== this.loadGeneration || this.tab().path !== t.path) return;
      this.rows.set(Array.isArray(data) ? data : data.items);
      this.total.set(Array.isArray(data) ? data.length : data.totalCount);
    } catch (e) {
      if (generation === this.loadGeneration) this.error.set(problemMessage(e));
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }
  text(v: unknown): string {
    return v === null || v === undefined
      ? '—'
      : Array.isArray(v)
        ? v.join(' · ')
        : typeof v === 'object'
          ? ''
          : String(v);
  }
  number(v: unknown) {
    return Number(v) || 0;
  }
  detailValue(r: ApiRecord, c: { key: string; money?: boolean }) {
    if (c.key === 'workflowLabel')
      return workflowLabels[String(r['workflowStage'])] ?? this.text(r['status']);
    if (
      c.money &&
      this.feature === 'sales' &&
      ['NeedsDesign', 'WaitingDesign', 'ReadyToPrice'].includes(String(r['workflowStage']))
    )
      return 'รอตั้งราคาให้ครบ';
    const value = r[c.key];
    if (c.money && value == null) return '—';
    if (c.money)
      return this.number(value).toLocaleString('th-TH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    if (/Date$|At$/.test(c.key) && value) {
      const date = new Date(String(value));
      if (!Number.isNaN(date.valueOf()))
        return date.toLocaleDateString('th-TH-u-ca-gregory', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
    }
    return this.text(value);
  }
  detailFields(r: ApiRecord) {
    return [
      ...this.visibleColumns(),
      ...[
        { key: 'specifications', label: 'ข้อกำหนด' },
        { key: 'instructions', label: 'คำสั่งผลิต' },
        { key: 'notes', label: 'หมายเหตุ' },
        { key: 'terms', label: 'เงื่อนไข' },
      ].filter((c) => r[c.key]),
    ];
  }
  children(r: ApiRecord) {
    return (r['items'] || r['lines'] || []) as ApiRecord[];
  }
  async deliveryCreated(result: { kind: 'package' | 'shipment'; id: string }) {
    this.deliveryCreateOpen.set(false);
    this.qcBlocked.set(false);
    this.selectTab(
      tabs['delivery'].find(
        (x) =>
          x.path === (result.kind === 'package' ? '/delivery/packages' : '/delivery/shipments'),
      )!,
    );
    await this.load();
    const row = this.rows().find((x) => x.id === result.id);
    if (row) await this.open(row);
  }
  openAccess(id: string) {
    void this.router.navigate(['/users/access', id]);
  }
  newFinance(kind: string) {
    void this.router.navigate(['/documents/new', kind]);
  }
  async open(r: ApiRecord) {
    if (this.feature === 'documents') {
      void this.router.navigate(['/documents', this.tab().path.split('/').at(-1), r.id]);
      return;
    }
    this.qcBlocked.set(false);
    this.selected.set(r);
    this.actionError.set('');
    this.readinessLines.set([]);
    if (this.tab().paged && this.feature !== 'users') {
      this.detailLoading.set(true);
      try {
        const path = this.tab().path;
        const detail = await this.api.get<ApiRecord>(path + '/' + r.id);
        if (this.selected()?.id === r.id && this.tab().path === path) this.selected.set(detail);
      } catch (e) {
        this.actionError.set(problemMessage(e));
      } finally {
        this.detailLoading.set(false);
      }
    }
  }
  refreshDetail(r: ApiRecord, quote: Quotation) {
    if (!quote.id || this.selected()?.id !== r.id || quote.id !== r.id) return;
    const detail = { ...quote, id: quote.id } as ApiRecord;
    this.selected.set(detail);
    this.rows.update((rows) => rows.map((row) => (row.id === detail.id ? detail : row)));
    // Only a document-status filter needs a page refill after the current row changes state.
    if (this.status && quote.status !== this.status) void this.load();
  }
  async sendQuote(r: ApiRecord) {
    this.busy.set(true);
    try {
      await this.api.patch('/quotations/' + r.id + '/status', {
        status: 'Sent',
        expectedVersion: r['version'],
      });
      this.selected.set(null);
      this.notice.set('ส่งใบเสนอราคาแล้ว');
      await this.load();
    } catch (e) {
      this.actionError.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async handoff(r: ApiRecord, line: ApiRecord) {
    this.busy.set(true);
    try {
      await this.api.post('/designs', {
        quotationId: r.id,
        quotationItemId: line.id,
        customerName: r['customerName'],
        title: line['description'],
        description: line['description'],
        specifications: line['description'],
        priority: 'Normal',
        assignedToUserId: null,
        dueDate: null,
      });
      this.notice.set('ส่งรายการไป Design แล้ว');
      this.selected.set(null);
    } catch (e) {
      this.actionError.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async inspectionStarted(row: { id?: string }) {
    this.qcStartOpen.set(false);
    this.qcBlocked.set(false);
    await this.load();
    if (row.id) await this.open({ id: row.id });
  }
  async planned(wo: { id?: string }) {
    this.planOpen.set(false);
    this.qcBlocked.set(false);
    this.selected.set(null);
    this.notice.set('สร้าง WO ร่างแล้ว');
    this.tab.set(tabs['planning'].find((t) => t.path === '/work-orders')!);
    await this.load();
    if (wo.id) await this.open({ id: wo.id });
  }
  async readiness(r: ApiRecord) {
    try {
      const data = await this.api.get<{
        isReady: boolean;
        lines: Record<string, number | string>[];
        reason?: string;
      }>('/planning/work-orders/' + r.id + '/readiness');
      this.readinessLines.set(data.lines);
      if (!data.isReady) this.actionError.set(data.reason || 'วัสดุยังไม่พร้อม');
    } catch (e) {
      this.actionError.set(problemMessage(e));
    }
  }
  newLine() {
    return {
      sourceType: 'MadeByOrder' as 'MadeByOrder' | 'Existing',
      productRevisionId: null as string | null,
      productId: null,
      productCode: '',
      description: '',
      quantity: 1,
      unit: this.units()[0]?.code ?? '',
      unitPrice: 0,
      discountPercent: 0,
    };
  }
  addLine() {
    this.quoteLines.unshift(this.newLine());
  }
  setLineSource(line: ReturnType<WorkspaceComponent['newLine']>, source: string) {
    if (source === line.sourceType || this.quoteBlocked()) return;
    const quantity = line.quantity;
    Object.assign(line, this.newLine(), {
      quantity,
      sourceType: source === 'Existing' ? 'Existing' : 'MadeByOrder',
    });
  }
  selectProduct(line: ReturnType<WorkspaceComponent['newLine']>, id: string | null) {
    if (this.quoteBlocked()) return;
    if (line.productRevisionId !== id) {
      line.unitPrice = 0;
      line.discountPercent = 0;
    }
    const product = this.catalogProducts().find((p) => p.id === id);
    line.productRevisionId = product?.id ?? null;
    line.productCode = product?.productCode ?? '';
    line.description = product?.productName ?? '';
    line.unit = product?.unit ?? this.units()[0]?.code ?? '';
  }
  async createQuote() {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const [defaults, products, units] = await Promise.all([
        this.settings.defaults(),
        this.auth.has('product_revision.view')
          ? this.api.get<ProductRevision[]>('/product-revisions')
          : Promise.resolve([]),
        this.api.get<{ id: string; code: string; name: string }[]>('/uoms'),
      ]);
      this.units.set(units);
      this.catalogProducts.set(
        products.filter((p) => p.status === 'Approved' && !!p.id && !!p.unit),
      );
      this.quoteForm.patchValue({
        vatRate: defaults.vatRate,
        terms: defaults.paymentTerms ?? '',
      });
      this.quoteCustomer.set(null);
      this.quoteLines = [this.newLine()];
      this.quoteForm.patchValue({
        number: '',
        validUntil: '',
        customerId: '',
        customerName: '',
        customerAddress: '',
        customerTaxId: '',
        contactName: '',
        deliveryTerms: '',
        deliveryLocation: '',
        shippingTerms: '',
        remarks: '',
        showBankDetails: false,
      });
      this.quoteOpen.set(true);
      this.quoteDirty.set(false);
      if (!defaults.isConfigured)
        this.actionError.set('ยังไม่ได้ตั้งค่าบริษัท กรุณาตั้งค่า VAT และเงื่อนไขก่อนบันทึก');
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  chooseCustomer(c: Customer | null) {
    this.quoteDirty.set(true);
    this.quoteCustomer.set(c);
    this.quoteForm.patchValue({
      customerId: c?.id ?? '',
      customerName: c?.name ?? '',
      customerAddress: c?.addresses.find((x) => x.addressType === 'Billing')?.addressText ?? '',
      customerTaxId: c?.taxReference ?? '',
      contactName: c?.contactName ?? '',
    });
  }
  validQuoteLines() {
    return (
      this.quoteLines.length > 0 &&
      this.quoteLines.every(
        (line) =>
          (line.sourceType !== 'Existing' ||
            this.catalogProducts().some((p) => p.id === line.productRevisionId)) &&
          line.description.trim().length > 0 &&
          line.description.length <= 500 &&
          line.unit.trim().length > 0 &&
          Number.isFinite(line.quantity) &&
          line.quantity >= 0.001 &&
          line.quantity <= 1000000 &&
          Number.isFinite(line.unitPrice) &&
          line.unitPrice >= 0 &&
          Number.isFinite(line.discountPercent) &&
          line.discountPercent >= 0 &&
          line.discountPercent <= 100,
      )
    );
  }
  quoteHelp() {
    if (!this.quoteCustomer()) return 'เลือกลูกค้าจากทะเบียน';
    if (this.quoteForm.controls.number.invalid) return 'ระบุเลขที่ใบเสนอราคา';
    if (this.quoteForm.controls.validUntil.invalid) return 'ระบุวันที่ยืนราคา';
    if (this.quoteForm.controls.customerAddress.invalid)
      return 'เพิ่มที่อยู่ออกเอกสารในหัวข้อเงื่อนไข';
    if (!this.validQuoteLines())
      return 'เลือกสินค้าเดิม หรือกรอก Requirement พร้อมจำนวนและหน่วยให้ครบ';
    return 'ตรวจวันที่และการตั้งค่า VAT ของบริษัท';
  }
  async saveQuote() {
    this.quoteForm.markAllAsTouched();
    if (this.quoteForm.invalid || this.quoteBlocked() || !this.validQuoteLines()) return;
    this.actionError.set('');
    await this.quoteMutation.run<ApiRecord>(
      '/quotations',
      {
        ...this.quoteForm.getRawValue(),
        expectedCustomerVersion: this.quoteCustomer()?.version,
        useCustomAddress:
          !!this.quoteCustomer() &&
          this.quoteForm.controls.customerAddress.value.trim() !==
            (
              this.quoteCustomer()?.addresses.find((x) => x.addressType === 'Billing')
                ?.addressText ?? ''
            ).trim(),
        currency: 'THB',
        items: this.quoteLines.map(({ sourceType, ...line }) => ({
          ...line,
          unitPrice: 0,
          discountPercent: 0,
          productRevisionId: sourceType === 'Existing' ? line.productRevisionId : null,
        })),
      },
      async (created) => {
        this.quoteOpen.set(false);
        this.quoteDirty.set(false);
        this.notice.set('บันทึกร่างแล้ว · ส่ง Design หรือตั้งราคาสินค้าเดิมต่อได้เลย');
        this.quoteLines = [this.newLine()];
        await this.load();
        await this.open(created);
      },
    );
  }
}
