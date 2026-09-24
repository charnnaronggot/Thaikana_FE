import { test, expect } from '@playwright/test';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
import { issueProof } from '../src/app/core/credentials';
import { quoteTotals, priceLine } from '../src/app/domain/money';
import { STAGES, DemoState } from '../src/app/domain/models';

test('AC01–AC15 complete connected Demo flow, revisions, exceptions and audit', () => {
  let s: DemoState = createSeed();
  let tick = 0;
  const pdf = new Blob(['%PDF-1.7 demo'], { type: 'application/pdf' });
  const asset = (id: string) =>
    s.assets.push({
      id,
      name: id + '.png',
      mime: 'image/png',
      blob: new Blob(['image'], { type: 'image/png' }),
    });
  ['drawing', 'front', 'back', 'left', 'right'].forEach(asset);
  const act = (userId: string, type: string, data: unknown, key = crypto.randomUUID()) => {
    const result = applyCommand(
      s,
      { type, data, key, expectedVersion: s.version },
      { userId, deviceId: 'acceptance' },
      new Date(Date.UTC(2026, 8, 24, 0, 0, tick++)).toISOString(),
    );
    s = result.state;
    return result.result as string;
  };
  const quoteId = act('sales', 'quote.save', {
    customer: 'North Studio',
    contact: 'Buyer',
    address: 'Bangkok',
    dueDate: '2026-10-15',
    validUntil: '2026-10-01',
  });
  const line = (
    name: string,
    revisionId: string | null,
    quantity: number,
    unitPrice: number | null,
  ) => ({
    id: '',
    kind: revisionId ? 'Existing' : 'MadeToOrder',
    productRevisionId: revisionId,
    name,
    category: 'Cabinet',
    quantity,
    unit: 'ชิ้น',
    spec: 'SUS304',
    finish: 'HL',
    requirement: '',
    unitPrice,
    discount: 0,
  });
  act('sales', 'quote.line', { quoteId, line: line('Cabinet A', 'rev-cabinet-1', 10, 32000) });
  act('sales', 'quote.line', { quoteId, line: line('Cabinet B', null, 2, null) });
  act('sales', 'quote.design', { id: quoteId });
  expect(s.designs.filter((d) => d.quoteId === quoteId)).toHaveLength(1);
  const task = s.designs.find((d) => d.quoteId === quoteId)!;
  act('designer', 'design.save', {
    id: task.id,
    spec: 'SUS304',
    drawingNumber: 'DWG-B-01',
    drawings: ['drawing'],
    bom: [{ materialId: 'mat-steel', quantity: 1, scrapPercent: 0, note: '' }],
    labor: 1000,
    overhead: 500,
    waste: 0,
    approve: true,
  });
  expect(s.quotations.find((q) => q.id === quoteId)?.status).toBe('Pricing');
  const original = s.quotations.find((q) => q.id === quoteId)!;
  const b = { ...original.lines[1], unitPrice: 30000 };
  act('sales', 'quote.line', { quoteId, line: b });
  act('sales', 'quote.issue', { id: quoteId, pdf });
  const priceId = act('sales', 'quote.revise', {
    id: quoteId,
    kind: 'price',
    lineIds: [],
    reason: 'Price update',
  });
  expect(s.quotations.find((q) => q.id === priceId)?.lines.map((l) => l.productRevisionId)).toEqual(
    original.lines.map((l) => l.productRevisionId),
  );
  expect(s.documents.find((d) => d.referenceId === quoteId)?.snapshot).toMatchObject({
    revision: 1,
  });
  act('sales', 'quote.issue', { id: priceId, pdf });
  const price = s.quotations.find((q) => q.id === priceId)!;
  const designId = act('sales', 'quote.revise', {
    id: priceId,
    kind: 'design',
    lineIds: [price.lines[1].id],
    reason: 'Door change',
  });
  const design = s.quotations.find((q) => q.id === designId)!;
  expect(design.lines[0].productRevisionId).toBe(price.lines[0].productRevisionId);
  expect(design.lines[1].productRevisionId).not.toBe(price.lines[1].productRevisionId);
  const changed = s.designs.find((d) => d.quoteId === designId)!;
  act('designer', 'design.save', {
    id: changed.id,
    spec: 'SUS304 / changed door',
    drawingNumber: 'DWG-B-02',
    drawings: ['drawing'],
    bom: [{ materialId: 'mat-steel', quantity: 1, scrapPercent: 0, note: '' }],
    labor: 1000,
    overhead: 500,
    waste: 0,
    approve: true,
  });
  act('sales', 'quote.issue', { id: designId, pdf });
  act('sales', 'quote.decision', {
    id: designId,
    decision: 'Accepted',
    evidence: 'Signed PO',
    po: 'PO-2026',
    reason: '',
  });
  const order = s.orders.at(-1)!;
  expect(order.lines).toHaveLength(2);
  expect(
    quoteTotals([{ ...line('Reference', 'rev-cabinet-1', 12, 32000), discount: 5 }], 7),
  ).toEqual({ net: 364800, vat: 25536, total: 390336 });
  expect(
    priceLine({ ...line('Reference', 'rev-cabinet-1', 12, 32000), discount: 5 }, 24000).profit,
  ).toBe(76800);
  const a = order.lines[0],
    bLine = order.lines[1];
  const planned = act('planner', 'planning.create', {
    orderId: order.id,
    lineId: a.id,
    revisionId: a.productRevisionId,
    fgQuantity: 4,
    makeQuantity: 6,
    dueDate: order.dueDate,
    priority: 'Normal',
    reason: '',
  }) as unknown as { woId: string };
  expect(a.quantity).toBe(10);
  expect(s.orders.at(-1)!.lines[0]).toMatchObject({ planned: 10, allocated: 4 });
  expect(s.fg[0].reserved).toBe(4);
  const woId = planned.woId;
  expect(() =>
    act('planner', 'planning.create', {
      orderId: order.id,
      lineId: a.id,
      revisionId: a.productRevisionId,
      fgQuantity: 0,
      makeQuantity: 1,
      dueDate: order.dueDate,
      priority: 'Normal',
      reason: '',
    }),
  ).toThrow();
  act('planner', 'planning.create', {
    orderId: order.id,
    lineId: bLine.id,
    revisionId: bLine.productRevisionId,
    fgQuantity: 0,
    makeQuantity: 2,
    dueDate: order.dueDate,
    priority: 'Normal',
    reason: '',
  });
  expect(s.workOrders.filter((w) => w.orderId === order.id)).toHaveLength(2);
  act('store', 'inv.reserve', { woId, materialId: 'mat-steel', quantity: 12 });
  act('store', 'inv.issue', {
    woId,
    materialId: 'mat-steel',
    quantity: 12,
    extra: false,
    reason: '',
  });
  expect(s.materials[0]).toMatchObject({ onHand: 88, reserved: 0 });
  const machines = {
    laser: 'LASER-01',
    bend: 'BEND-01',
    weld: 'WELD-01',
    polish: 'POLISH-01',
    assembly: 'ASSEMBLY-01',
  };
  for (const stage of STAGES) {
    expect(s.workOrders.find((w) => w.id === woId)?.stage).toBe(stage);
    act('somchai', 'execution.start', { woId, machine: machines[stage] });
    act('somchai', 'execution.complete', { woId, good: 6, reject: 0, scrap: 0 });
  }
  expect(s.workOrders.find((w) => w.id === woId)).toMatchObject({ status: 'QC', qcPending: 6 });
  const inspection = act('qc', 'qc.inspect', {
    woId,
    quantity: 6,
    passed: 6,
    failed: 0,
    pending: 0,
    checklist: [true, true, true],
    photos: ['front', 'back', 'left', 'right'],
    reason: '',
    destination: 'laser',
  });
  act('qc', 'fg.receive', { inspectionId: inspection, lot: 'LOT-NEW', location: 'FG-A02' });
  expect(s.fg.at(-1)?.quantity).toBe(6);
  act('delivery', 'delivery.allocate', { orderId: order.id, lineId: a.id, quantity: 6 });
  expect(s.orders.at(-1)!.lines[0].allocated).toBe(10);
  const alloc = s.allocations.find((x) => x.orderId === order.id && x.quantity === 6)!;
  const dispatched = act('delivery', 'delivery.dispatch', {
    orderId: order.id,
    lines: [
      {
        allocationId: alloc.id,
        quantity: 2,
        scanCode: s.fg.find((f) => f.id === alloc.lotId)!.code,
      },
    ],
    boxes: 1,
    carrier: 'Truck',
    reference: 'TR-1',
    address: 'Bangkok',
  });
  expect(s.orders.at(-1)!.lines[0]).toMatchObject({ dispatched: 2, delivered: 0 });
  act('delivery', 'delivery.delivered', {
    id: dispatched,
    receiver: 'Buyer',
    proof: 'POD-1',
    coordinates: '',
  });
  expect(s.orders.at(-1)!.lines[0].delivered).toBe(2);
  const invoice = act('sales', 'docs.issue', { kind: 'Invoice', referenceId: order.id, pdf });
  expect(() =>
    act('sales', 'docs.issue', { kind: 'Receipt', referenceId: invoice, pdf }),
  ).toThrow();
  const payment = act('sales', 'payment.record', {
    invoiceId: invoice,
    amount: 100,
    reference: 'BANK-1',
  });
  act('sales', 'docs.issue', { kind: 'Receipt', referenceId: payment, pdf });
  expect(s.documents.at(-1)?.total).toBe(100);
  expect(s.audit.some((x) => x.action === 'Delivery received')).toBe(true);
});
