import Decimal from 'decimal.js';
import { quoteTotals } from './money';
import {
  audit,
  DemoState,
  ensure,
  Handler,
  permit,
  positive,
  required,
  uid,
  WorkOrder,
} from './models';

export type AfterSaleKind = 'WorkOrder' | 'Label' | 'Invoice' | 'Billing' | 'Receipt';
export function documentSource(
  s: DemoState,
  kind: AfterSaleKind,
  referenceId: string,
  ids: string[] = [],
) {
  if (kind === 'WorkOrder') {
    const workOrders = ids.map((id) => required(s.workOrders.find((w) => w.id === id)));
    ensure(
      workOrders.length > 0 && new Set(ids).size === ids.length,
      'เลือก Work Order อย่างน้อยหนึ่งใบโดยไม่ซ้ำกัน',
    );
    return {
      title: 'ใบงานผลิต ' + workOrders.map((w) => w.number).join(', '),
      snapshot: structuredClone(workOrders),
      total: 0,
      referenceId: ids.join(','),
    };
  }
  if (kind === 'Label') {
    const d = required(s.deliveries.find((d) => d.id === referenceId));
    return { title: 'ป้ายกล่อง ' + d.number, snapshot: structuredClone(d), total: 0, referenceId };
  }
  if (kind === 'Invoice') {
    const o = required(s.orders.find((o) => o.id === referenceId));
    ensure(
      s.deliveries.some((d) => d.orderId === o.id && d.status === 'Delivered'),
      'ต้องยืนยันรับสินค้าอย่างน้อยหนึ่งครั้งก่อนออก Invoice',
    );
    const q = required(s.quotations.find((q) => q.id === o.quoteId));
    const totals = quoteTotals(q.lines, q.vatRate);
    return {
      title: 'Invoice ' + o.number,
      snapshot: { order: structuredClone(o), quotation: structuredClone(q), totals },
      total: totals.total,
      referenceId,
    };
  }
  if (kind === 'Billing') {
    const invoice = required(s.documents.find((d) => d.id === referenceId && d.kind === 'Invoice'));
    return {
      title: 'Billing ' + invoice.number,
      snapshot: structuredClone(invoice.snapshot),
      total: invoice.total,
      referenceId,
    };
  }
  const payment = required(s.payments.find((p) => p.id === referenceId));
  const invoice = required(
    s.documents.find((d) => d.id === payment.invoiceId && d.kind === 'Invoice'),
  );
  return {
    title: 'Receipt ' + invoice.number,
    snapshot: { payment: structuredClone(payment), invoice: structuredClone(invoice.snapshot) },
    total: payment.amount,
    referenceId,
  };
}
export const documentHandlers: Record<string, Handler> = {
  'docs.issue': (s, d, c) => {
    const p = d as { kind: AfterSaleKind; referenceId: string; ids?: string[]; pdf: Blob };
    ensure(
      ['WorkOrder', 'Label', 'Invoice', 'Billing', 'Receipt'].includes(p.kind),
      'ชนิดเอกสารไม่ถูกต้อง',
    );
    permit(c, p.kind === 'WorkOrder' ? ['Planner'] : p.kind === 'Label' ? ['Delivery'] : ['Sales']);
    ensure(
      p.pdf instanceof Blob && p.pdf.type === 'application/pdf' && p.pdf.size > 0,
      'ไฟล์ PDF ไม่ถูกต้อง',
    );
    const source = documentSource(s, p.kind, p.referenceId, p.ids);
    if (p.kind !== 'WorkOrder')
      ensure(
        !s.documents.some((d) => d.kind === p.kind && d.referenceId === source.referenceId),
        'เอกสารชนิดนี้ออกแล้ว เปิดจากประวัติแทน',
        'conflict',
      );
    const serial = String(s.documents.filter((d) => d.kind === p.kind).length + 1).padStart(5, '0');
    const number =
      ({ WorkOrder: 'WOP', Label: 'LBL', Invoice: 'INV', Billing: 'BIL', Receipt: 'RCT' } as const)[
        p.kind
      ] +
      '-' +
      serial;
    const assetId = uid();
    s.assets.push({ id: assetId, name: number + '.pdf', mime: 'application/pdf', blob: p.pdf });
    const id = uid();
    s.documents.push({
      id,
      number,
      kind: p.kind,
      referenceId: source.referenceId,
      revision: 1,
      assetId,
      createdAt: c.now,
      snapshot: source.snapshot,
      total: source.total,
    });
    audit(s, c, p.kind + ' PDF issued', id, source.title);
    return id;
  },
  'payment.record': (s, d, c) => {
    permit(c, ['Sales']);
    const p = d as { invoiceId: string; amount: number; reference: string };
    const invoice = required(s.documents.find((d) => d.id === p.invoiceId && d.kind === 'Invoice'));
    positive(p.amount);
    ensure(p.reference.trim(), 'ระบุเลขอ้างอิงรับเงิน');
    const paid = s.payments
      .filter((x) => x.invoiceId === invoice.id)
      .reduce((n, x) => new Decimal(n).plus(x.amount).toNumber(), 0);
    ensure(
      new Decimal(paid).plus(p.amount).lessThanOrEqualTo(invoice.total),
      'ยอดรับเงินเกินยอด Invoice',
      'conflict',
    );
    const id = uid();
    s.payments.push({
      id,
      invoiceId: invoice.id,
      amount: p.amount,
      reference: p.reference.trim(),
      at: c.now,
      actorId: c.user.id,
    });
    audit(s, c, 'Payment recorded', invoice.id, p.reference);
    return id;
  },
};
