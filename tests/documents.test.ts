import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('AC15 stores immutable PDF and creates receipt only after recorded payment', () => {
  let s = createSeed();
  const pdf = new Blob(['%PDF-1.7 demo'], { type: 'application/pdf' });
  function run(type: string, data: unknown, userId = 'sales', key = crypto.randomUUID()) {
    const o = applyCommand(
      s,
      { type, data, key, expectedVersion: s.version },
      { userId, deviceId: 'test' },
    );
    s = o.state;
    return o.result;
  }
  const wo = run(
    'docs.issue',
    { kind: 'WorkOrder', referenceId: '', ids: ['wo-demo-1', 'wo-demo-2'], pdf },
    'planner',
  );
  expect(s.documents.find((d) => d.id === wo)?.snapshot).toHaveLength(2);
  expect(s.assets[0].blob).toBeInstanceOf(Blob);
  s.quotations.push({
    id: 'q',
    vatRate: 7,
    lines: [{ quantity: 1, unitPrice: 100, discount: 0 }],
  } as never);
  s.orders.push({
    id: 'o',
    number: 'SO-1',
    quoteId: 'q',
    customer: 'Buyer',
    po: 'PO',
    address: 'BKK',
    dueDate: '2026-10-15',
    lines: [],
  });
  s.deliveries.push({ id: 'd', orderId: 'o', status: 'Delivered' } as never);
  const inv = run('docs.issue', { kind: 'Invoice', referenceId: 'o', pdf }) as string;
  expect(s.documents.find((d) => d.id === inv)?.total).toBe(107);
  expect(() => run('docs.issue', { kind: 'Invoice', referenceId: 'o', pdf })).toThrow();
  expect(() => run('docs.issue', { kind: 'Receipt', referenceId: inv, pdf })).toThrow();
  const payment = run('payment.record', {
    invoiceId: inv,
    amount: 50,
    reference: 'BANK-1',
  }) as string;
  run('docs.issue', { kind: 'Receipt', referenceId: payment, pdf });
  expect(s.documents.at(-1)?.total).toBe(50);
  expect(() =>
    run('payment.record', { invoiceId: inv, amount: 58, reference: 'BANK-2' }),
  ).toThrow();
});
