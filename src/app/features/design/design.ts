import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Badge, Feature, StateMessage } from '../../shared/ui';
import { ListFilter } from '../../shared/list-filter';
import { Assets } from '../../shared/assets';
import { DesignTask, BomLine } from '../../domain/models';
import { calculateCogs } from '../../domain/design';
@Component({
  imports: [ReactiveFormsModule, Badge, StateMessage, ListFilter, Assets],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">DESIGN WORKSPACE</p>
        <h1>{{ selected() ? 'ออกแบบสินค้า' : 'งานออกแบบ' }}</h1>
        <p class="muted">Spec · Drawing · BOM · COGS · Product Revision</p>
      </div>
      @if (selected()) {
        <button (click)="back()">กลับ Inbox</button>
      } @else if (session.can('Designer')) {
        <button class="primary" (click)="newProduct()">+ ออกแบบสินค้าผลิตเก็บสต็อก</button>
      }
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (selected(); as task) {
      @if (rev(); as r) {
        <section class="card">
          <div class="section-heading">
            <div>
              <h2>
                {{ r.code }} · {{ r.name }} <span class="muted">/ Rev.{{ r.revision }}</span>
              </h2>
              <small>{{ quoteName(task.quoteId) }} · Design Task {{ task.id.slice(0, 8) }}</small>
            </div>
            <app-badge [value]="r.status" />
          </div>
          <div class="tabs">
            @for (t of tabs; track t) {
              <button [class.active]="tab() === t" (click)="tab.set(t)">{{ t }}</button>
            }
          </div>
          <form [formGroup]="form">
            @if (tab() === 'Spec') {
              <div class="form-grid">
                <label class="wide"
                  >Specification<textarea
                    formControlName="spec"
                    [readonly]="r.status === 'Approved'"
                  ></textarea></label
                ><label
                  >เลขแบบ<input
                    formControlName="drawingNumber"
                    [readonly]="r.status === 'Approved'" /></label
                ><label>Revision<input [value]="r.revision" readonly /></label>
              </div>
            }
            @if (tab() === 'Drawing') {
              <app-assets
                [ids]="drawingIds()"
                [readonly]="r.status === 'Approved'"
                (changed)="drawingIds.set($event)"
              />
            }
            @if (tab() === 'BOM') {
              <div class="table-wrap">
                <table formArrayName="bom">
                  <thead>
                    <tr>
                      <th>วัสดุ</th>
                      <th>ปริมาณ / หน่วยสินค้า</th>
                      <th>Scrap %</th>
                      <th>หมายเหตุ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (b of bom.controls; track b; let i = $index) {
                      <tr [formGroupName]="i">
                        <td>
                          <select formControlName="materialId">
                            @for (m of store.state().materials; track m.id) {
                              <option [value]="m.id">{{ m.code }} · {{ m.unit }}</option>
                            }
                          </select>
                        </td>
                        <td><input type="number" formControlName="quantity" /></td>
                        <td><input type="number" formControlName="scrapPercent" /></td>
                        <td><input formControlName="note" /></td>
                        <td>
                          @if (r.status !== 'Approved') {
                            <button type="button" (click)="bom.removeAt(i)" aria-label="ลบวัสดุ">
                              ×
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (r.status !== 'Approved') {
                <button type="button" (click)="addBom()">+ เพิ่ม BOM line</button>
              }
            }
            @if (tab() === 'COGS') {
              <div class="form-grid">
                <label>ค่าแรง / หน่วย<input type="number" formControlName="labor" /></label
                ><label>Overhead / หน่วย<input type="number" formControlName="overhead" /></label
                ><label>Waste / Scrap cost<input type="number" formControlName="waste" /></label
                ><label>ต้นทุนวัสดุ<input [value]="money(costs().material)" readonly /></label>
              </div>
              <div class="cost-row total">
                <span>Estimated COGS ต่อหน่วย</span><strong>{{ money(costs().cost) }} THB</strong>
              </div>
              <p class="muted">
                อ้างอิง Moving Average ปัจจุบัน · วันที่ {{ r.costDate || 'ยังไม่บันทึก' }}
              </p>
            }
            @if (tab() === 'Revision') {
              <div class="timeline">
                @for (p of history(); track p.id) {
                  <div>
                    <strong>{{ p.code }} / R{{ p.revision }} · {{ p.status }}</strong
                    ><small
                      >{{ p.drawingNumber }} · COGS {{ money(p.cost) }} · {{ p.costDate }}</small
                    >
                  </div>
                }
              </div>
            }
          </form>
        </section>
        @if (r.status !== 'Approved' && session.can('Designer')) {
          <div class="actions">
            <button (click)="save(false)" [disabled]="busy() || form.invalid">บันทึก Draft</button
            ><button class="primary" (click)="save(true)" [disabled]="busy() || form.invalid">
              อนุมัติ Revision และส่งกลับ Sales
            </button>
          </div>
        } @else {
          <div class="notice">
            Approved Revision อ่านอย่างเดียว · การแก้แบบจาก Sales จะสร้าง Revision ใหม่
          </div>
        }
      }
    } @else {
      <app-filter
        [count]="rows().length"
        [statuses]="['Open', 'Approved']"
        placeholder="ค้นหาเลขแบบ / สินค้า / Quotation"
        (change)="filter.set($event)"
      />
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Design Task / Quotation</th>
              <th>สินค้า / Revision</th>
              <th>ผู้รับผิดชอบ</th>
              <th>กำหนดส่ง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            @for (t of rows(); track t.id) {
              <tr>
                <td>
                  <button class="text-button row-link" (click)="open(t)">
                    DES-{{ t.id.slice(0, 8) }}</button
                  ><small>{{ quoteName(t.quoteId) }}</small>
                </td>
                <td>{{ revisionName(t.revisionId) }}</td>
                <td>{{ userName(t.assignedTo) }}</td>
                <td>{{ t.dueDate }}</td>
                <td><app-badge [value]="t.status" /></td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">
                  <div class="empty">
                    <h2>ไม่มีงานออกแบบในคิว</h2>
                    <p>รับความต้องการจากใบเสนอราคา หรือสร้างแบบสำหรับผลิตเก็บสต็อก</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class Design extends Feature {
  private fb = inject(FormBuilder);
  selectedId = signal('');
  selected = computed(() => this.store.state().designs.find((t) => t.id === this.selectedId()));
  rev = computed(() =>
    this.store.state().revisions.find((r) => r.id === this.selected()?.revisionId),
  );
  history = computed(() =>
    this.store.state().revisions.filter((r) => r.productId === this.rev()?.productId),
  );
  tabs = ['Spec', 'Drawing', 'BOM', 'COGS', 'Revision'];
  tab = signal('Spec');
  drawingIds = signal<string[]>([]);
  filter = signal({ query: '', status: '' });
  rows = computed(() =>
    this.store
      .state()
      .designs.filter(
        (t) =>
          (this.quoteName(t.quoteId) + ' ' + this.revisionName(t.revisionId))
            .toLowerCase()
            .includes(this.filter().query.toLowerCase()) &&
          (!this.filter().status || this.filter().status === t.status),
      ),
  );
  form = this.fb.nonNullable.group({
    spec: ['', Validators.required],
    drawingNumber: [''],
    labor: [0, Validators.min(0)],
    overhead: [0, Validators.min(0)],
    waste: [0, Validators.min(0)],
    bom: this.fb.array<ReturnType<Design['bomGroup']>>([]),
  });
  get bom() {
    return this.form.controls.bom;
  }
  bomGroup(b?: BomLine) {
    return this.fb.nonNullable.group({
      materialId: [b?.materialId ?? 'mat-steel', Validators.required],
      quantity: [b?.quantity ?? 1, Validators.min(0.001)],
      scrapPercent: [b?.scrapPercent ?? 0, [Validators.min(0), Validators.max(100)]],
      note: [b?.note ?? ''],
    });
  }
  addBom(b?: BomLine) {
    this.bom.push(this.bomGroup(b));
    this.form.markAsDirty();
  }
  quoteName(id: string) {
    return this.store.state().quotations.find((q) => q.id === id)?.number ?? 'ผลิตเก็บสต็อก';
  }
  revisionName(id: string) {
    const r = this.store.state().revisions.find((r) => r.id === id);
    return r ? r.code + ' · ' + r.name + ' / R' + r.revision : id;
  }
  open(t: DesignTask) {
    this.selectedId.set(t.id);
    this.tab.set('Spec');
    const r = this.rev()!;
    this.form.enable();
    this.bom.clear();
    r.bom.forEach((b) => this.addBom(b));
    this.form.patchValue({
      spec: r.spec,
      drawingNumber: r.drawingNumber,
      labor: r.labor,
      overhead: r.overhead,
      waste: r.waste,
    });
    this.drawingIds.set([...r.drawings]);
    this.form.markAsPristine();
    if (r.status === 'Approved') this.form.disable();
    this.error.set('');
  }
  back() {
    if (this.confirmClose(this.form.dirty)) this.selectedId.set('');
  }
  costs() {
    try {
      const p = this.form.getRawValue();
      return calculateCogs(this.store.state(), p.bom, p.labor, p.overhead, p.waste);
    } catch {
      return { material: 0, cost: 0 };
    }
  }
  async save(approve: boolean) {
    const ok = await this.run('design.save', {
      id: this.selectedId(),
      ...this.form.getRawValue(),
      drawings: this.drawingIds(),
      approve,
    });
    if (ok) {
      this.form.markAsPristine();
      if (approve) this.form.disable();
    }
  }
  async newProduct() {
    const name = prompt('ชื่อสินค้าที่ต้องการออกแบบ');
    if (name) {
      const id = await this.run<string>('design.new', { name });
      if (id) this.open(this.store.state().designs.find((t) => t.id === id)!);
    }
  }
}
