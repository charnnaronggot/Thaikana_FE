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
  BomLine,
} from './models';
import { round } from './money';
import Decimal from 'decimal.js';
export function calculateCogs(
  s: Parameters<Handler>[0],
  bom: BomLine[],
  labor: number,
  overhead: number,
  waste: number,
) {
  const material = round(
    bom.reduce((sum, b) => {
      const m = required(
        s.materials.find((m) => m.id === b.materialId),
        'ไม่พบวัสดุ',
      );
      positive(b.quantity);
      nonnegative(b.scrapPercent);
      ensure(b.scrapPercent <= 100, 'Scrap allowance ไม่เกิน 100%');
      ensure(m.active, 'วัสดุถูกระงับ');
      return sum.plus(
        new Decimal(b.quantity)
          .mul(new Decimal(1).plus(new Decimal(b.scrapPercent).div(100)))
          .mul(m.averageCost),
      );
    }, new Decimal(0)),
  );
  [labor, overhead, waste].forEach((x) => nonnegative(x, 'ต้นทุน'));
  return { material, cost: round(new Decimal(material).plus(labor).plus(overhead).plus(waste)) };
}
export const designHandlers: Record<string, Handler> = {
  'design.new': (s, d, c) => {
    permit(c, ['Designer']);
    const p = d as { name: string };
    ensure(p.name.trim(), 'ระบุชื่อสินค้า');
    const r: ProductRevision = {
      id: uid(),
      productId: uid(),
      code: 'MTO-' + String(s.revisions.length + 1).padStart(3, '0'),
      name: p.name,
      revision: 1,
      status: 'Draft',
      spec: '',
      drawingNumber: '',
      drawings: [],
      bom: [],
      labor: 0,
      overhead: 0,
      waste: 0,
      materialCost: 0,
      cost: null,
      costDate: '',
    };
    s.revisions.push(r);
    const id = uid();
    s.designs.push({
      id,
      quoteId: '',
      lineId: '',
      revisionId: r.id,
      status: 'Open',
      assignedTo: c.user.id,
      dueDate: c.now.slice(0, 10),
    });
    audit(s, c, 'Stock product design created', r.id);
    return id;
  },
  'design.save': (s, d, c) => {
    permit(c, ['Designer']);
    const p = d as {
      id: string;
      spec: string;
      drawingNumber: string;
      drawings: string[];
      bom: BomLine[];
      labor: number;
      overhead: number;
      waste: number;
      approve: boolean;
    };
    const task = required(s.designs.find((t) => t.id === p.id));
    const r = required(s.revisions.find((r) => r.id === task.revisionId));
    ensure(r.status === 'Draft', 'Approved Revision แก้ทับไม่ได้');
    const totals = calculateCogs(s, p.bom, p.labor, p.overhead, p.waste);
    ensure(
      p.drawings.every((id) => s.assets.some((a) => a.id === id)),
      'ไฟล์แนบไม่ครบ',
    );
    if (p.approve) {
      ensure(
        p.spec.trim() && p.drawingNumber.trim() && p.drawings.length && p.bom.length,
        'ต้องมี Spec เลขแบบ ไฟล์ Drawing และ BOM ก่อนส่งกลับ Sales',
      );
    }
    Object.assign(r, {
      spec: p.spec,
      drawingNumber: p.drawingNumber,
      drawings: [...p.drawings],
      bom: structuredClone(p.bom),
      labor: p.labor,
      overhead: p.overhead,
      waste: p.waste,
      materialCost: totals.material,
      cost: totals.cost,
      costDate: c.now.slice(0, 10),
    });
    if (p.approve) {
      r.status = 'Approved';
      task.status = 'Approved';
      const q = s.quotations.find((q) => q.id === task.quoteId);
      if (
        q &&
        q.lines.every(
          (l) => s.revisions.find((r) => r.id === l.productRevisionId)?.status === 'Approved',
        )
      )
        q.status = 'Pricing';
    }
    audit(s, c, p.approve ? 'Product revision approved' : 'Design saved', r.id);
    return true;
  },
};
