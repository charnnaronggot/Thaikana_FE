import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { progress, searchRecords } from '../src/app/domain/dashboard';
it('AC16 searches barcode, PO and WO; shows separate progress for multiple lines and WOs', () => {
  const s = createSeed();
  s.orders.push({
    id: 'o',
    number: 'SO-1',
    quoteId: 'q',
    customer: 'Buyer',
    po: 'PO-567',
    address: '',
    dueDate: '2026-10-15',
    lines: [
      {
        id: 'l1',
        quoteLineId: 'q1',
        productRevisionId: 'rev-cabinet-1',
        name: 'Cabinet A',
        quantity: 10,
        planned: 10,
        allocated: 4,
        dispatched: 2,
        delivered: 2,
      },
      {
        id: 'l2',
        quoteLineId: 'q2',
        productRevisionId: 'rev-cabinet-1',
        name: 'Cabinet B',
        quantity: 5,
        planned: 5,
        allocated: 0,
        dispatched: 0,
        delivered: 0,
      },
    ],
  });
  s.workOrders[0].orderLineId = 'l1';
  s.workOrders[0].orderId = 'o';
  s.workOrders[1].orderLineId = 'l1';
  s.workOrders[1].orderId = 'o';
  s.workOrders[2].orderLineId = 'l2';
  s.workOrders[2].orderId = 'o';
  expect(searchRecords(s, '885000000001')[0].kind).toBe('Material');
  expect(searchRecords(s, 'PO-567')[0].kind).toBe('Sales Order');
  expect(searchRecords(s, 'WO-260922-001')[0].kind).toBe('Work Order');
  const p = progress(s, s.orders[0]);
  expect(p.map((x) => x.woCount)).toEqual([2, 1]);
  expect(p[0].delivered).toBe(2);
  expect(p[1].delivered).toBe(0);
});
