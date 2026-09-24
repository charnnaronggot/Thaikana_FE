import { allocateFg } from './planning';
import { audit, ensure, Handler, permit, positive, required, uid } from './models';

export const deliveryHandlers: Record<string, Handler> = {
  'delivery.allocate': (s, d, c) => {
    permit(c, ['Delivery', 'Planner']);
    const p = d as { orderId: string; lineId: string; quantity: number };
    positive(p.quantity);
    ensure(Number.isInteger(p.quantity), 'จำนวน FG ต้องเป็นจำนวนเต็ม');
    const order = required(s.orders.find((o) => o.id === p.orderId));
    const line = required(order.lines.find((l) => l.id === p.lineId));
    ensure(
      p.quantity <= line.quantity - line.allocated,
      'จัดสรรเกินจำนวนที่ยังไม่จัดสรร',
      'conflict',
    );
    allocateFg(s, order.id, line.id, line.productRevisionId, p.quantity);
    line.planned = Math.max(line.planned, line.allocated);
    audit(s, c, 'FG allocated for delivery', order.id, line.name + ' / ' + p.quantity);
    return true;
  },
  'delivery.dispatch': (s, d, c) => {
    permit(c, ['Delivery']);
    const p = d as {
      orderId: string;
      lines: { allocationId: string; quantity: number }[];
      boxes: number;
      carrier: string;
      reference: string;
      address: string;
    };
    const order = required(s.orders.find((o) => o.id === p.orderId));
    ensure(
      p.lines.length > 0 && new Set(p.lines.map((l) => l.allocationId)).size === p.lines.length,
      'เลือกรายการหยิบสินค้าที่ไม่ซ้ำกัน',
    );
    positive(p.boxes);
    ensure(Number.isInteger(p.boxes), 'จำนวนกล่องต้องเป็นจำนวนเต็ม');
    ensure(
      p.carrier.trim() && p.reference.trim() && p.address.trim(),
      'ระบุผู้ขนส่ง เลขอ้างอิง และที่อยู่',
    );
    const deliveryLines = p.lines.map((item) => {
      positive(item.quantity);
      ensure(Number.isInteger(item.quantity), 'จำนวนส่งต้องเป็นจำนวนเต็ม');
      const allocation = required(s.allocations.find((a) => a.id === item.allocationId));
      ensure(allocation.orderId === order.id, 'รายการจัดสรรไม่ตรงคำสั่งขาย');
      ensure(
        item.quantity <= allocation.quantity - allocation.dispatched,
        'จำนวนส่งเกินยอดจัดสรรคงเหลือ',
        'conflict',
      );
      const line = required(order.lines.find((l) => l.id === allocation.lineId));
      const lot = required(s.fg.find((f) => f.id === allocation.lotId));
      ensure(lot.revisionId === line.productRevisionId, 'Revision สินค้าไม่ตรงกับคำสั่งขาย');
      ensure(
        item.quantity <= lot.quantity && item.quantity <= lot.reserved,
        'FG ในคลังไม่พอ',
        'conflict',
      );
      return { allocation, line, lot, quantity: item.quantity };
    });
    for (const x of deliveryLines) {
      x.allocation.dispatched += x.quantity;
      x.line.dispatched += x.quantity;
      x.lot.quantity -= x.quantity;
      x.lot.reserved -= x.quantity;
    }
    const id = uid();
    s.deliveries.push({
      id,
      number: 'DN-' + String(s.deliveries.length + 1).padStart(5, '0'),
      orderId: order.id,
      status: 'Dispatched',
      lines: deliveryLines.map((x) => ({
        allocationId: x.allocation.id,
        quantity: x.quantity,
        revisionId: x.lot.revisionId,
        name: x.line.name,
      })),
      boxes: p.boxes,
      carrier: p.carrier,
      reference: p.reference,
      address: p.address,
      dispatchedAt: c.now,
      deliveredAt: null,
      receiver: '',
      proof: '',
      coordinates: '',
      actorId: c.user.id,
    });
    audit(s, c, 'Delivery dispatched', id, p.reference);
    return id;
  },
  'delivery.delivered': (s, d, c) => {
    permit(c, ['Delivery']);
    const p = d as { id: string; receiver: string; proof: string; coordinates: string };
    const delivery = required(s.deliveries.find((x) => x.id === p.id));
    ensure(delivery.status === 'Dispatched', 'ใบส่งของนี้ยืนยันรับแล้ว', 'conflict');
    ensure(p.receiver.trim() && p.proof.trim(), 'ระบุผู้รับและหลักฐานการรับ');
    const order = required(s.orders.find((o) => o.id === delivery.orderId));
    for (const item of delivery.lines) {
      const allocation = required(s.allocations.find((a) => a.id === item.allocationId));
      const line = required(order.lines.find((l) => l.id === allocation.lineId));
      line.delivered += item.quantity;
    }
    delivery.status = 'Delivered';
    delivery.deliveredAt = c.now;
    delivery.receiver = p.receiver.trim();
    delivery.proof = p.proof.trim();
    delivery.coordinates = p.coordinates.trim();
    audit(s, c, 'Delivery received', delivery.id, delivery.receiver);
    return true;
  },
};
