import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Badge, Feature, Overlay, StateMessage } from '../../shared/ui';
import { ListFilter } from '../../shared/list-filter';
import { materialDemand } from '../../domain/planning';
import { Material, MovementType, WorkOrder } from '../../domain/models';
@Component({
  imports: [ReactiveFormsModule, Badge, Overlay, StateMessage, ListFilter],
  template: `
    <div class="page-heading">
      <div>
        <p class="eyebrow">INVENTORY & MATERIALS</p>
        <h1>คลังสินค้า</h1>
        <p class="muted">รับเข้า · จอง · เบิก · คืน · Scrap · Movement Ledger</p>
      </div>
      @if (session.can('Store')) {
        <button class="primary" (click)="openMaterial()">+ สร้างวัสดุ</button>
      }
    </div>
    <app-state [message]="error()" (retry)="store.refresh()" />
    <div class="tabs">
      <button [class.active]="tab() === 'materials'" (click)="tab.set('materials')">
        วัสดุในคลัง</button
      ><button [class.active]="tab() === 'receive'" (click)="tab.set('receive')">รับสินค้า</button
      ><button [class.active]="tab() === 'demand'" (click)="tab.set('demand')">
        Material Demand / WO</button
      ><button [class.active]="tab() === 'ledger'" (click)="tab.set('ledger')">
        Movement Ledger
      </button>
    </div>
    @if (tab() === 'materials') {
      <app-filter
        [count]="materials().length"
        placeholder="ค้นหารหัส / ชื่อ / Barcode"
        (change)="query.set($event.query)"
      />
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>รหัส / รายการ</th>
              <th>Lot / ที่เก็บ</th>
              <th>Barcode</th>
              <th class="numeric">On hand</th>
              <th class="numeric">Reserved</th>
              <th class="numeric">Available</th>
              <th class="numeric">Moving avg.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (m of materials(); track m.id) {
              <tr>
                <td>
                  <strong>{{ m.code }}</strong
                  ><small>{{ m.name }} · {{ m.spec }}</small>
                </td>
                <td>
                  {{ m.lot }}<small>{{ m.location }}</small>
                </td>
                <td>{{ m.barcode || '—' }}</td>
                <td class="numeric">{{ m.onHand }} {{ m.unit }}</td>
                <td class="numeric">{{ m.reserved }}</td>
                <td class="numeric" [class.danger-text]="m.onHand - m.reserved < m.reorder">
                  {{ m.onHand - m.reserved }}
                </td>
                <td class="numeric">{{ money(m.averageCost) }}</td>
                <td>
                  @if (session.can('Store')) {
                    <button (click)="openMaterial(m)">แก้ไข</button
                    ><button (click)="barcode(m)">ผูก Barcode</button
                    ><button (click)="adjust(m)">ปรับยอด</button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    @if (tab() === 'receive') {
      <section class="card">
        <h2>รับวัสดุเข้าคลัง</h2>
        <label
          >สแกน Barcode<input
            [value]="scan()"
            (input)="scan.set($any($event.target).value)"
            (keyup.enter)="lookup()"
            placeholder="สแกนหรือกรอก Barcode แล้ว Enter"
        /></label>
        <div class="actions">
          <button (click)="lookup()">ค้นหา Barcode</button>
          @if (unknown()) {
            <button (click)="linkUnknown()">ผูก Barcode ที่ไม่รู้จัก</button>
          }
        </div>
        <form [formGroup]="receiveForm" class="form-grid three" style="margin-top:20px">
          <label
            >วัสดุ<select formControlName="materialId">
              @for (m of store.state().materials; track m.id) {
                <option [value]="m.id">{{ m.code }} · {{ m.name }}</option>
              }
            </select></label
          ><label>จำนวน<input type="number" formControlName="quantity" /></label
          ><label>ต้นทุน / หน่วย<input type="number" formControlName="unitCost" /></label
          ><label>Lot<input formControlName="lot" /></label
          ><label>ที่เก็บ<input formControlName="location" /></label
          ><label>เอกสารอ้างอิง<input formControlName="reference" /></label>
        </form>
        <app-state [message]="error()" /><button
          class="primary"
          (click)="receive()"
          [disabled]="busy() || receiveForm.invalid || !session.can('Store')"
        >
          ตรวจและ Post รับเข้า
        </button>
      </section>
    }
    @if (tab() === 'demand') {
      <section class="card">
        <div class="section-heading">
          <h2>เบิกวัสดุตาม Work Order</h2>
          <label
            >เลือก WO<select [value]="woId()" (change)="woId.set($any($event.target).value)">
              @for (w of store.state().workOrders; track w.id) {
                @if (w.status !== 'Cancelled') {
                  <option [value]="w.id">{{ w.number }} · {{ w.snapshot.name }}</option>
                }
              }
            </select></label
          >
        </div>
        @if (wo(); as w) {
          <p class="muted">
            {{ w.snapshot.code }} / R{{ w.snapshot.revision }} · {{ w.quantity }} ชิ้น ·
            {{ w.status }}
          </p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>วัสดุ / BOM</th>
                  <th class="numeric">ต้องใช้</th>
                  <th class="numeric">จองคงเหลือ</th>
                  <th class="numeric">เบิกแล้ว</th>
                  <th class="numeric">Available</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of demand(); track row.material.id) {
                  <tr>
                    <td>
                      <strong>{{ row.material.code }}</strong
                      ><small>{{ row.material.name }}</small>
                    </td>
                    <td class="numeric">{{ row.need }}</td>
                    <td class="numeric">{{ w.reserved[row.material.id] || 0 }}</td>
                    <td class="numeric">{{ w.issued[row.material.id] || 0 }}</td>
                    <td class="numeric">{{ row.material.onHand - row.material.reserved }}</td>
                    <td>
                      @if (session.can('Store')) {
                        <button (click)="move('Reserve', row.material)">จอง</button
                        ><button (click)="move('Issue', row.material)">เบิก</button
                        ><button (click)="move('Unreserve', row.material)">ยกเลิกจอง</button
                        ><button (click)="move('Return', row.material)">คืน</button
                        ><button (click)="move('Scrap', row.material)">Scrap</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="actions" style="margin-top:16px">
            @if (session.can('Store')) {
              <button (click)="move('Extra', store.state().materials[0])">เบิกนอก BOM</button>
            }
          </div>
        }
      </section>
    }
    @if (tab() === 'ledger') {
      <app-filter
        [count]="ledger().length"
        [statuses]="movementTypes"
        (change)="filter.set($event)"
      />
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>วัสดุ</th>
              <th>รายการ</th>
              <th class="numeric">จำนวน</th>
              <th class="numeric">On hand</th>
              <th class="numeric">Reserved</th>
              <th>อ้างอิง / ผู้ทำ</th>
            </tr>
          </thead>
          <tbody>
            @for (x of ledger(); track x.id) {
              <tr>
                <td>{{ date(x.at) }}</td>
                <td>{{ code(x.materialId) }}</td>
                <td><app-badge [value]="x.type" /></td>
                <td class="numeric">{{ x.quantity }}</td>
                <td class="numeric">{{ x.onHand }}</td>
                <td class="numeric">{{ x.reserved }}</td>
                <td>
                  {{ x.reference }}<small>{{ userName(x.actorId) }} · {{ x.reason }}</small>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">ยังไม่มี Movement</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
    @if (materialOpen()) {
      <app-overlay title="วัสดุและข้อมูลคลัง" (close)="materialOpen.set(false)"
        ><form [formGroup]="materialForm" class="form-grid">
          <label>รหัสวัสดุ<input formControlName="code" /></label
          ><label>ชื่อวัสดุ<input formControlName="name" /></label
          ><label class="wide">สเปก<input formControlName="spec" /></label
          ><label>หน่วย<input formControlName="unit" /></label
          ><label>ที่เก็บ<input formControlName="location" /></label
          ><label>จุดเตือนต่ำ<input type="number" formControlName="reorder" /></label>
        </form>
        <app-state [message]="error()" /><button footer (click)="materialOpen.set(false)">
          ยกเลิก</button
        ><button
          footer
          class="primary"
          (click)="saveMaterial()"
          [disabled]="materialForm.invalid || busy()"
        >
          บันทึก
        </button></app-overlay
      >
    }
    @if (moveOpen()) {
      <app-overlay [title]="'วัสดุ · ' + moveType()" (close)="moveOpen.set(false)"
        ><p>{{ moveMaterial()?.code }} · {{ wo()?.number || 'คลัง' }}</p>
        <form [formGroup]="moveForm" class="form-grid">
          <label>จำนวน<input type="number" formControlName="quantity" /></label
          ><label class="wide">เหตุผล<input formControlName="reason" /></label>
        </form>
        <app-state [message]="error()" /><button footer (click)="moveOpen.set(false)">ยกเลิก</button
        ><button
          footer
          class="primary"
          (click)="saveMove()"
          [disabled]="moveForm.invalid || busy()"
        >
          ยืนยันรายการ
        </button></app-overlay
      >
    }
  `,
})
export class Inventory extends Feature {
  private fb = inject(FormBuilder);
  tab = signal('materials');
  query = signal('');
  filter = signal({ query: '', status: '' });
  materials = computed(() =>
    this.store
      .state()
      .materials.filter((m) =>
        (m.code + ' ' + m.name + ' ' + m.barcode)
          .toLowerCase()
          .includes(this.query().toLowerCase()),
      ),
  );
  movementTypes: MovementType[] = [
    'Receive',
    'Reserve',
    'Issue',
    'Return',
    'Adjust',
    'Scrap',
    'Unreserve',
  ];
  ledger = computed(() =>
    this.store
      .state()
      .movements.filter(
        (m) =>
          (this.code(m.materialId) + ' ' + m.reference)
            .toLowerCase()
            .includes(this.filter().query.toLowerCase()) &&
          (!this.filter().status || m.type === this.filter().status),
      ),
  );
  woId = signal('wo-demo-1');
  wo = computed(() => this.store.state().workOrders.find((w) => w.id === this.woId()));
  demand() {
    const w = this.wo();
    return w
      ? Object.entries(materialDemand(w.snapshot, w.quantity))
          .map(([id, need]) => ({
            material: this.store.state().materials.find((m) => m.id === id)!,
            need,
          }))
          .filter((x) => x.material)
      : [];
  }
  code(id: string) {
    return this.store.state().materials.find((m) => m.id === id)?.code ?? id;
  }
  materialOpen = signal(false);
  materialId = '';
  materialForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    spec: [''],
    unit: ['แผ่น', Validators.required],
    location: ['A-01'],
    reorder: [0, Validators.min(0)],
  });
  openMaterial(m?: Material) {
    this.materialId = m?.id ?? '';
    this.materialForm.reset({
      code: m?.code ?? '',
      name: m?.name ?? '',
      spec: m?.spec ?? '',
      unit: m?.unit ?? 'แผ่น',
      location: m?.location ?? 'A-01',
      reorder: m?.reorder ?? 0,
    });
    this.materialOpen.set(true);
  }
  async saveMaterial() {
    const ok = await this.run('inv.material', {
      id: this.materialId || undefined,
      ...this.materialForm.getRawValue(),
    });
    if (ok) this.materialOpen.set(false);
  }
  scan = signal('');
  unknown = signal(false);
  receiveForm = this.fb.nonNullable.group({
    materialId: ['mat-steel', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.001)]],
    unitCost: [10000, Validators.min(0)],
    lot: ['LOT-2609', Validators.required],
    location: ['A-01', Validators.required],
    reference: ['', Validators.required],
  });
  lookup() {
    const m = this.store.state().materials.find((m) => m.barcode === this.scan());
    if (m) {
      this.receiveForm.patchValue({ materialId: m.id, lot: m.lot, location: m.location });
      this.unknown.set(false);
      this.error.set('');
    } else {
      this.unknown.set(true);
      this.error.set('ไม่รู้จัก Barcode นี้ กรุณาผูกกับวัสดุ/ล็อตก่อนรับเข้า');
    }
  }
  async linkUnknown() {
    const m = this.store
      .state()
      .materials.find((m) => m.id === this.receiveForm.controls.materialId.value);
    if (m && this.scan()) {
      const ok = await this.run('inv.barcode', {
        materialId: m.id,
        barcode: this.scan(),
        lot: this.receiveForm.controls.lot.value,
      });
      if (ok) this.unknown.set(false);
    }
  }
  async receive() {
    const ok = await this.run('inv.receive', {
      ...this.receiveForm.getRawValue(),
      barcode: this.scan(),
    });
    if (ok) {
      this.tab.set('ledger');
      this.scan.set('');
    }
  }
  moveOpen = signal(false);
  moveType = signal('');
  moveMaterial = signal<Material | null>(null);
  moveForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(0.001)]],
    reason: [''],
  });
  move(type: string, m: Material) {
    this.moveType.set(type);
    this.moveMaterial.set(m);
    const w = this.wo();
    const need = w ? (materialDemand(w.snapshot, w.quantity)[m.id] ?? 0) : 0;
    const q =
      type === 'Reserve'
        ? Math.max(1, need - (w?.reserved[m.id] ?? 0) - (w?.issued[m.id] ?? 0))
        : type === 'Issue'
          ? Math.max(1, w?.reserved[m.id] ?? 0)
          : 1;
    this.moveForm.reset({ quantity: q, reason: '' });
    this.moveOpen.set(true);
  }
  async saveMove() {
    const type = this.moveType(),
      m = this.moveMaterial();
    if (!m) return;
    const p = { woId: this.woId(), materialId: m.id, ...this.moveForm.getRawValue() };
    const cmd: Record<string, string> = {
      Reserve: 'inv.reserve',
      Issue: 'inv.issue',
      Unreserve: 'inv.unreserve',
      Return: 'inv.return',
      Scrap: 'inv.scrap',
      Extra: 'inv.issue',
    };
    const ok = await this.run(cmd[type], { ...p, extra: type === 'Extra' });
    if (ok) this.moveOpen.set(false);
  }
  async adjust(m: Material) {
    const entered = prompt('ยอด On hand ใหม่', String(m.onHand));
    if (entered === null) return;
    const reason = prompt('เหตุผลปรับยอด');
    if (reason)
      await this.run('inv.adjust', { materialId: m.id, newQuantity: Number(entered), reason });
  }
  async barcode(m: Material) {
    const code = prompt('Barcode', m.barcode);
    if (code === null) return;
    const lot = prompt('Lot', m.lot);
    if (lot !== null) await this.run('inv.barcode', { materialId: m.id, barcode: code, lot });
  }
}
