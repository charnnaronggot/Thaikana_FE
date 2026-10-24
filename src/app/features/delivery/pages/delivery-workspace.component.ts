import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import type { components } from '../../../core/services/api/generated/native-schema';
import { BarcodeLabel } from '../../../shared/components/barcode-label.component';
import { Drawer, StateMessage } from '../../../shared/components/ui';
import {
  DeliveryApi,
  DeliveryDetail,
  DeliveryOptions,
  DeliveryWorkspace,
  Package,
  deliveryError,
  normalizeEvidence,
} from '../services/delivery-api.service';
import { DeliveryCommands, DeliveryPending } from '../services/delivery-commands.service';

type Mode =
  | 'create'
  | 'pick'
  | 'pack'
  | 'scan'
  | 'dispatch'
  | 'pod'
  | 'cancel'
  | 'unpick'
  | 'cancel-package'
  | 'gps';
type Amount = { id: string; selected: boolean; quantity: number };
type PodAmount = { id: string; good: number; failed: number };
type Proof = DeliveryDetail['proofs'][number];
@Component({
  imports: [CommonModule, FormsModule, RouterLink, Drawer, StateMessage, BarcodeLabel],
  templateUrl: './delivery-workspace.component.html',
  styleUrl: './delivery-workspace.component.scss',
})
export class DeliveryWorkspacePage {
  readonly auth = inject(AuthService);
  readonly command = inject(DeliveryCommands);
  private api = inject(DeliveryApi);
  private route = inject(ActivatedRoute);
  private owner = {};
  queue = signal<DeliveryWorkspace | null>(null);
  detail = signal<DeliveryDetail | null>(null);
  options = signal<DeliveryOptions | null>(null);
  loading = signal(false);
  error = signal('');
  notice = signal('');
  formError = signal('');
  fields = signal<Record<string, string>>({});
  mode = signal<Mode | null>(null);
  pkg = signal<Package | null>(null);
  proof = signal<Proof | null>(null);
  label = signal<Package | null>(null);
  discard = signal(false);
  source = signal(false);
  files = signal<File[]>([]);
  locating = signal(false);
  search = '';
  status = '';
  page = 1;
  model = this.empty();
  private baseline = '';
  private generation = 0;
  private geoGeneration = 0;
  readonly statuses = [
    { value: '', label: 'ทุกสถานะ' },
    { value: 'DRAFT', label: 'รอหยิบ' },
    { value: 'PICKING', label: 'หยิบ / จัดกล่อง' },
    { value: 'DISPATCHED', label: 'ส่งออกแล้ว' },
    { value: 'PARTIALLY_DELIVERED', label: 'ถึงบางส่วน' },
    { value: 'DELIVERED', label: 'ถึงครบ' },
    { value: 'CANCELLED', label: 'ยกเลิก' },
    { value: 'GPS_PENDING', label: 'รอตรวจ GPS' },
  ];
  readonly titles: Record<Mode, string> = {
    create: 'สร้างรอบจัดส่ง',
    pick: 'หยิบสินค้า',
    pack: 'จัดกล่อง',
    scan: 'ตรวจบาร์โค้ดกล่อง',
    dispatch: 'ยืนยันส่งออก',
    pod: 'บันทึกรับมอบ',
    cancel: 'ยกเลิกรอบส่ง',
    unpick: 'ยกเลิกการหยิบ',
    'cancel-package': 'ยกเลิกกล่อง',
    gps: 'ตรวจหลักฐาน GPS',
  };
  empty() {
    const now = new Date();
    return {
      orderId: '',
      date: [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-'),
      driverId: '',
      carrier: 'รถบริษัท',
      lines: [] as Amount[],
      choice: '',
      quantity: 1,
      packs: [] as Amount[],
      barcode: '',
      stage: 'PICK',
      receiver: '',
      latitude: null as number | null,
      longitude: null as number | null,
      accuracy: null as number | null,
      gpsReason: '',
      note: '',
      pods: [] as PodAmount[],
      reason: '',
      approved: true,
      pickId: '',
    };
  }
  num(v: unknown) {
    return Number(v ?? 0);
  }
  statusText(value: string) {
    return this.statuses.find((x) => x.value === value)?.label ?? value;
  }
  packageStatus(value: string) {
    return (
      (
        {
          PACKED: 'รอสแกน',
          VERIFIED: 'พร้อมส่ง',
          DISPATCHED: 'ส่งออกแล้ว',
          CANCELLED: 'ยกเลิก',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  blocker(code: string) {
    return (
      (
        {
          package_required: 'ยังไม่ได้จัดกล่อง',
          package_scan_required: 'รอสแกนตรวจหยิบ / จัดกล่อง',
          package_quantity_mismatch: 'ยอดในกล่องยังไม่ตรงกับยอดหยิบ',
          incomplete_pick: 'ยังหยิบไม่ครบตามรอบส่ง',
        } as Record<string, string>
      )[code] ?? code
    );
  }
  blocked() {
    return (
      this.loading() || this.command.busy() || !!this.command.pending() || this.command.uncertain()
    );
  }
  dirty() {
    return JSON.stringify(this.model) !== this.baseline || this.files().length > 0;
  }
  canLeave() {
    if (!this.auth.user() || this.command.pending()) return true;
    return (
      !this.command.busy() &&
      (!this.mode() ||
        !this.dirty() ||
        window.confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?'))
    );
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (!this.command.pending() && this.mode() && this.dirty()) event.preventDefault();
  }
  async ngOnInit() {
    this.command.attach(this.owner, (result, pending) => this.completed(result, pending));
    const recovering = !!this.command.pending();
    await this.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (id && !recovering && !this.detail()) await this.open(id);
  }
  ngOnDestroy() {
    this.command.detach(this.owner);
    this.geoGeneration++;
  }
  async load(reset = false) {
    if (this.mode()) return;
    if (reset) this.page = 1;
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    try {
      const data = await this.api.workspace(this.search, this.status, this.page);
      if (generation === this.generation) this.queue.set(data);
    } catch (e) {
      if (generation === this.generation) this.error.set(deliveryError(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
  async open(id: string) {
    if (this.mode()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.detail.set(await this.api.detail(id));
    } catch (e) {
      this.error.set(deliveryError(e));
    } finally {
      this.loading.set(false);
    }
  }
  back() {
    if (this.mode()) return;
    this.detail.set(null);
    this.notice.set('');
    void this.load();
  }
  reset() {
    this.search = '';
    this.status = '';
    void this.load(true);
  }
  isOpen() {
    return ['DRAFT', 'PICKING'].includes(this.detail()?.status ?? '');
  }
  order() {
    return this.options()?.orders.find((x) => x.id === this.model.orderId);
  }
  choiceKey(choice: DeliveryDetail['availablePicks'][number]) {
    return choice.deliveryItemId + ':' + choice.reservationId;
  }
  choice() {
    return this.detail()?.availablePicks.find((x) => this.choiceKey(x) === this.model.choice);
  }
  pickLimit() {
    const c = this.choice(),
      line = this.detail()?.items.find((x) => x.id === c?.deliveryItemId);
    return Math.max(
      0,
      Math.min(this.num(c?.available), this.num(line?.planned) - this.num(line?.picked)),
    );
  }
  choosePick() {
    this.model.quantity = this.pickLimit();
  }
  chooseOrder() {
    this.model.lines = (this.order()?.lines ?? [])
      .filter((x) => this.num(x.available) > 0)
      .map((x) => ({ id: x.id, selected: true, quantity: this.num(x.available) }));
  }
  orderLine(id: string) {
    return this.order()?.lines.find((x) => x.id === id);
  }
  pick(id: string) {
    return this.detail()?.picks.find((x) => x.id === id);
  }
  unpacked(id: string) {
    const p = this.pick(id);
    return Math.max(0, this.num(p?.quantity) - this.num(p?.packed));
  }
  hasUnpacked() {
    return (
      this.detail()?.picks.some((p) => p.status === 'PICKED' && this.unpacked(p.id) > 0) ?? false
    );
  }
  podRemaining(id: string) {
    const p = this.pick(id);
    return p?.status === 'DISPATCHED'
      ? Math.max(0, this.num(p.quantity) - this.num(p.delivered) - this.num(p.pendingPod))
      : 0;
  }
  total(key: 'planned' | 'picked' | 'dispatched' | 'delivered' | 'pendingPod') {
    return this.detail()?.items.reduce((n, x) => n + this.num(x[key]), 0) ?? 0;
  }
  cancelAllowed() {
    return this.isOpen() && !this.detail()?.picks.some((x) => x.status === 'DISPATCHED');
  }
  next() {
    const d = this.detail();
    if (!d) return '';
    if (d.status === 'DELIVERED') return 'ส่งถึงครบแล้ว · ตรวจหลักฐานและประวัติรับมอบย้อนหลังได้';
    if (d.status === 'CANCELLED') return 'ยกเลิกรอบส่งแล้ว · จัดรอบใหม่จากยอดค้างของ SO ได้';
    if (['DISPATCHED', 'PARTIALLY_DELIVERED'].includes(d.status))
      return this.total('pendingPod') > 0 && !d.canPod
        ? 'รอผู้มีสิทธิ์ตรวจหลักฐาน GPS · ยอดนี้ยังไม่ถือว่าถึงครบ'
        : 'ผู้ส่ง ' + (d.driver ?? 'ที่ได้รับมอบหมาย') + ' บันทึกรับมอบจริงพร้อมหลักฐาน';
    if (d.canDispatch) return 'คลังยืนยันส่งออกได้ · ระบบตัด FG ตอนส่งออกครั้งเดียว';
    if (d.picks.some((x) => x.status === 'PICKED' && this.num(x.packed) < this.num(x.quantity)))
      return 'จัดกล่องจากสินค้าที่หยิบแล้ว จากนั้นสแกนตรวจหยิบ / จัดกล่อง';
    return d.blockers.includes('incomplete_pick')
      ? 'คลังหยิบ FG ที่จองไว้ตาม Revision / ล็อต หากยังไม่มีให้ Planner ตรวจการจอง'
      : 'สแกนตรวจหยิบและยืนยันจัดกล่องให้ครบก่อนส่งออก';
  }
  address(raw: string) {
    try {
      const data = JSON.parse(raw);
      if (typeof data === 'string') return data;
      const value = data.shipTo ?? data;
      return (
        Object.entries(value)
          .filter(([, v]) => typeof v === 'string' && v)
          .map(([, v]) => v)
          .join('\n') || 'ไม่ได้ระบุที่อยู่ในเอกสารต้นทาง'
      );
    } catch {
      return raw;
    }
  }
  async begin(mode: Mode, pkg?: Package, proof?: Proof, pickId?: string) {
    if (this.blocked() || this.mode()) return;
    this.command.clearError();
    this.formError.set('');
    this.fields.set({});
    this.model = this.empty();
    this.files.set([]);
    this.pkg.set(pkg ?? null);
    this.proof.set(proof ?? null);
    this.loading.set(true);
    try {
      if (mode === 'create') {
        this.options.set(await this.api.options());
        const drivers = this.options()?.drivers ?? [];
        this.model.driverId =
          drivers.find((x) => x.id === this.auth.user()?.id)?.id ?? drivers[0]?.id ?? '';
      } else {
        const d = this.detail();
        if (!d) return;
        if (mode === 'pick') {
          this.model.choice = d.availablePicks[0] ? this.choiceKey(d.availablePicks[0]) : '';
          this.choosePick();
        }
        if (mode === 'pack')
          this.model.packs = d.picks
            .filter((x) => x.status === 'PICKED' && this.unpacked(x.id) > 0)
            .map((x) => ({ id: x.id, selected: true, quantity: this.unpacked(x.id) }));
        if (mode === 'scan')
          this.model.stage = pkg?.scans.some((x) => x.stage === 'PICK') ? 'PACK' : 'PICK';
        if (mode === 'pod')
          this.model.pods = d.picks
            .filter((x) => this.podRemaining(x.id) > 0)
            .map((x) => ({ id: x.id, good: this.podRemaining(x.id), failed: 0 }));
        if (mode === 'unpick') this.model.pickId = pickId ?? '';
      }
      this.mode.set(mode);
      this.baseline = JSON.stringify(this.model);
    } catch (e) {
      this.error.set(deliveryError(e));
    } finally {
      this.loading.set(false);
    }
  }
  chooseFiles(event: Event) {
    this.files.set(
      Array.from((event.target as HTMLInputElement).files ?? []).map(normalizeEvidence),
    );
    this.fields.update((x) => ({ ...x, files: '' }));
  }
  async recoverFiles(event: Event) {
    await this.command.reselect(Array.from((event.target as HTMLInputElement).files ?? []));
  }
  locate() {
    if (this.locating() || this.command.pending() || this.command.busy()) return;
    this.locating.set(true);
    const generation = ++this.geoGeneration;
    this.formError.set('');
    if (!navigator.geolocation) {
      this.model.gpsReason = 'อุปกรณ์ไม่รองรับตำแหน่ง';
      this.locating.set(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (generation !== this.geoGeneration) return;
        this.model.latitude = position.coords.latitude;
        this.model.longitude = position.coords.longitude;
        this.model.accuracy = position.coords.accuracy;
        this.locating.set(false);
      },
      (error) => {
        if (generation !== this.geoGeneration) return;
        this.model.gpsReason =
          error.code === 1 ? 'ไม่ได้รับอนุญาตใช้ตำแหน่ง' : 'ไม่พบสัญญาณตำแหน่งขณะส่งมอบ';
        this.locating.set(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  clearGps() {
    this.geoGeneration++;
    this.locating.set(false);
    this.model.latitude = null;
    this.model.longitude = null;
    this.model.accuracy = null;
  }
  close() {
    if (this.command.busy()) return;
    this.geoGeneration++;
    this.locating.set(false);
    if (this.command.pending()) {
      this.mode.set(null);
      return;
    }
    if (this.dirty()) this.discard.set(true);
    else this.abandon();
  }
  abandon() {
    this.mode.set(null);
    this.files.set([]);
    this.pkg.set(null);
    this.proof.set(null);
    this.discard.set(false);
    this.command.clearError();
  }
  async reloadConflict() {
    if (this.command.pending() || this.command.busy()) return;
    this.loading.set(true);
    try {
      if (this.mode() === 'create') this.options.set(await this.api.options());
      else if (this.detail()) this.detail.set(await this.api.detail(this.detail()!.id));
      if (this.pkg())
        this.pkg.set(this.detail()?.packages.find((x) => x.id === this.pkg()!.id) ?? null);
      this.command.clearError();
      this.fields.set({});
      this.notice.set('โหลดข้อมูลล่าสุดแล้ว · ร่างยังอยู่ ตรวจจำนวนและรายการก่อนบันทึก');
    } catch (e) {
      this.formError.set(deliveryError(e));
    } finally {
      this.loading.set(false);
    }
  }
  async save() {
    const mode = this.mode(),
      d = this.detail();
    if (!mode || this.blocked() || this.locating()) return;
    const f: Record<string, string> = {};
    let body: unknown = {},
      path = '',
      kind = '';
    const positive = (n: number, max: number) =>
      Number.isFinite(n) && n > 0 && n <= max && Math.abs(Math.round(n * 1e6) - n * 1e6) < 0.00001;
    if (mode === 'create') {
      const order = this.order(),
        lines = this.model.lines.filter((x) => x.selected);
      if (!order) f['order'] = 'เลือก SO ที่ยังมียอดค้างส่ง';
      if (!this.model.date) f['date'] = 'ระบุวันที่นัดส่ง';
      if (!this.model.driverId) f['driver'] = 'เลือกผู้รับผิดชอบการส่ง';
      if (!lines.length) f['lines'] = 'เลือกสินค้าอย่างน้อย 1 รายการ';
      for (const line of lines)
        if (!positive(line.quantity, this.num(this.orderLine(line.id)?.available)))
          f['line-' + line.id] = 'จำนวนต้องมากกว่าศูนย์และไม่เกินยอดค้าง';
      body = {
        salesOrderId: this.model.orderId,
        expectedVersion: order?.version ?? null,
        plannedDate: this.model.date,
        driverUserId: this.model.driverId || null,
        carrierName: this.model.carrier.trim() || null,
        items: lines.map((x) => ({ salesOrderItemId: x.id, quantity: x.quantity })),
      } satisfies components['schemas']['CreateDelivery'];
      kind = 'delivery.create';
      path = '/deliveries';
    } else if (d) {
      const base = { expectedVersion: d.version };
      switch (mode) {
        case 'pick': {
          const c = this.choice();
          if (!c) f['choice'] = 'เลือก FG ที่จองไว้สำหรับรายการนี้';
          if (!positive(this.model.quantity, this.pickLimit()))
            f['quantity'] = 'จำนวนเกินยอดพร้อมหยิบ หรือไม่มากกว่าศูนย์';
          body = {
            ...base,
            deliveryItemId: c?.deliveryItemId ?? '',
            reservationId: c?.reservationId ?? '',
            reservationVersion: c?.reservationVersion ?? null,
            quantity: this.model.quantity,
          } satisfies components['schemas']['PickDelivery'];
          kind = 'delivery.pick';
          path = '/deliveries/' + d.id + '/pick';
          break;
        }
        case 'pack': {
          const lines = this.model.packs.filter((x) => x.selected);
          if (!lines.length) f['packs'] = 'เลือกรายการที่หยิบแล้วอย่างน้อย 1 รายการ';
          for (const line of lines)
            if (!positive(line.quantity, this.unpacked(line.id)))
              f['pack-' + line.id] = 'จำนวนเกินยอดที่ยังไม่อยู่ในกล่อง';
          body = {
            ...base,
            items: lines.map((x) => ({ pickId: x.id, quantity: x.quantity })),
            note: this.model.note.trim() || null,
          } satisfies components['schemas']['CreateDeliveryPackage'];
          kind = 'delivery.package_create';
          path = '/delivery/' + d.id + '/packages';
          break;
        }
        case 'scan':
          if (!this.model.barcode.trim()) f['barcode'] = 'สแกนหรือพิมพ์บาร์โค้ดจากฉลากกล่อง';
          body = {
            ...base,
            packageVersion: this.pkg()?.version ?? null,
            barcode: this.model.barcode.trim(),
            stage: this.model.stage,
          } satisfies components['schemas']['ScanDeliveryPackage'];
          kind = 'delivery.package_scan';
          path = '/delivery/' + d.id + '/packages/' + this.pkg()?.id + '/scan';
          break;
        case 'dispatch':
          if (!d.canDispatch) f['dispatch'] = 'ตรวจยอดหยิบและสแกนกล่องให้ครบก่อนส่งออก';
          body = base satisfies components['schemas']['DeliveryVersionRequest'];
          kind = 'delivery.dispatch';
          path = '/deliveries/' + d.id + '/dispatch';
          break;
        case 'pod': {
          const items = this.model.pods.flatMap((x) => [
            ...(x.good > 0 ? [{ pickId: x.id, quantity: x.good, outcome: 'SUCCESS' }] : []),
            ...(x.failed > 0 ? [{ pickId: x.id, quantity: x.failed, outcome: 'FAILED' }] : []),
          ]);
          if (!items.length) f['pods'] = 'ระบุจำนวนรับมอบหรือส่งไม่สำเร็จอย่างน้อย 1 รายการ';
          for (const row of this.model.pods)
            if (
              !Number.isFinite(row.good) ||
              !Number.isFinite(row.failed) ||
              row.good < 0 ||
              row.failed < 0 ||
              row.good + row.failed > this.podRemaining(row.id)
            )
              f['pod-' + row.id] = 'จำนวนต้องไม่ติดลบ และรวมไม่เกินยอดที่ยังไม่บันทึก';
          if (items.some((x) => x.outcome === 'SUCCESS') && !this.model.receiver.trim())
            f['receiver'] = 'ระบุชื่อผู้รับสินค้าจริง';
          if (items.some((x) => x.outcome === 'FAILED') && !this.model.note.trim())
            f['note'] = 'ระบุเหตุผลที่ส่งไม่สำเร็จ';
          if (this.model.latitude === null && !this.model.gpsReason.trim())
            f['gps'] = 'รับตำแหน่งปัจจุบัน หรือระบุเหตุผลที่ใช้ GPS ไม่ได้';
          if (
            !this.files().length ||
            this.files().length > 5 ||
            this.files().some(
              (x) =>
                !x.size ||
                !['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(x.type),
            ) ||
            this.files().reduce((n, x) => n + x.size, 0) > 20 * 1024 * 1024
          )
            f['files'] = 'แนบภาพหรือ PDF 1–5 ไฟล์ รวมไม่เกิน 20 MiB';
          body = {
            ...base,
            receiverName: this.model.receiver.trim() || null,
            latitude: this.model.latitude,
            longitude: this.model.longitude,
            accuracy: this.model.accuracy,
            locationExceptionReason:
              this.model.latitude === null ? this.model.gpsReason.trim() : null,
            captureMethod: this.model.latitude === null ? 'MANUAL' : 'DEVICE',
            deviceTime: new Date().toISOString(),
            items,
            fileIds: [],
            note: this.model.note.trim() || null,
          } satisfies components['schemas']['PodRequest'];
          kind = 'delivery.pod_upload';
          path = '/delivery/' + d.id + '/pod/upload';
          break;
        }
        case 'cancel':
        case 'unpick':
        case 'cancel-package':
        case 'gps':
          if (!this.model.reason.trim()) f['reason'] = 'ระบุเหตุผลเพื่อเก็บประวัติ';
          if (mode === 'cancel-package') {
            body = {
              ...base,
              packageVersion: this.pkg()?.version ?? null,
              reason: this.model.reason.trim(),
            } satisfies components['schemas']['CancelDeliveryPackage'];
            kind = 'delivery.package_cancel';
            path = '/delivery/' + d.id + '/packages/' + this.pkg()?.id + '/cancel';
          } else if (mode === 'unpick') {
            body = {
              ...base,
              reason: this.model.reason.trim(),
            } satisfies components['schemas']['CancelDeliveryRequest'];
            kind = 'delivery.unpick';
            path = '/delivery/' + d.id + '/picks/' + this.model.pickId + '/cancel';
          } else if (mode === 'gps') {
            body = {
              ...base,
              approved: this.model.approved,
              reason: this.model.reason.trim(),
            } satisfies components['schemas']['DecideLocationException'];
            kind = 'delivery.gps';
            path = '/delivery-location-exceptions/' + this.proof()?.exceptionId + '/decide';
          } else {
            body = {
              ...base,
              reason: this.model.reason.trim(),
            } satisfies components['schemas']['CancelDeliveryRequest'];
            kind = 'delivery.cancel';
            path = '/deliveries/' + d.id + '/cancel';
          }
          break;
      }
    }
    this.fields.set(f);
    this.formError.set('');
    if (Object.keys(f).length || !kind) return;
    await this.command.run(
      kind,
      path,
      body,
      mode === 'pod' ? this.files() : [],
      this.titles[mode] + (d ? ' · ' + d.number : ''),
      mode === 'create' ? undefined : d?.id,
    );
  }
  private async completed(result: unknown, pending: DeliveryPending) {
    const response = result as { id?: string; deliveryId?: string };
    const id = pending.deliveryId ?? response.deliveryId ?? response.id;
    if (!id || !/^[a-f0-9-]{36}$/i.test(id)) throw Error('ไม่พบเลขอ้างอิงรอบส่งที่บันทึก');
    const [detail, queue] = await Promise.all([
      this.api.detail(id),
      this.api.workspace(this.search, this.status, this.page),
    ]);
    this.generation++;
    this.detail.set(detail);
    this.queue.set(queue);
    this.notice.set(pending.label + 'สำเร็จ');
    this.fields.set({});
    this.formError.set('');
    this.files.set([]);
    const pkg = this.pkg() ? detail.packages.find((x) => x.id === this.pkg()!.id) : undefined;
    if (
      this.mode() === 'scan' &&
      pending.kind === 'delivery.package_scan' &&
      (pending.body as { stage?: string }).stage === 'PICK' &&
      pkg?.status === 'PACKED' &&
      !pkg.scans.some((x) => x.stage === 'PACK')
    ) {
      this.pkg.set(pkg);
      this.model.stage = 'PACK';
      this.model.barcode = '';
      this.baseline = JSON.stringify(this.model);
      this.notice.set('ตรวจหยิบผ่านแล้ว · สแกนยืนยันจัดกล่องต่อได้');
    } else this.mode.set(null);
  }
  async download(id: string, name: string) {
    try {
      const blob = await this.api.file(id),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      this.error.set(deliveryError(e));
    }
  }
}
