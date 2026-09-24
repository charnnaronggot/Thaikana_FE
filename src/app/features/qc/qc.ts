import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Badge, Feature, StateMessage } from '../../shared/ui';
import { Assets } from '../../shared/assets';
import { STAGES, STAGE_LABELS, Stage, WorkOrder } from '../../domain/models';
import { uid } from '../../domain/models';
@Component({
  imports: [ReactiveFormsModule, Badge, StateMessage, Assets],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">QUALITY CONTROL</p>
        <h1>ตรวจคุณภาพและรับ Finished Goods</h1>
        <p class="muted">ตรวจหลายชิ้น · รูป 4 ด้าน · Rework · รับ FG เฉพาะส่วนผ่าน</p>
      </div>
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    @if (selected(); as w) {
      <section class="card">
        <div class="section-heading">
          <h2>{{ w.number }} · {{ w.snapshot.name }}</h2>
          <button (click)="selectedId.set('')">กลับรายการ</button>
        </div>
        <dl class="key-value">
          <div>
            <dt>แบบสินค้า</dt>
            <dd>{{ w.snapshot.code }} / R{{ w.snapshot.revision }}</dd>
          </div>
          <div>
            <dt>จำนวนรอตรวจ</dt>
            <dd>{{ w.qcPending }} ชิ้น</dd>
          </div>
        </dl>
      </section>
      <form [formGroup]="form">
        <section class="card">
          <h2>ผลตรวจ</h2>
          <div class="form-grid three">
            <label>จำนวนตรวจ<input type="number" formControlName="quantity" /></label
            ><label>ผ่าน<input type="number" formControlName="passed" /></label
            ><label>ไม่ผ่าน<input type="number" formControlName="failed" /></label
            ><label>ค้างตรวจ<input type="number" formControlName="pending" /></label
            ><label
              >สถานีส่งกลับ<select formControlName="destination">
                @for (s of stages; track s) {
                  <option [value]="s">{{ labels[s] }}</option>
                }
              </select></label
            ><label>เหตุผลไม่ผ่าน / Rework<textarea formControlName="reason"></textarea></label>
          </div>
        </section>
        <section class="card">
          <h2>Checklist</h2>
          <div class="two-columns">
            <label class="check-label"
              ><input type="checkbox" formControlName="check1" />ขนาดตรงแบบ</label
            ><label class="check-label"
              ><input type="checkbox" formControlName="check2" />ผิวและสีตรงสเปก</label
            ><label class="check-label"
              ><input type="checkbox" formControlName="check3" />งานประกอบสมบูรณ์</label
            >
          </div>
        </section>
        <section class="card">
          <h2>ภาพ QC 4 ด้าน</h2>
          <div class="photo-grid">
            @for (side of sides; track side; let i = $index) {
              <div class="photo-cell">
                <strong>{{ side }}</strong
                ><input
                  type="file"
                  accept="image/*"
                  [disabled]="uploading()"
                  (change)="upload($event, i)"
                /><small>{{ photoName(i) }}</small>
              </div>
            }
          </div>
          <app-assets [ids]="photoIds()" [readonly]="true" />
        </section>
      </form>
      <div class="actions">
        <button
          class="primary"
          (click)="inspect()"
          [disabled]="busy() || uploading() || form.invalid || !session.can('QC')"
        >
          บันทึกผลตรวจ
        </button>
      </div>
    } @else {
      <div class="metrics">
        <div class="metric">
          <span>งานรอ QC</span><strong>{{ pending().length }}</strong>
        </div>
        <div class="metric">
          <span>ตรวจแล้ว</span><strong>{{ store.state().inspections.length }}</strong>
        </div>
        <div class="metric">
          <span>FG พร้อมจัดสรร</span><strong>{{ availableFg() }}</strong>
        </div>
        <div class="metric">
          <span>งาน Rework</span><strong>{{ rework().length }}</strong>
        </div>
      </div>
      <h2>คิวตรวจ</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>WO / สินค้า</th>
              <th>Revision / แบบ</th>
              <th class="numeric">รอตรวจ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (w of pending(); track w.id) {
              <tr>
                <td>
                  <strong>{{ w.number }}</strong
                  ><small>{{ w.snapshot.name }}</small>
                </td>
                <td>
                  {{ w.snapshot.code }} / R{{ w.snapshot.revision
                  }}<small>{{ w.snapshot.drawingNumber }}</small>
                </td>
                <td class="numeric">{{ w.qcPending }}</td>
                <td>
                  <button class="primary" (click)="open(w)" [disabled]="!session.can('QC')">
                    ตรวจคุณภาพ
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">ยังไม่มีงานรอตรวจ QC</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <section class="card" style="margin-top:20px">
        <h2>ประวัติผลตรวจและ Rework</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>WO / เวลา</th>
                <th class="numeric">ผ่าน</th>
                <th class="numeric">ไม่ผ่าน</th>
                <th class="numeric">ค้าง</th>
                <th>สถานีปลายทาง</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (i of store.state().inspections; track i.id) {
                <tr>
                  <td>
                    {{ woName(i.woId) }}<small>{{ date(i.at) }} · {{ i.reason }}</small>
                  </td>
                  <td class="numeric">{{ i.passed }}</td>
                  <td class="numeric">{{ i.failed }}</td>
                  <td class="numeric">{{ i.pending }}</td>
                  <td>{{ labels[i.destination] }}</td>
                  <td>
                    @if (i.passed && !i.received) {
                      <button
                        class="primary"
                        (click)="receive(i.id)"
                        [disabled]="!session.can('QC', 'Store')"
                      >
                        รับ FG {{ i.passed }}
                      </button>
                    }
                    @if (i.received) {
                      <app-badge value="รับ FG แล้ว" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      <section class="card">
        <h2>Finished Goods</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lot / Product Revision</th>
                <th>ที่เก็บ</th>
                <th class="numeric">จำนวน</th>
                <th class="numeric">Reserved</th>
                <th class="numeric">Available</th>
              </tr>
            </thead>
            <tbody>
              @for (f of store.state().fg; track f.id) {
                <tr>
                  <td>
                    <strong>{{ f.code }}</strong
                    ><small>{{ f.revisionId }}</small>
                  </td>
                  <td>{{ f.location }}</td>
                  <td class="numeric">{{ f.quantity }}</td>
                  <td class="numeric">{{ f.reserved }}</td>
                  <td class="numeric">{{ f.quantity - f.reserved }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
})
export class Qc extends Feature {
  private fb = inject(FormBuilder);
  stages = STAGES;
  labels = STAGE_LABELS;
  sides = ['ด้านหน้า', 'ด้านหลัง', 'ด้านซ้าย', 'ด้านขวา'];
  selectedId = signal('');
  selected = computed(() => this.store.state().workOrders.find((w) => w.id === this.selectedId()));
  pending = computed(() =>
    this.store.state().workOrders.filter((w) => w.status === 'QC' && w.qcPending > 0),
  );
  rework = computed(() => this.store.state().workOrders.filter((w) => w.number.startsWith('RW-')));
  availableFg = computed(() =>
    this.store.state().fg.reduce((n, f) => n + f.quantity - f.reserved, 0),
  );
  photoIds = signal<string[]>([]);
  uploading = signal(false);
  form = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
    passed: [1, Validators.min(0)],
    failed: [0, Validators.min(0)],
    pending: [0, Validators.min(0)],
    destination: ['laser' as Stage],
    reason: [''],
    check1: [false],
    check2: [false],
    check3: [false],
  });
  open(w: WorkOrder) {
    this.selectedId.set(w.id);
    this.photoIds.set([]);
    this.form.reset({
      quantity: w.qcPending,
      passed: w.qcPending,
      failed: 0,
      pending: 0,
      destination: 'laser',
      reason: '',
      check1: false,
      check2: false,
      check3: false,
    });
    this.error.set('');
  }
  photoName(i: number) {
    const a = this.store.state().assets.find((a) => a.id === this.photoIds()[i]);
    return a?.name ?? 'ยังไม่อัปโหลด';
  }
  async upload(e: Event, i: number) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    try {
      if (!file.type.startsWith('image/')) throw Error('ต้องเป็นไฟล์รูปภาพ');
      const id = await this.run<string>('asset.add', {
        id: uid(),
        name: file.name,
        mime: file.type,
        blob: file,
      });
      if (id)
        this.photoIds.update((ids) => {
          const next = [...ids];
          next[i] = id;
          return next;
        });
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.uploading.set(false);
      (e.target as HTMLInputElement).value = '';
    }
  }
  async inspect() {
    const w = this.selected();
    if (!w) return;
    const p = this.form.getRawValue();
    const ok = await this.run('qc.inspect', {
      woId: w.id,
      quantity: p.quantity,
      passed: p.passed,
      failed: p.failed,
      pending: p.pending,
      checklist: [p.check1, p.check2, p.check3],
      photos: this.photoIds(),
      reason: p.reason,
      destination: p.destination,
    });
    if (ok) this.selectedId.set('');
  }
  woName(id: string) {
    return this.store.state().workOrders.find((w) => w.id === id)?.number ?? id;
  }
  async receive(id: string) {
    const lot = prompt('Lot FG', 'LOT-FG-2609');
    if (!lot) return;
    const location = prompt('ที่เก็บ FG', 'FG-A01');
    if (location) await this.run('fg.receive', { inspectionId: id, lot, location });
  }
}
