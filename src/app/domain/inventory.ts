import Decimal from 'decimal.js';
import {
  audit,
  ensure,
  Handler,
  Material,
  MovementType,
  nonnegative,
  permit,
  positive,
  required,
  uid,
} from './models';
import { materialDemand } from './planning';
import { round } from './money';
function movement(
  s: Parameters<Handler>[0],
  c: Parameters<Handler>[2],
  m: Material,
  type: MovementType,
  quantity: number,
  reference: string,
  reason = '',
) {
  s.movements.unshift({
    id: uid(),
    materialId: m.id,
    type,
    quantity,
    onHand: m.onHand,
    reserved: m.reserved,
    cost: m.averageCost,
    reference,
    reason,
    actorId: c.user.id,
    at: c.now,
  });
  audit(s, c, 'Inventory ' + type, reference, m.code + ' × ' + quantity);
}
export const inventoryHandlers: Record<string, Handler> = {
  'inv.material': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as Partial<Material>;
    ensure(p.code?.trim() && p.name?.trim() && p.unit?.trim(), 'กรุณาระบุรหัส ชื่อ และหน่วย');
    ensure(!s.materials.some((m) => m.code === p.code && m.id !== p.id), 'รหัสวัสดุซ้ำ');
    const old = s.materials.find((m) => m.id === p.id);
    if (old)
      Object.assign(old, {
        name: p.name,
        spec: p.spec ?? '',
        unit: p.unit,
        location: p.location ?? '',
        reorder: p.reorder ?? 0,
        active: p.active ?? true,
      });
    else
      s.materials.push({
        id: uid(),
        code: p.code!,
        name: p.name!,
        spec: p.spec ?? '',
        unit: p.unit!,
        location: p.location ?? '',
        barcode: '',
        lot: '',
        onHand: 0,
        reserved: 0,
        averageCost: 0,
        reorder: p.reorder ?? 0,
        active: true,
      });
    audit(s, c, 'Material saved', p.code!);
    return true;
  },
  'inv.barcode': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { materialId: string; barcode: string; lot: string };
    const m = required(s.materials.find((m) => m.id === p.materialId));
    ensure(p.barcode.trim(), 'ระบุ Barcode');
    ensure(
      !s.materials.some((x) => x.id !== m.id && x.barcode === p.barcode),
      'Barcode ผูกกับวัสดุอื่นแล้ว',
    );
    m.barcode = p.barcode.trim();
    m.lot = p.lot.trim();
    audit(s, c, 'Barcode linked', m.id, p.barcode);
    return true;
  },
  'inv.receive': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as {
      materialId: string;
      quantity: number;
      unitCost: number;
      lot: string;
      location: string;
      reference: string;
      barcode: string;
    };
    const m = required(s.materials.find((m) => m.id === p.materialId));
    ensure(m.active, 'วัสดุถูกระงับ');
    positive(p.quantity);
    nonnegative(p.unitCost, 'ต้นทุนต่อหน่วย');
    ensure(
      p.reference.trim() && p.lot.trim() && p.location.trim(),
      'ระบุเอกสารอ้างอิง Lot และที่เก็บ',
    );
    if (p.barcode) ensure(m.barcode === p.barcode, 'Barcode ไม่ตรงวัสดุ กรุณาผูก Barcode ก่อน');
    m.averageCost = round(
      new Decimal(m.onHand)
        .mul(m.averageCost)
        .plus(new Decimal(p.quantity).mul(p.unitCost))
        .div(new Decimal(m.onHand).plus(p.quantity)),
    );
    m.onHand = round(new Decimal(m.onHand).plus(p.quantity));
    m.lot = p.lot;
    m.location = p.location;
    movement(s, c, m, 'Receive', p.quantity, p.reference);
    return true;
  },
  'inv.reserve': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { woId: string; materialId: string; quantity: number };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(w.status === 'Ready' || w.status === 'Paused', 'จองได้เฉพาะ WO ที่ยังไม่จบ');
    const m = required(s.materials.find((m) => m.id === p.materialId));
    positive(p.quantity);
    const need = materialDemand(w.snapshot, w.quantity)[m.id] ?? 0;
    ensure(need > 0, 'วัสดุไม่อยู่ใน BOM');
    ensure(
      p.quantity <= need - (w.reserved[m.id] ?? 0) - (w.issued[m.id] ?? 0),
      'จำนวนจองเกิน BOM คงเหลือ',
    );
    ensure(p.quantity <= m.onHand - m.reserved, 'วัสดุพร้อมจองไม่พอ', 'conflict');
    m.reserved = round(new Decimal(m.reserved).plus(p.quantity));
    w.reserved[m.id] = round(new Decimal(w.reserved[m.id] ?? 0).plus(p.quantity));
    movement(s, c, m, 'Reserve', p.quantity, w.number);
    return true;
  },
  'inv.unreserve': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { woId: string; materialId: string; quantity: number };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    const m = required(s.materials.find((m) => m.id === p.materialId));
    positive(p.quantity);
    ensure((w.reserved[m.id] ?? 0) >= p.quantity, 'ยอดจอง WO ไม่พอ');
    w.reserved[m.id] = round(new Decimal(w.reserved[m.id]).minus(p.quantity));
    m.reserved = round(new Decimal(m.reserved).minus(p.quantity));
    movement(s, c, m, 'Unreserve', p.quantity, w.number);
    return true;
  },
  'inv.issue': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as {
      woId: string;
      materialId: string;
      quantity: number;
      extra: boolean;
      reason: string;
    };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    ensure(
      w.status === 'Ready' || w.status === 'Running' || w.status === 'Paused',
      'WO ไม่อยู่ในสถานะเบิกวัสดุ',
    );
    const m = required(s.materials.find((m) => m.id === p.materialId));
    positive(p.quantity);
    let consume = 0;
    if (p.extra) {
      ensure(p.reason.trim(), 'เบิกนอก BOM ต้องระบุเหตุผล');
      ensure(m.onHand - m.reserved >= p.quantity, 'ยอดพร้อมเบิกไม่พอ', 'conflict');
    } else {
      ensure((w.reserved[m.id] ?? 0) >= p.quantity, 'ต้องจองวัสดุตาม WO ก่อนเบิก');
      consume = p.quantity;
    }
    ensure(m.onHand >= p.quantity, 'วัสดุไม่พอ', 'conflict');
    m.onHand = round(new Decimal(m.onHand).minus(p.quantity));
    m.reserved = round(new Decimal(m.reserved).minus(consume));
    w.reserved[m.id] = round(new Decimal(w.reserved[m.id] ?? 0).minus(consume));
    w.issued[m.id] = round(new Decimal(w.issued[m.id] ?? 0).plus(p.quantity));
    movement(s, c, m, 'Issue', p.quantity, w.number, p.reason);
    return true;
  },
  'inv.return': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { woId: string; materialId: string; quantity: number; reason: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    const m = required(s.materials.find((m) => m.id === p.materialId));
    positive(p.quantity);
    ensure((w.issued[m.id] ?? 0) >= p.quantity, 'ยอดเบิกของ WO ไม่พอ');
    w.issued[m.id] = round(new Decimal(w.issued[m.id]).minus(p.quantity));
    m.onHand = round(new Decimal(m.onHand).plus(p.quantity));
    movement(s, c, m, 'Return', p.quantity, w.number, p.reason);
    return true;
  },
  'inv.scrap': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { woId: string; materialId: string; quantity: number; reason: string };
    const w = required(s.workOrders.find((w) => w.id === p.woId));
    const m = required(s.materials.find((m) => m.id === p.materialId));
    positive(p.quantity);
    ensure(p.reason.trim(), 'Scrap ต้องระบุเหตุผล');
    ensure((w.issued[m.id] ?? 0) >= p.quantity, 'ยอดวัสดุที่เบิกเข้า WO ไม่พอ');
    w.issued[m.id] = round(new Decimal(w.issued[m.id]).minus(p.quantity));
    movement(s, c, m, 'Scrap', p.quantity, w.number, p.reason);
    return true;
  },
  'inv.adjust': (s, d, c) => {
    permit(c, ['Store']);
    const p = d as { materialId: string; newQuantity: number; reason: string };
    const m = required(s.materials.find((m) => m.id === p.materialId));
    nonnegative(p.newQuantity);
    ensure(p.reason.trim().length >= 3, 'ปรับยอดต้องระบุเหตุผล');
    ensure(p.newQuantity >= m.reserved, 'ปรับ On hand ต่ำกว่ายอดจองไม่ได้');
    const delta = round(new Decimal(p.newQuantity).minus(m.onHand));
    m.onHand = p.newQuantity;
    movement(s, c, m, 'Adjust', delta, 'ADJ-' + s.movements.length, p.reason);
    return true;
  },
};
