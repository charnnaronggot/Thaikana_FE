import {
  audit,
  ensure,
  Handler,
  permit,
  positive,
  nonnegative,
  required,
  uid,
  Quotation,
  QuoteLine,
  ProductRevision,
} from './models';
import { quoteTotals } from './money';
export const salesHandlers: Record<string, Handler> = {
  'quote.save': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as Partial<Quotation>;
    ensure(p.customer?.trim() && p.dueDate && p.validUntil, 'ระบุลูกค้า วันที่ส่ง และวันหมดอายุ');
    const existing = s.quotations.find((q) => q.id === p.id);
    if (existing) {
      ensure(
        existing.status !== 'Issued' && !existing.superseded,
        'เอกสารที่ออกแล้วต้องสร้าง Revision ใหม่',
      );
      Object.assign(existing, {
        customer: p.customer,
        contact: p.contact ?? '',
        address: p.address ?? '',
        dueDate: p.dueDate,
        validUntil: p.validUntil,
      });
      return existing.id;
    }
    const q: Quotation = {
      id: uid(),
      number:
        'QT-' + String(s.quotations.filter((q) => q.revision === 1).length + 1).padStart(5, '0'),
      revision: 1,
      status: 'Draft',
      decision: 'Pending',
      superseded: false,
      customer: p.customer!,
      contact: p.contact ?? '',
      address: p.address ?? '',
      dueDate: p.dueDate!,
      validUntil: p.validUntil!,
      vatRate: s.settings.vatRate,
      salesId: c.user.id,
      lines: [],
      createdAt: c.now,
      po: '',
      evidence: '',
      decisionReason: '',
    };
    s.quotations.push(q);
    audit(s, c, 'Quotation created', q.id);
    return q.id;
  },
  'quote.line': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as { quoteId: string; line: QuoteLine };
    const q = required(s.quotations.find((q) => q.id === p.quoteId));
    ensure(!q.superseded && q.status !== 'Issued', 'ต้องสร้าง Quotation Revision ใหม่');
    const l = p.line;
    ensure(l.name.trim() && l.unit.trim(), 'กรุณาระบุชื่อสินค้าและหน่วย');
    positive(l.quantity);
    nonnegative(l.discount, 'ส่วนลด');
    ensure(l.discount <= 100, 'ส่วนลดไม่เกิน 100%');
    if (l.unitPrice !== null) nonnegative(l.unitPrice, 'ราคาต่อหน่วย');
    if (l.productRevisionId) required(s.revisions.find((r) => r.id === l.productRevisionId));
    const i = q.lines.findIndex((x) => x.id === l.id);
    if (i >= 0) {
      const old = q.lines[i];
      ensure(
        !s.designs.some((t) => t.quoteId === q.id && t.lineId === old.id && t.status === 'Open'),
        'งานอยู่ระหว่าง Design กรุณารอแบบและต้นทุน',
      );
      ensure(
        old.productRevisionId === l.productRevisionId &&
          old.spec === l.spec &&
          old.finish === l.finish &&
          old.requirement === l.requirement,
        'แก้แบบหรือ Requirement ต้องส่งกลับ Design',
      );
      q.lines[i] = structuredClone(l);
    } else {
      q.lines.push({ ...structuredClone(l), id: uid() });
    }
    audit(s, c, 'Quotation line saved', q.id);
    return true;
  },
  'quote.removeLine': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as { quoteId: string; lineId: string };
    const q = required(s.quotations.find((q) => q.id === p.quoteId));
    ensure(q.status === 'Draft' && !q.superseded, 'ลบรายการได้เฉพาะ Draft');
    q.lines = q.lines.filter((l) => l.id !== p.lineId);
    return true;
  },
  'quote.design': (s, d, c) => {
    permit(c, ['Sales']);
    const q = required(s.quotations.find((q) => q.id === (d as { id: string }).id));
    ensure(q.status !== 'Issued' && !q.superseded, 'เอกสารนี้แก้ไขไม่ได้');
    ensure(q.lines.length, 'เพิ่มสินค้าอย่างน้อยหนึ่งรายการ');
    for (const l of q.lines) {
      const r = s.revisions.find((r) => r.id === l.productRevisionId);
      if (r?.status === 'Approved') continue;
      if (s.designs.some((t) => t.quoteId === q.id && t.lineId === l.id)) continue;
      const rev: ProductRevision = {
        id: uid(),
        productId: uid(),
        code: 'MTO-' + String(s.revisions.length + 1).padStart(3, '0'),
        name: l.name,
        revision: 1,
        status: 'Draft',
        spec: l.spec,
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
      s.revisions.push(rev);
      l.productRevisionId = rev.id;
      s.designs.push({
        id: uid(),
        quoteId: q.id,
        lineId: l.id,
        revisionId: rev.id,
        status: 'Open',
        assignedTo: 'designer',
        dueDate: q.dueDate,
      });
    }
    q.status = q.lines.every(
      (l) => s.revisions.find((r) => r.id === l.productRevisionId)?.status === 'Approved',
    )
      ? 'Pricing'
      : 'Design';
    audit(s, c, 'Requirements sent to Design', q.id);
    return true;
  },
  'quote.revise': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as { id: string; kind: 'price' | 'design'; lineIds: string[]; reason: string };
    const old = required(s.quotations.find((q) => q.id === p.id));
    ensure(
      old.status === 'Issued' && !old.superseded && old.decision !== 'Accepted',
      'สร้าง Revision ได้จากเอกสารที่ออกแล้วและยังไม่ยอมรับ',
    );
    ensure(p.kind === 'price' || p.lineIds.length, 'เลือกรายการที่ต้องแก้แบบ');
    ensure(
      p.lineIds.every((id) => old.lines.some((l) => l.id === id)),
      'รายการสินค้าไม่ถูกต้อง',
    );
    const next: Quotation = structuredClone(old);
    next.id = uid();
    next.revision =
      Math.max(...s.quotations.filter((q) => q.number === old.number).map((q) => q.revision)) + 1;
    next.superseded = false;
    next.status = p.kind === 'price' ? 'Pricing' : 'Design';
    next.decision = 'Pending';
    next.evidence = '';
    next.po = '';
    next.createdAt = c.now;
    for (const l of next.lines) {
      const previous = l.id;
      l.id = uid();
      if (p.kind === 'design' && p.lineIds.includes(previous)) {
        const rev = structuredClone(
          required(s.revisions.find((r) => r.id === l.productRevisionId)),
        );
        rev.id = uid();
        rev.revision =
          Math.max(
            ...s.revisions.filter((r) => r.productId === rev.productId).map((r) => r.revision),
          ) + 1;
        rev.status = 'Draft';
        rev.cost = null;
        l.productRevisionId = rev.id;
        l.requirement = p.reason || l.requirement;
        s.revisions.push(rev);
        s.designs.push({
          id: uid(),
          quoteId: next.id,
          lineId: l.id,
          revisionId: rev.id,
          status: 'Open',
          assignedTo: 'designer',
          dueDate: next.dueDate,
        });
      }
    }
    old.superseded = true;
    s.quotations.push(next);
    audit(s, c, 'Quotation revised: ' + p.kind, next.id);
    return next.id;
  },
  'quote.issue': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as { id: string; pdf: Blob };
    const q = required(s.quotations.find((q) => q.id === p.id));
    ensure(
      q.status === 'Pricing' && !q.superseded && q.lines.length,
      'รอ Design หรือตรวจสถานะเอกสาร',
    );
    for (const l of q.lines) {
      const r = required(s.revisions.find((r) => r.id === l.productRevisionId));
      ensure(r.status === 'Approved' && r.cost !== null, 'แบบและต้นทุนยังไม่พร้อม');
      ensure(
        l.unitPrice !== null && l.unitPrice > 0 && l.discount < 100,
        'กรุณาตั้งราคาทุกรายการก่อนออกเอกสาร',
      );
    }
    ensure(p.pdf instanceof Blob && p.pdf.size > 0, 'สร้าง PDF ไม่สำเร็จ');
    q.status = 'Issued';
    const assetId = uid();
    s.assets.push({
      id: assetId,
      name: q.number + '-R' + q.revision + '.pdf',
      mime: 'application/pdf',
      blob: p.pdf,
    });
    s.documents.push({
      id: uid(),
      number: q.number + ' / R' + q.revision,
      kind: 'Quotation',
      referenceId: q.id,
      revision: q.revision,
      assetId,
      createdAt: c.now,
      snapshot: structuredClone(q),
      total: quoteTotals(q.lines, q.vatRate).total,
    });
    audit(s, c, 'Quotation PDF issued', q.id);
    return true;
  },
  'quote.decision': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as {
      id: string;
      decision: 'Accepted' | 'Rejected' | 'Expired';
      evidence: string;
      po: string;
      reason: string;
    };
    const q = required(s.quotations.find((q) => q.id === p.id));
    ensure(
      q.status === 'Issued' && !q.superseded && q.decision === 'Pending',
      'เอกสารนี้บันทึกผลตอบรับแล้วหรือถูกแทนที่',
    );
    ensure(['Accepted', 'Rejected', 'Expired'].includes(p.decision), 'ผลตอบรับไม่ถูกต้อง');
    ensure(
      p.decision === 'Accepted' ? p.evidence.trim() : p.reason.trim(),
      'กรุณาระบุหลักฐานหรือเหตุผล',
    );
    q.decision = p.decision;
    q.evidence = p.evidence;
    q.po = p.po;
    q.decisionReason = p.reason;
    if (p.decision === 'Accepted')
      s.orders.push({
        id: uid(),
        number: 'SO-' + String(s.orders.length + 1).padStart(5, '0'),
        quoteId: q.id,
        customer: q.customer,
        po: q.po,
        address: q.address,
        dueDate: q.dueDate,
        lines: q.lines.map((l) => ({
          id: uid(),
          quoteLineId: l.id,
          productRevisionId: required(l.productRevisionId),
          name: l.name,
          quantity: l.quantity,
          planned: 0,
          allocated: 0,
          dispatched: 0,
          delivered: 0,
        })),
      });
    audit(s, c, 'Customer ' + p.decision, q.id);
    return true;
  },
};
