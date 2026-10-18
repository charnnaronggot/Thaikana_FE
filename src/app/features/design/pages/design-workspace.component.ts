import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Drawer, StatusBadge } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { DesignApi } from '../services/design-api.service';
import { Subscription } from 'rxjs';
import { WorkflowGuide } from '../../../shared/components/workflow-guide.component';
import { materialAmount } from '../../../shared/utils/material-cost';
import { designReadiness } from '../models/readiness';
import {
  CostCategory,
  DesignDetail,
  DesignDrawing,
  DesignInbox,
  DesignLookups,
  DesignTask,
} from '../models/design.models';

@Component({
  selector: 'app-design-workspace',
  imports: [CommonModule, FormsModule, Drawer, StatusBadge, WorkflowGuide],
  providers: [MutationSession],
  templateUrl: './design-workspace.component.html',
  styleUrl: './design-workspace.component.scss',
})
export class DesignWorkspace implements OnInit, OnDestroy {
  private api = inject(DesignApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  readonly mutation = inject(MutationSession);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly notice = signal('');
  readonly uploading = signal(false);
  inbox: DesignInbox = { tasks: [], products: [] };
  lookups: DesignLookups = { items: [], uoms: [], plants: [], revisions: [] };
  detail: DesignDetail | null = null;
  tab = 'Spec';
  listTab = 'tasks';
  search = '';
  status = 'current';
  dirty = false;
  createOpen = false;
  forking = false;
  publishOpen = false;
  task: DesignTask | null = null;
  draft = {
    itemId: '',
    newProduct: false,
    code: '',
    name: '',
    uomId: '',
    plantId: '',
    predecessorId: '',
  };
  readonly tabs = ['Spec', 'Drawing', 'BOM', 'COGS', 'Revision'];
  readonly tabNames: Record<string, string> = {
    Spec: 'ข้อกำหนด (Spec)',
    Drawing: 'ไฟล์แบบ (Drawing)',
    BOM: 'วัสดุ (BOM)',
    COGS: 'ต้นทุน (COGS)',
    Revision: 'ประวัติ (Revision)',
  };
  get readiness() {
    return this.detail ? designReadiness(this.detail) : [];
  }
  get workflowSteps() {
    const active =
      this.detail?.revision.status === 'PUBLISHED'
        ? 4
        : this.readiness.slice(0, 3).some((x) => !x.ready)
          ? 1
          : !this.readiness[3]?.ready
            ? 2
            : 3;
    return ['รับโจทย์ Sales', 'เตรียมแบบและวัสดุ', 'ตรวจต้นทุน', 'ส่งกลับ Sales'].map(
      (label, i) => ({ label, complete: i < active, current: i === active }),
    );
  }
  get nextStep() {
    if (!this.detail?.current)
      return {
        title: 'โจทย์นี้ถูกแทนที่แล้ว',
        description: 'ดูประวัติได้ กรุณากลับรายการแล้วเปิดโจทย์ล่าสุดจาก Sales',
        owner: 'Sales / Design',
      };
    if (this.detail.revision.status === 'PUBLISHED')
      return {
        title: 'แบบและต้นทุนส่งถึง Sales แล้ว',
        description:
          'Sales นำรุ่นนี้ไปตั้งราคาได้ หากลูกค้าเปลี่ยนสเปกให้ Sales ส่งโจทย์ใหม่เฉพาะรายการที่เปลี่ยน',
        owner: 'Sales',
      };
    const issue = this.readiness.find((x) => !x.ready);
    return issue
      ? {
          title: 'ทำต่อ: ' + issue.label,
          description: issue.help + ' · บันทึกร่างเก็บงานไว้ก่อนได้',
          owner: 'Design',
        }
      : {
          title: 'ข้อมูลครบแล้ว · พร้อมส่งให้ Sales',
          description: 'ตรวจสรุปแบบ BOM และต้นทุนก่อนส่ง รุ่นที่ส่งแล้วจะเก็บไว้แก้ทับไม่ได้',
          owner: 'Design',
        };
  }
  taskState(t: DesignTask) {
    return !t.current
      ? 'history'
      : t.revisions.some((r) => r.status === 'DRAFT')
        ? 'progress'
        : t.revisions.some((r) => r.status === 'PUBLISHED')
          ? 'ready'
          : 'pending';
  }
  readonly categories: CostCategory[] = ['MATERIAL', 'LABOR', 'OVERHEAD', 'WASTE'];
  readonly categoryNames: Record<CostCategory, string> = {
    MATERIAL: 'วัตถุดิบ',
    LABOR: 'ค่าแรง',
    OVERHEAD: 'ค่าใช้จ่ายการผลิต',
    WASTE: 'สูญเสีย',
  };
  readonly preview = signal<{
    name: string;
    kind: 'image' | 'pdf';
    url: string;
    safe: SafeResourceUrl;
  } | null>(null);
  private createdId = '';
  private loadGeneration = 0;
  private routeSubscription?: Subscription;
  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe(() => {
      void this.load();
    });
  }
  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    this.closePreview();
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty || this.mutation.busy() || this.mutation.uncertain() || this.uploading()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  canLeave() {
    if (this.mutation.busy() || this.mutation.uncertain() || this.uploading()) return false;
    return (
      !this.dirty || window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?')
    );
  }
  async load() {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set('');
    this.detail = null;
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const [result, lookups] = await Promise.all([
        id ? this.api.detail(id) : this.api.inbox(),
        this.api.lookups(),
      ]);
      if (generation !== this.loadGeneration) return;
      if (id) this.detail = result as DesignDetail;
      else this.inbox = result as DesignInbox;
      this.lookups = lookups;
      this.dirty = false;
      this.normalize();
    } catch (e) {
      if (generation === this.loadGeneration) this.error.set(problemMessage(e));
    } finally {
      if (generation === this.loadGeneration) this.loading.set(false);
    }
  }
  normalize() {
    if (this.detail) {
      const spec = this.detail.specification;
      spec.description = typeof spec.description === 'string' ? spec.description : '';
      spec.dimensions = typeof spec.dimensions === 'string' ? spec.dimensions : '';
      spec.finish = typeof spec.finish === 'string' ? spec.finish : '';
      spec.checklist = Array.isArray(spec.checklist) ? spec.checklist : [];
    }
  }
  get locked() {
    return (
      !this.detail ||
      this.detail.revision.status !== 'DRAFT' ||
      !this.detail.current ||
      this.loading() ||
      this.mutation.busy() ||
      this.mutation.uncertain() ||
      this.uploading()
    );
  }
  get blocked() {
    return this.loading() || this.mutation.busy() || this.mutation.uncertain() || this.uploading();
  }
  get tasks() {
    const q = this.search.toLowerCase();
    return this.inbox.tasks.filter(
      (t) =>
        (this.status === 'all' || t.current) &&
        (!['pending', 'progress', 'ready'].includes(this.status) ||
          this.taskState(t) === this.status) &&
        JSON.stringify(t).toLowerCase().includes(q),
    );
  }
  get products() {
    const q = this.search.toLowerCase();
    return this.inbox.products.filter((p) =>
      `${p.code} ${p.name} ${p.revisionCode}`.toLowerCase().includes(q),
    );
  }
  get pending() {
    return this.inbox.tasks.filter((t) => this.taskState(t) === 'pending').length;
  }
  get inProgress() {
    return this.inbox.tasks.filter((t) => this.taskState(t) === 'progress').length;
  }
  get ready() {
    return this.inbox.tasks.filter((t) => this.taskState(t) === 'ready').length;
  }
  get fgItems() {
    return this.lookups.items.filter((i) => i.itemType === 'FG');
  }
  get componentItems() {
    return this.lookups.items.filter((i) => i.id !== this.detail?.item.id);
  }
  item(id: string) {
    return this.lookups.items.find((i) => i.id === id);
  }
  unit(itemId: string) {
    return this.lookups.uoms.find((u) => u.id === this.item(itemId)?.baseUomId)?.code ?? '—';
  }
  componentRevisions(itemId: string) {
    return this.lookups.revisions.filter((r) => r.itemId === itemId);
  }
  materialReference(itemId: string) {
    return this.lookups.materialCosts?.find(
      (x) => x.itemId === itemId && x.plantId === this.detail?.plantId,
    );
  }
  componentChanged(c: DesignDetail['components'][number]) {
    c.revisionId = null;
    const reference = this.materialReference(c.itemId);
    c.unitCost = reference?.unitCost ?? null;
    c.costSource = reference ? `${reference.source} · ${reference.postedAt}` : '';
    this.changed();
  }
  componentAmount(c: DesignDetail['components'][number]) {
    return materialAmount(c.quantity, c.scrapAllowancePct, c.unitCost);
  }
  get bomMaterialTotal() {
    const rows = this.detail?.components ?? [];
    if (!rows.length || rows.some((x) => this.componentAmount(x) === null)) return null;
    return rows.reduce((sum, x) => sum + this.componentAmount(x)!, 0);
  }
  useBomMaterialTotal() {
    const total = this.bomMaterialTotal;
    if (!this.detail || total === null) return;
    this.detail.costs = this.detail.costs.filter((x) => x.category !== 'MATERIAL');
    this.detail.costs.push({
      category: 'MATERIAL',
      quantity: 1,
      unitCost: total,
      sourceNote: 'BOM รวมเผื่อสูญเสีย · ต้นทุนบันทึกต่อชุดผลผลิตฐาน',
    });
    this.changed();
    this.notice.set('ใช้ยอด BOM เป็นต้นทุน Material แล้ว · ตรวจต้นทุนหมวดอื่นก่อนบันทึก');
  }
  amount(quantity: number, cost: number) {
    return Math.round((Number(quantity) || 0) * (Number(cost) || 0) * 1e6) / 1e6;
  }
  subtotal(category: CostCategory) {
    return (
      this.detail?.costs
        .filter((c) => c.category === category)
        .reduce((s, c) => s + this.amount(c.quantity, c.unitCost), 0) ?? 0
    );
  }
  get total() {
    return this.categories.reduce((s, c) => s + this.subtotal(c), 0);
  }
  get perUnit() {
    return this.detail?.outputBaseQty ? this.total / this.detail.outputBaseQty : 0;
  }
  requirements(value: unknown): { label: string; value: string }[] {
    if (!value || typeof value !== 'object')
      return [{ label: 'Requirement', value: String(value ?? '—') }];
    const labels: Record<string, string> = {
      description: 'รายละเอียด',
      specifications: 'ข้อกำหนด',
      reason: 'เหตุผลที่แก้แบบ',
      dimensions: 'ขนาด',
      finish: 'พื้นผิว',
      name: 'ชื่อสินค้า',
      productName: 'สินค้า',
      notes: 'หมายเหตุ',
    };
    return Object.entries(value)
      .filter(([key, v]) => !key.endsWith('Id') && v !== null && v !== '')
      .map(([key, v]) => ({
        label: labels[key] ?? key,
        value:
          typeof v === 'object'
            ? this.requirements(v)
                .map((r) => r.value)
                .join(' · ')
            : String(v),
      }));
  }
  async open(id: string) {
    if (!this.canLeave()) return;
    this.dirty = false;
    await this.router.navigateByUrl('/design/revisions/' + id);
  }
  async back() {
    if (!this.canLeave()) return;
    this.dirty = false;
    await this.router.navigateByUrl('/design');
  }
  start(task: DesignTask | null = null) {
    this.forking = false;
    this.task = task;
    this.draft = {
      itemId: task?.itemId ?? '',
      newProduct: !task?.itemId,
      code: '',
      name: task
        ? (this.requirements(task.requirement)
            .find((x) => x.label === 'รายละเอียด')
            ?.value.slice(0, 200) ?? '')
        : '',
      uomId: task?.requestedUomId ?? this.lookups.uoms[0]?.id ?? '',
      plantId: this.lookups.plants[0]?.id ?? '',
      predecessorId: '',
    };
    this.createOpen = true;
  }
  fork() {
    if (!this.detail) return;
    this.forking = true;
    this.task = null;
    this.draft = {
      itemId: this.detail.item.id,
      newProduct: false,
      code: '',
      name: '',
      uomId: this.detail.item.baseUomId,
      plantId: this.detail.plantId,
      predecessorId: this.detail.revision.id,
    };
    this.createOpen = true;
  }
  get createValid() {
    return (
      !!this.draft.plantId &&
      (this.draft.newProduct
        ? !!this.draft.code.trim() && !!this.draft.name.trim() && !!this.draft.uomId
        : !!this.draft.itemId)
    );
  }
  async create() {
    if (!this.createValid || this.blocked) return;
    await this.mutation.run<{ id: string }>(
      '/design/revisions',
      {
        submissionId: this.task?.id ?? null,
        itemId: this.draft.newProduct ? null : this.draft.itemId,
        newItem: this.draft.newProduct
          ? {
              code: this.draft.code.trim(),
              name: this.draft.name.trim(),
              baseUomId: this.draft.uomId,
            }
          : null,
        plantId: this.draft.plantId,
        predecessorId: this.draft.newProduct ? null : this.draft.predecessorId || null,
      },
      (r) => {
        this.createOpen = false;
        this.createdId = r.id;
      },
    );
    await this.openCreated();
  }
  async retryCommand() {
    await this.mutation.retry();
    await this.openCreated();
  }
  private async openCreated() {
    if (this.createdId) {
      const id = this.createdId;
      this.createdId = '';
      await this.router.navigateByUrl('/design/revisions/' + id);
    }
  }
  changed() {
    this.dirty = true;
    this.notice.set('');
  }
  addBom() {
    this.detail?.components.push({
      itemId: '',
      revisionId: null,
      quantity: 1,
      scrapAllowancePct: 0,
      note: '',
    });
    this.changed();
  }
  addCost() {
    this.detail?.costs.push({ category: 'MATERIAL', quantity: 1, unitCost: 0, sourceNote: '' });
    this.changed();
  }
  addCheck() {
    this.detail?.specification.checklist.push({ code: '', label: '', required: true });
    this.changed();
  }
  remove(array: unknown[], index: number) {
    array.splice(index, 1);
    this.changed();
  }
  get validation() {
    const d = this.detail;
    if (!d) return '';
    if (!(d.outputBaseQty > 0)) return 'จำนวนผลผลิตฐานต้องมากกว่า 0';
    if (
      d.components.some(
        (c) =>
          !c.itemId || !(c.quantity > 0) || c.scrapAllowancePct < 0 || c.scrapAllowancePct > 100,
      )
    )
      return 'ตรวจรายการ BOM: สินค้า จำนวน และ % เผื่อสูญเสีย';
    if (
      d.components.some(
        (c) =>
          c.unitCost != null &&
          (!Number.isFinite(c.unitCost) || c.unitCost < 0 || !c.costSource?.trim()),
      )
    )
      return 'ตรวจต้นทุนวัตถุดิบและแหล่งอ้างอิงให้ครบ';
    if (
      d.costs.some(
        (c) =>
          !Number.isFinite(Number(c.quantity)) ||
          !Number.isFinite(Number(c.unitCost)) ||
          c.quantity < 0 ||
          c.unitCost < 0 ||
          !c.sourceNote.trim(),
      )
    )
      return 'กรอกแหล่งอ้างอิงต้นทุนและจำนวน/ราคาให้ถูกต้อง';
    if (d.drawings.some((x) => !x.drawingNo.trim())) return 'กรอกเลขที่แบบให้ครบ';
    return '';
  }
  get publishIssues() {
    return this.readiness.filter((x) => !x.ready).map((x) => x.help);
  }
  async preparePublish() {
    if (this.locked) return;
    if (this.dirty) await this.save();
    if (!this.dirty && !this.mutation.error() && !this.mutation.uncertain())
      this.publishOpen = true;
  }
  async save() {
    const d = this.detail;
    if (this.locked || !d) return;
    if (this.validation) {
      this.error.set(this.validation);
      return;
    }
    await this.mutation.run(
      '/design/revisions/' + d.revision.id + '/save',
      {
        expectedVersion: d.revision.rowVersion,
        specification: d.specification,
        outputBaseQty: d.outputBaseQty,
        components: d.components,
        drawings: d.drawings.map(({ fileId, drawingNo, note }) => ({ fileId, drawingNo, note })),
        costs: d.costs.map(({ category, quantity, unitCost, sourceNote }) => ({
          category,
          quantity,
          unitCost,
          sourceNote,
        })),
      },
      async () => {
        this.detail = await this.api.detail(d.revision.id);
        this.normalize();
        this.dirty = false;
        this.error.set('');
        this.notice.set('บันทึก Draft แล้ว');
      },
    );
  }
  async publish() {
    if (!this.detail || this.locked || this.dirty || this.publishIssues.length) return;
    const id = this.detail.revision.id;
    await this.mutation.run(
      '/design/revisions/' + id + '/publish',
      { expectedVersion: this.detail.revision.rowVersion },
      async () => {
        this.detail = await this.api.detail(id);
        this.publishOpen = false;
        this.notice.set('Publish แล้ว · Sales สามารถใช้ Revision นี้จัดราคาได้');
      },
    );
  }
  async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.locked || !this.detail) return;
    this.error.set('');
    if (file.size > 20 * 1024 * 1024) {
      this.error.set('ไฟล์ต้องไม่เกิน 20 MiB');
      input.value = '';
      return;
    }
    this.uploading.set(true);
    try {
      const r = await this.api.upload(file, this.detail.revision.id);
      this.detail.drawings.push({
        fileId: r.id,
        drawingNo: '',
        note: '',
        originalName: r.originalName,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
      });
      this.changed();
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }
  async view(file: { fileId: string; originalName?: string; mimeType?: string }, download = false) {
    try {
      const blob = await this.api.file(file.fileId);
      const url = URL.createObjectURL(blob);
      const mime = file.mimeType ?? blob.type;
      if (
        !download &&
        (mime === 'application/pdf' || ['image/png', 'image/jpeg', 'image/webp'].includes(mime))
      ) {
        this.closePreview();
        this.preview.set({
          name: file.originalName ?? 'แบบ',
          kind: mime === 'application/pdf' ? 'pdf' : 'image',
          url,
          safe: this.sanitizer.bypassSecurityTrustResourceUrl(url),
        });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName ?? 'drawing';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e) {
      this.error.set(problemMessage(e));
    }
  }
  closePreview() {
    const preview = this.preview();
    if (preview) URL.revokeObjectURL(preview.url);
    this.preview.set(null);
  }
}
