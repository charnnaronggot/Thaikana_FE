import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ApiRecord, Page } from '../../core/models/api.models';
import { canOpenModule, workspaceModules } from '../../core/auth/workspace-policy';
import { problemMessage } from '../../core/services/api/api-client.service';
import { DataTable } from '../../shared/components/data-table.component';
import { Drawer, StateMessage } from '../../shared/components/ui';
import { MutationSession } from '../../shared/utils/mutation-session';
import { NativeApi } from './native-api.service';
import { detailLabels, nativeModules, NativeSection } from './native-modules';

@Component({
  imports: [FormsModule, RouterLink, DataTable, Drawer, StateMessage],
  providers: [MutationSession],
  templateUrl: './native-workspace.component.html',
  styleUrl: './native-workspace.component.scss',
})
export class NativeWorkspace {
  readonly auth = inject(AuthService);
  private api = inject(NativeApi);
  private route = inject(ActivatedRoute);
  readonly command = inject(MutationSession);
  readonly key = (this.route.snapshot.data['moduleKey'] as string) ?? 'workspace';
  readonly module = nativeModules[this.key];
  readonly title = this.module?.title ?? (this.key === 'overview' ? 'ภาพรวม' : 'พื้นที่ทำงาน');
  readonly sections = this.module?.sections ?? [];
  active = signal(0);
  page = signal(1);
  total = signal(0);
  rows = signal<ApiRecord[]>([]);
  loading = signal(false);
  error = signal('');
  notice = signal('');
  readonly cards = computed(() =>
    workspaceModules.filter((m) => canOpenModule(this.auth.user(), m.key) && m.key !== 'overview'),
  );
  readonly stats = signal<{ label: string; value: number }[]>([]);
  selected = signal<ApiRecord | null>(null);
  detail = signal<
    { label: string; rows: { fields: { label: string; value: string }[]; fileId?: string }[] }[]
  >([]);
  detailBusy = signal(false);
  detailError = signal('');
  action = signal<'create-work-order' | 'deny' | 'resubmit' | null>(null);
  reason = '';
  search = '';
  private generation = 0;
  private selectionGeneration = 0;
  private names: Record<string, string> = {};
  private itemUnits: Record<string, string> = {};
  private board?: { workOrders: ApiRecord[]; operations: ApiRecord[] };
  get section(): NativeSection | undefined {
    return this.sections[this.active()];
  }
  recordTitle(row: ApiRecord) {
    return String(
      row['woNo'] ??
        row['requestNo'] ??
        row['inspectionNo'] ??
        row['deliveryNo'] ??
        row['username'] ??
        this.section?.label ??
        'รายละเอียด',
    );
  }
  canLeave() {
    return !this.command.busy() && !this.command.uncertain();
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (!this.canLeave()) event.preventDefault();
  }
  ngOnInit() {
    void this.load();
  }
  async load() {
    if (this.loading() || !this.canLeave()) return;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.key === 'overview') {
        const result = await this.api.get<Record<string, number>>('/dashboard');
        const labels: Record<string, string> = {
          openWorkOrders: 'WO ที่ยังไม่จบ',
          activeRuns: 'งานกำลังผลิต',
          materialShortages: 'คำขอวัสดุขาด',
          pendingQc: 'รอตรวจ QC',
          pendingGps: 'รอตรวจสถานที่ส่งมอบ',
          failedPdf: 'เอกสารสร้างไม่สำเร็จ',
          unpublishedEvents: 'รายการรอประมวลผล',
        };
        if (generation === this.generation)
          this.stats.set(
            Object.entries(labels).map(([k, label]) => ({ label, value: result[k] ?? 0 })),
          );
        return;
      }
      if (!this.section) return;
      const needed =
        this.auth.user()?.permissions.includes('master.view') &&
        ['design', 'production', 'station', 'inventory', 'planning', 'qc'].includes(this.key);
      if (needed && !Object.keys(this.names).length) {
        const lookups = await Promise.all(
          ['items', 'locations', 'stations', 'uoms'].map((kind) => this.api.master(kind)),
        );
        for (const list of lookups)
          for (const item of list.items)
            this.names[item.id] = [item['code'], item['name']].filter(Boolean).join(' · ');
        for (const item of lookups[0].items)
          this.itemUnits[item.id] = String(item['baseUomId'] ?? '');
      }
      let data: Page<ApiRecord>;
      if (this.key === 'production' || this.key === 'station') {
        this.board = await this.api.get('/production-board');
        let all =
          this.section.kind === 'operations' ? this.board!.operations : this.board!.workOrders;
        all = all.map((row) => this.present(row));
        if (this.search.trim())
          all = all.filter((row) =>
            Object.values(row).some(
              (v) => typeof v === 'string' && v.toLowerCase().includes(this.search.toLowerCase()),
            ),
          );
        data = {
          items: all.slice((this.page() - 1) * 25, this.page() * 25),
          totalCount: all.length,
          page: this.page(),
          pageSize: 25,
        };
      } else if (this.section.kind === 'users')
        data = await this.api.get<Page<ApiRecord>>('/users', {
          page: this.page(),
          pageSize: 25,
          search: this.search,
        });
      else data = await this.api.records(this.section.kind, this.page(), this.search);
      if (generation === this.generation) {
        this.rows.set(data.items.map((row) => this.present(row)));
        this.total.set(data.totalCount);
      }
    } catch (e) {
      if (generation === this.generation) {
        this.error.set(problemMessage(e));
        this.rows.set([]);
      }
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  switchTab(index: number) {
    if (this.loading() || !this.canLeave()) return;
    this.active.set(index);
    this.page.set(1);
    this.search = '';
    this.selected.set(null);
    this.rows.set([]);
    this.total.set(0);
    void this.load();
  }
  paginate(delta: number) {
    this.page.update((p) => p + delta);
    void this.load();
  }
  private present(row: ApiRecord): ApiRecord {
    const source = { ...row };
    source['demandTypeLabel'] = row['demandType'] === 'SALES_ORDER' ? 'ผลิตตามคำสั่งขาย' :
      row['demandType'] === 'STOCK_REPLENISHMENT' ? 'ผลิตเก็บสต็อก' : row['demandType'];
    for (const [field, label] of [
      ['itemId', 'itemName'],
      ['componentItemId', 'itemName'],
      ['storageLocationId', 'locationName'],
      ['workCenterId', 'centerName'],
    ] as const)
      if (typeof source[field] === 'string')
        source[label] = this.names[String(source[field])] ?? '—';
    if (row['itemId']) source['productName'] = this.names[String(row['itemId'])] ?? '—';
    const itemId = row['itemId'] ?? row['componentItemId'];
    if (itemId) source['unitName'] = this.names[this.itemUnits[String(itemId)]] ?? '—';
    if (row['workOrderId'])
      source['workOrderNumber'] =
        this.board?.workOrders.find((w) => w.id === row['workOrderId'])?.['woNo'] ?? '—';
    if (Array.isArray(row['roles'])) source['rolesLabel'] = row['roles'].join(' · ');
    for (const field of ['requirementSnapshot', 'requirement'])
      if (typeof row[field] === 'string') {
        try {
          const requirement = JSON.parse(String(row[field]));
          if (typeof requirement.description === 'string')
            source['description'] = requirement.description;
        } catch {}
      }
    return source;
  }
  private fields(row: ApiRecord) {
    return Object.entries(detailLabels)
      .filter(
        ([key]) =>
          row[key] !== null &&
          row[key] !== undefined &&
          ['string', 'number', 'boolean'].includes(typeof row[key]),
      )
      .map(([key, label]) => ({ label, value: this.fieldValue(key, row[key]) }));
  }
  private fieldValue(key: string, value: unknown) {
    if (key === 'demandType') return value === 'SALES_ORDER' ? 'ผลิตตามคำสั่งขาย' : value === 'STOCK_REPLENISHMENT' ? 'ผลิตเก็บสต็อก' : String(value);
    if (typeof value === 'boolean')
      return key === 'passed' ? (value ? 'ผ่าน' : 'ไม่ผ่าน') : value ? 'ใช่' : 'ไม่ใช่';
    if (typeof value === 'number')
      return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(value);
    if (
      typeof value === 'string' &&
      /(At|Date|Time)$/.test(key) &&
      !Number.isNaN(Date.parse(value))
    )
      return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
        dateStyle: 'medium',
        ...(key.endsWith('Date') ? {} : { timeStyle: 'short' }),
      }).format(new Date(value));
    return String(value);
  }
  async open(row: ApiRecord) {
    if (this.loading() || !this.canLeave()) return;
    const selection = ++this.selectionGeneration;
    this.selected.set(row);
    this.detail.set([]);
    this.detailBusy.set(true);
    this.detailError.set('');
    try {
      let data: Record<string, unknown> = { header: row };
      if (this.section?.detail) data = await this.api.detail(this.section.kind, row.id);
      if (this.section?.kind === 'stock')
        data = {
          header: {
            ...row,
            available: (
              await this.api.get<{ available: number }>(
                '/inventory/buckets/' + row.id + '/availability',
              )
            ).available,
          },
        };
      const labels: Record<string, string> = {
        header: 'ข้อมูลหลัก',
        revision: 'แบบสินค้า',
        operation: 'ขั้นตอนผลิต',
        inspection: 'รายการตรวจ',
        delivery: 'รอบจัดส่ง',
        bom: 'BOM',
        items: 'รายการ',
        components: 'วัสดุ',
        operations: 'ขั้นตอน',
        drawings: 'แบบแนบ',
        results: 'ผลตรวจ',
        photos: 'รูปแนบ',
        dispositions: 'ผลการตัดสิน',
        submissions: 'ประวัติส่งแบบ',
        decisions: 'ประวัติ Planning',
        runs: 'รอบการผลิต',
        events: 'ประวัติเหตุการณ์',
      };
      const sections = [];
      for (const [key, label] of Object.entries(labels)) {
        const raw = data[key];
        if (!raw) continue;
        const rows = (Array.isArray(raw) ? raw : [raw])
          .filter((r) => r && typeof r === 'object')
          .map((raw) => {
            const item = this.present(raw as ApiRecord);
            return {
              fields: this.fields(item),
              fileId: typeof item['fileId'] === 'string' ? item['fileId'] : undefined,
            };
          })
          .filter((r) => r.fields.length || r.fileId);
        if (rows.length) sections.push({ label, rows });
      }
      if (selection === this.selectionGeneration) this.detail.set(sections);
    } catch (e) {
      if (selection === this.selectionGeneration) this.detailError.set(problemMessage(e));
    } finally {
      if (selection === this.selectionGeneration) this.detailBusy.set(false);
    }
  }
  close() {
    if (!this.canLeave()) return;
    this.selectionGeneration++;
    this.selected.set(null);
    this.detail.set([]);
  }
  canDecide() {
    return (
      this.key === 'planning' &&
      this.section?.kind === 'planning-requests' &&
      this.auth.user()?.permissions.includes('planning.decide') &&
      ['PENDING', 'MATERIAL_SHORTAGE'].includes(String(this.selected()?.status))
    );
  }
  canResubmit() {
    return this.key === 'planning' && this.section?.kind === 'planning-requests' &&
      this.auth.user()?.permissions.includes('planning.decide') && this.selected()?.status === 'DENIED';
  }
  begin(action: 'create-work-order' | 'deny' | 'resubmit') {
    if (action === 'resubmit' ? !this.canResubmit() : !this.canDecide()) return;
    this.reason = '';
    this.action.set(action);
  }
  async submit() {
    const row = this.selected(),
      action = this.action();
    if (!row || !action || (action === 'resubmit' ? !this.canResubmit() : !this.canDecide()) || (action === 'deny' && !this.reason.trim())) return;
    await this.command.run(
      '/planning-requests/' + row.id + '/' + action,
      action === 'deny' ? { reason: this.reason.trim() } : {},
      async () => {
        this.action.set(null);
        this.selected.set(null);
        this.notice.set(action === 'deny' ? 'ปฏิเสธคำขอแล้ว' : action === 'resubmit' ? 'ส่งคำขอกลับมาพิจารณาแล้ว' : 'สร้างใบสั่งผลิตแล้ว');
      },
    );
    if (!this.command.error()) await this.load();
  }
  async retryCommand() {
    await this.command.retry();
    if (!this.command.error()) await this.load();
  }
  async download(id: string) {
    try {
      const blob = await this.api.file(id),
        url = URL.createObjectURL(blob);
      const extensions: Record<string, string> = {
        'application/pdf': '.pdf',
        'image/png': '.png',
        'image/jpeg': '.jpg',
      };
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attachment' + (extensions[blob.type] ?? '');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.detailError.set(problemMessage(e));
    }
  }
}
