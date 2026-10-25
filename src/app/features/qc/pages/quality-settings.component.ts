import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { components } from '../../../core/services/api/generated/native-schema';
import { problemMessage } from '../../../core/services/api/api-client.service';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import { MutationSession } from '../../../shared/utils/mutation-session';
import { QualityApi } from '../services/quality-api.service';

type Settings = components['schemas']['QualitySettingsWorkspace'];
type Group = components['schemas']['QualityGroupDto'];
type Template = components['schemas']['QualityTemplateDto'];
type Product = components['schemas']['QualityItemAssignment'];
type Check = { code: string; label: string; required: boolean };
type Slot = { side: string; slot: number; label: string; required: boolean; base: boolean };
@Component({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, Drawer, StateMessage],
  providers: [MutationSession],
  templateUrl: './quality-settings.component.html',
  styleUrl: './quality-settings.component.scss',
})
export class QualitySettingsPage {
  private api = inject(QualityApi);
  readonly command = inject(MutationSession);
  data = signal<Settings | null>(null);
  busy = signal(false);
  error = signal('');
  notice = signal('');
  fields = signal<Record<string, string>>({});
  groupId = '';
  templateId = '';
  checklist: Check[] = [];
  slots: Slot[] = [];
  private editorBaseline = '';
  groupOpen = signal(false);
  editingGroup = signal<Group | null>(null);
  groupCode = '';
  groupName = '';
  groupActive = true;
  private groupBaseline = '';
  publishOpen = signal(false);
  publishReason = '';
  assignmentOpen = signal(false);
  product = signal<Product | null>(null);
  readonly productChoice = new FormControl('', { nonNullable: true });
  private pendingProductChoice: Product | null = null;
  private pendingAssignmentGroup: string | null = null;
  productSearch = '';
  assignmentGroup = signal('');
  private assignmentBaseline = '';
  discard = signal(false);
  private pendingAction: (() => void) | null = null;
  private pendingLeave: ((ok: boolean) => void) | null = null;
  conflictCopy = signal('');
  showConflictCopy = signal(false);
  ngOnInit() {
    void this.load();
  }
  num(v: number | string | null | undefined) {
    return Number(v ?? 0);
  }
  blocked() {
    return this.busy() || this.command.busy() || this.command.uncertain();
  }
  group() {
    return this.data()?.groups.find((x) => x.id === this.groupId);
  }
  templates() {
    return this.data()?.templates.filter((x) => x.groupId === this.groupId) ?? [];
  }
  template() {
    return this.data()?.templates.find((x) => x.id === this.templateId);
  }
  private editorSnapshot() {
    return JSON.stringify([this.checklist, this.slots]);
  }
  editorDirty() {
    return !!this.templateId && this.editorSnapshot() !== this.editorBaseline;
  }
  private groupSnapshot() {
    return JSON.stringify([this.groupCode, this.groupName, this.groupActive]);
  }
  private assignmentSnapshot() {
    return JSON.stringify([this.product()?.itemId ?? '', this.assignmentGroup()]);
  }
  assignmentDirty() {
    return !!this.product() && this.assignmentGroup() !== this.product()!.groupId;
  }
  dirty() {
    return (
      this.editorDirty() ||
      (this.groupOpen() && this.groupSnapshot() !== this.groupBaseline) ||
      (this.assignmentOpen() && this.assignmentDirty()) ||
      (this.publishOpen() && !!this.publishReason.trim()) ||
      !!this.conflictCopy()
    );
  }
  async fetch() {
    const data = await this.api.settings(this.productSearch);
    this.data.set(data);
    return data;
  }
  async load() {
    if (this.blocked()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.fetch();
      if (!this.groupId) {
        this.groupId = this.data()?.groups[0]?.id ?? '';
        this.chooseTemplate(this.templates()[0]?.id ?? '');
      }
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
      const pending = this.pendingProductChoice;
      const group = this.pendingAssignmentGroup;
      this.pendingProductChoice = null;
      this.pendingAssignmentGroup = null;
      if (pending && this.assignmentOpen()) this.applyProductChoice(pending, group);
    }
  }
  private request(action: () => void, dirty: boolean) {
    if (this.blocked()) return;
    if (dirty) {
      this.pendingAction = action;
      this.discard.set(true);
    } else action();
  }
  selectGroup(id: string) {
    this.request(() => {
      this.groupId = id;
      this.chooseTemplate(this.templates()[0]?.id ?? '');
    }, this.editorDirty());
  }
  changeGroup(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    select.value = this.groupId;
    this.selectGroup(id);
  }
  selectTemplate(id: string) {
    this.request(() => this.chooseTemplate(id), this.editorDirty());
  }
  changeTemplate(event: Event) {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    select.value = this.templateId;
    this.selectTemplate(id);
  }
  private chooseTemplate(id: string) {
    this.templateId = id;
    const t = this.template();
    this.checklist = t?.checklist.map((x) => ({ ...x })) ?? [];
    this.slots =
      t?.photoSlots.map((x) => ({
        ...x,
        slot: this.num(x.slot),
        base: ['FRONT', 'BACK', 'LEFT', 'RIGHT'].includes(x.side) && this.num(x.slot) === 1,
      })) ?? [];
    this.editorBaseline = this.editorSnapshot();
    this.fields.set({});
  }
  canLeave() {
    if (this.command.busy() || this.command.uncertain()) return false;
    if (!this.dirty()) return true;
    this.discard.set(true);
    return new Promise<boolean>((resolve) => (this.pendingLeave = resolve));
  }
  confirmDiscard(ok: boolean) {
    this.discard.set(false);
    const action = this.pendingAction;
    this.pendingAction = null;
    const leave = this.pendingLeave;
    this.pendingLeave = null;
    if (ok) action?.();
    leave?.(ok);
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.dirty() || this.command.busy() || this.command.uncertain()) event.preventDefault();
  }
  addCheck() {
    this.checklist.push({ code: '', label: '', required: true });
  }
  addSlot() {
    const max = this.slots
      .filter((x) => x.side === 'OTHER')
      .reduce((n, x) => Math.max(n, x.slot), 0);
    this.slots.push({ side: 'OTHER', slot: max + 1, label: '', required: false, base: false });
  }
  baseSlot(slot: Slot) {
    return slot.base;
  }
  private validate() {
    const errors: Record<string, string> = {};
    const codes = this.checklist.map((x) => x.code.trim().toUpperCase());
    for (let i = 0; i < this.checklist.length; i++) {
      const row = this.checklist[i];
      if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(codes[i]) || codes.indexOf(codes[i]) !== i)
        errors['check' + i] = 'ระบุรหัสไม่ซ้ำ ใช้ A–Z / 0–9 / _ / -';
      if (!row.label.trim()) errors['label' + i] = 'ระบุชื่อจุดตรวจ';
    }
    for (let i = 0; i < this.slots.length; i++) {
      const row = this.slots[i];
      if (
        !row.label.trim() ||
        row.slot < 1 ||
        row.slot > 24 ||
        !Number.isInteger(row.slot) ||
        this.slots.some((x, j) => j !== i && x.side === row.side && x.slot === row.slot)
      )
        errors['slot' + i] = 'ระบุชื่อด้านและเลขช่องไม่ซ้ำ (1–24)';
    }
    if (
      !this.checklist.length ||
      this.checklist.length > 100 ||
      !this.slots.length ||
      this.slots.length > 24
    )
      errors['template'] = 'ต้องมี1–100จุดตรวจ และ1–24ช่องรูป';
    this.fields.set(errors);
    return !Object.keys(errors).length;
  }
  async createTemplate() {
    const group = this.group();
    if (!group || this.blocked() || this.editorDirty()) return;
    this.command.clear();
    await this.command.run<Template>(
      '/quality/templates',
      {
        groupId: group.id,
        expectedGroupVersion: group.version,
        copyTemplateId: this.template()?.id ?? null,
      },
      async (result) => {
        await this.fetch();
        this.chooseTemplate(result.id);
        this.notice.set('สร้างแบบตรวจฉบับร่างแล้ว · แก้ไขและเผยแพร่เมื่อพร้อม');
      },
    );
  }
  async saveTemplate() {
    const t = this.template();
    if (!t || t.status !== 'DRAFT' || this.blocked() || !this.validate()) return;
    await this.command.run<Template>(
      '/quality/templates/' + t.id,
      {
        expectedVersion: t.version,
        checklist: this.checklist.map((x) => ({
          code: x.code.trim().toUpperCase(),
          label: x.label.trim(),
          required: x.required,
        })),
        photoSlots: this.slots.map((x) => ({
          side: x.side,
          slot: x.slot,
          label: x.label.trim(),
          required: x.required,
        })),
      },
      async (result) => {
        await this.fetch();
        this.chooseTemplate(result.id);
        this.notice.set('บันทึกร่างแบบตรวจแล้ว');
      },
    );
  }
  beginPublish() {
    if (this.blocked() || this.editorDirty() || this.template()?.status !== 'DRAFT') return;
    this.command.clear();
    this.publishReason = '';
    this.publishOpen.set(true);
  }
  async publish() {
    const t = this.template();
    if (!t || this.blocked() || !this.publishReason.trim()) return;
    await this.command.run<Template>(
      '/quality/templates/' + t.id + '/publish',
      { expectedVersion: t.version, reason: this.publishReason.trim() },
      async (result) => {
        await this.fetch();
        this.chooseTemplate(result.id);
        this.publishOpen.set(false);
        this.notice.set('เผยแพร่แบบตรวจแล้ว · มีผลกับการเริ่มตรวจใหม่ ผลตรวจเดิมไม่เปลี่ยน');
      },
    );
  }
  beginGroup(group: Group | null) {
    if (this.blocked() || this.editorDirty()) return;
    this.command.clear();
    this.editingGroup.set(group);
    this.groupCode = group?.code ?? '';
    this.groupName = group?.name ?? '';
    this.groupActive = group?.active ?? true;
    this.groupBaseline = this.groupSnapshot();
    this.groupOpen.set(true);
    this.fields.set({});
  }
  closeGroup() {
    this.request(() => this.groupOpen.set(false), this.groupSnapshot() !== this.groupBaseline);
  }
  async saveGroup() {
    if (this.blocked()) return;
    const code = this.groupCode.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code) || !this.groupName.trim()) {
      this.fields.set({ group: 'ระบุรหัสกลุ่มและชื่อกลุ่มให้ครบ' });
      return;
    }
    const old = this.editingGroup();
    await this.command.run<Group>(
      '/quality/groups' + (old ? '/' + old.id : ''),
      {
        expectedVersion: old?.version ?? null,
        code,
        name: this.groupName.trim(),
        active: this.groupActive,
      },
      async (result) => {
        await this.fetch();
        this.groupOpen.set(false);
        this.groupId = result.id;
        this.chooseTemplate(this.templates()[0]?.id ?? '');
        this.notice.set('บันทึกกลุ่มสินค้าแล้ว');
      },
    );
  }
  async beginAssignment() {
    if (this.blocked() || this.editorDirty()) return;
    this.command.clear();
    this.productSearch = '';
    this.product.set(null);
    this.pendingProductChoice = null;
    this.pendingAssignmentGroup = null;
    this.productChoice.setValue('', { emitEvent: false });
    this.assignmentGroup.set('');
    this.assignmentBaseline = this.assignmentSnapshot();
    this.assignmentOpen.set(true);
    await this.load();
  }
  changeProduct(id: string) {
    if (this.product()?.itemId === id) {
      this.pendingProductChoice = null;
      this.pendingAssignmentGroup = null;
      this.productChoice.setValue(id, { emitEvent: false });
      return;
    }
    const product = this.data()?.products.find((x) => x.itemId === id);
    if (!product) {
      this.productChoice.setValue(this.product()?.itemId ?? '', { emitEvent: false });
      return;
    }
    // A native change can already be queued when the search makes its fieldset
    // busy. Keep the user's selection and apply it after that read finishes;
    // resetting before request() would silently lose it on its busy guard.
    if (this.busy()) {
      this.pendingProductChoice = product;
      return;
    }
    this.applyProductChoice(product);
  }
  changeAssignmentGroup(group: string) {
    if (this.pendingProductChoice) this.pendingAssignmentGroup = group;
    else this.assignmentGroup.set(group);
  }
  private applyProductChoice(selected: Product, group: string | null = null) {
    const product = this.data()?.products.find((x) => x.itemId === selected.itemId) ?? selected;
    this.productChoice.setValue(this.product()?.itemId ?? '', { emitEvent: false });
    this.request(() => {
      this.product.set(product);
      this.assignmentGroup.set(group ?? product.groupId);
      this.productChoice.setValue(product.itemId, { emitEvent: false });
    }, this.assignmentDirty());
  }
  productNotListed() {
    return (
      !!this.product() && !this.data()?.products.some((x) => x.itemId === this.product()!.itemId)
    );
  }
  closeAssignment() {
    this.request(() => this.assignmentOpen.set(false), this.assignmentDirty());
  }
  async assign() {
    const p = this.product();
    if (!p || !this.assignmentGroup() || this.blocked()) return;
    await this.command.run<Product>(
      '/quality/products/' + p.itemId + '/group',
      { expectedVersion: p.version, groupId: this.assignmentGroup() },
      async (result) => {
        await this.fetch();
        this.product.set(result);
        this.assignmentOpen.set(false);
        this.notice.set('กำหนดกลุ่ม QC ของสินค้าแล้ว · มีผลกับการเริ่มตรวจใหม่');
      },
    );
  }
  closePublish() {
    this.request(() => this.publishOpen.set(false), !!this.publishReason.trim());
  }
  async reloadConflict() {
    if (this.command.busy() || this.command.uncertain()) return;
    this.command.clear();
    const t = this.templateId;
    this.busy.set(true);
    try {
      await this.fetch();
      const latest = this.template();
      if (latest?.status === 'PUBLISHED' && this.editorDirty()) {
        this.conflictCopy.set(
          this.checklist
            .map((x) => x.code + ' · ' + x.label + ' · ' + (x.required ? 'บังคับ' : 'ไม่บังคับ'))
            .join('\n') +
            '\n' +
            this.slots.map((x) => x.side + ' ' + x.slot + ' · ' + x.label).join('\n'),
        );
        this.chooseTemplate(t);
      }
      if (this.editingGroup()) {
        const latestGroup = this.data()?.groups.find((x) => x.id === this.editingGroup()!.id);
        if (latestGroup) this.editingGroup.set(latestGroup);
      }
      if (this.product()) {
        const latestProduct = await this.api.assignment(this.product()!.itemId);
        this.product.set(latestProduct);
      }
      this.notice.set('โหลดข้อมูลล่าสุดแล้ว · ข้อแก้ไขที่ยังเป็นร่างคงอยู่ กรุณาตรวจก่อนบันทึก');
    } catch (e) {
      this.error.set(problemMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
