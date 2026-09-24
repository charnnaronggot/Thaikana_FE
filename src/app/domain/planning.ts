import {
  audit,
  ensure,
  Handler,
  permit,
  positive,
  nonnegative,
  required,
  uid,
  ProductRevision,
  WorkOrder,
  DemoState,
} from './models';
import Decimal from 'decimal.js';
export function materialDemand(r: ProductRevision, qty: number) {
  const totals: Record<string, number> = {};
  for (const b of r.bom)
    totals[b.materialId] = new Decimal(totals[b.materialId] ?? 0)
      .plus(
        new Decimal(b.quantity)
          .mul(qty)
          .mul(new Decimal(1).plus(new Decimal(b.scrapPercent).div(100))),
      )
      .toDecimalPlaces(3, Decimal.ROUND_UP)
      .toNumber();
  return totals;
}
export function readiness(s: DemoState, r: ProductRevision | undefined, qty: number) {
  const reasons: string[] = [];
  if (!r || r.status !== 'Approved' || r.cost === null || !r.bom.length || !r.drawingNumber)
    reasons.push('Product Revision, Drawing, BOM หรือ COGS ยังไม่พร้อม');
  if (r)
    for (const [id, n] of Object.entries(materialDemand(r, qty))) {
      const m = s.materials.find((m) => m.id === id);
      if (!m || !m.active || m.onHand - m.reserved < n)
        reasons.push(
          (m?.code ?? id) + ' วัสดุขาด ' + Math.max(0, n - ((m?.onHand ?? 0) - (m?.reserved ?? 0))),
        );
    }
  return reasons;
}
export function allocateFg(
  s: DemoState,
  orderId: string,
  lineId: string,
  revisionId: string,
  qty: number,
) {
  let left = qty;
  for (const lot of s.fg.filter((f) => f.revisionId === revisionId)) {
    const take = Math.min(left, lot.quantity - lot.reserved);
    if (take > 0) {
      lot.reserved += take;
      s.allocations.push({
        id: uid(),
        orderId,
        lineId,
        lotId: lot.id,
        quantity: take,
        dispatched: 0,
      });
      left -= take;
    }
  }
  ensure(left === 0, 'FG พร้อมจัดสรรไม่เพียงพอ', 'conflict');
  const order = required(s.orders.find((o) => o.id === orderId));
  required(order.lines.find((l) => l.id === lineId)).allocated += qty;
}
export const planningHandlers: Record<string, Handler> = {
  'planning.create': (s, d, c) => {
    permit(c, ['Planner']);
    const p = d as {
      orderId?: string;
      lineId?: string;
      revisionId: string;
      fgQuantity: number;
      makeQuantity: number;
      dueDate: string;
      priority: 'Normal' | 'High';
      reason: string;
    };
    nonnegative(p.fgQuantity);
    nonnegative(p.makeQuantity);
    positive(p.fgQuantity + p.makeQuantity);
    ensure(p.dueDate, 'ระบุวันกำหนดส่ง');
    const r = required(s.revisions.find((r) => r.id === p.revisionId));
    const errors = readiness(s, r, p.makeQuantity);
    ensure(!errors.length, errors.join(' · '), 'readiness');
    const order = p.orderId ? required(s.orders.find((o) => o.id === p.orderId)) : undefined;
    const line = order ? required(order.lines.find((l) => l.id === p.lineId)) : undefined;
    if (order && line) {
      ensure(line.productRevisionId === r.id, 'Product Revision ไม่ตรงคำสั่งขาย');
      const q = required(s.quotations.find((q) => q.id === order.quoteId));
      ensure(q.decision === 'Accepted' && q.evidence, 'ยังไม่มีหลักฐานลูกค้ายอมรับ');
      ensure(
        p.makeQuantity + p.fgQuantity <= line.quantity - line.planned,
        'จำนวนนี้วางแผนแล้วหรือเกินยอดค้าง',
        'conflict',
      );
      if (p.fgQuantity) allocateFg(s, order.id, line.id, r.id, p.fgQuantity);
      line.planned += p.makeQuantity + p.fgQuantity;
    } else {
      ensure(
        p.fgQuantity === 0 && p.reason.trim(),
        'งานผลิตเก็บสต็อกต้องมีเหตุผล และไม่จัดสรร FG เดิม',
      );
    }
    let woId: string | null = null;
    if (p.makeQuantity) {
      woId = uid();
      const w: WorkOrder = {
        id: woId,
        number: 'WO-' + String(s.workOrders.length + 1).padStart(5, '0'),
        orderId: order?.id ?? null,
        orderLineId: line?.id ?? null,
        snapshot: structuredClone(r),
        quantity: p.makeQuantity,
        processQuantity: p.makeQuantity,
        stage: 'laser',
        status: 'Ready',
        dueDate: p.dueDate,
        priority: p.priority,
        reason: p.reason,
        salesName: order
          ? (s.users.find((u) => u.id === s.quotations.find((q) => q.id === order.quoteId)?.salesId)
              ?.name ?? '')
          : 'ผลิตเก็บสต็อก',
        printNote: '',
        reserved: {},
        issued: {},
        qcPending: 0,
        fgReceived: 0,
        createdAt: c.now,
      };
      s.workOrders.push(w);
    }
    audit(s, c, 'Planning allocated / WO created', woId ?? order!.id);
    return { woId };
  },
  'planning.deny': (s, d, c) => {
    permit(c, ['Planner']);
    const p = d as { id: string; reason: string };
    ensure(p.reason.trim(), 'ระบุเหตุผล Denied');
    audit(s, c, 'Planning Denied', p.id, p.reason);
    return true;
  },
  'wo.note': (s, d, c) => {
    permit(c, ['Planner']);
    const p = d as { id: string; note: string };
    required(s.workOrders.find((w) => w.id === p.id)).printNote = p.note;
    audit(s, c, 'Print note updated', p.id);
    return true;
  },
  'wo.cancel': (s, d, c) => {
    permit(c, ['Planner']);
    const p = d as { id: string; reason: string };
    const w = required(s.workOrders.find((w) => w.id === p.id));
    ensure(w.status === 'Ready' && p.reason.trim(), 'ยกเลิกได้เฉพาะงาน Ready และต้องมีเหตุผล');
    ensure(
      Object.values(w.issued).every((n) => n === 0) &&
        Object.values(w.reserved).every((n) => n === 0),
      'คืนวัสดุและยกเลิกจองก่อนยกเลิก WO',
    );
    w.status = 'Cancelled';
    if (w.orderId) {
      const o = required(s.orders.find((o) => o.id === w.orderId));
      required(o.lines.find((l) => l.id === w.orderLineId)).planned -= w.quantity;
    }
    audit(s, c, 'WO cancelled', w.id, p.reason);
    return true;
  },
};
