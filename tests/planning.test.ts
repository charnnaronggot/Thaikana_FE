import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('AC05 AC06 allocates FG 4 and creates WO 6 once, denies shortage and wrong role', () => {
  let s = createSeed();
  s.quotations.push({ id: 'q', decision: 'Accepted', evidence: 'PO' } as never);
  s.orders.push({
    id: 'o',
    number: 'SO1',
    quoteId: 'q',
    customer: 'x',
    po: 'PO',
    address: '',
    dueDate: '2026-10-15',
    lines: [
      {
        id: 'l',
        quoteLineId: 'ql',
        productRevisionId: 'rev-cabinet-1',
        name: 'Cabinet',
        quantity: 10,
        planned: 0,
        allocated: 0,
        dispatched: 0,
        delivered: 0,
      },
    ],
  });
  const cmd = {
    type: 'planning.create',
    data: {
      orderId: 'o',
      lineId: 'l',
      revisionId: 'rev-cabinet-1',
      fgQuantity: 4,
      makeQuantity: 6,
      dueDate: '2026-10-15',
      priority: 'Normal',
      reason: '',
    },
    key: 'same',
    expectedVersion: 0,
  };
  expect(() => applyCommand(s, cmd, { userId: 'sales', deviceId: 'a' })).toThrow('ไม่มีสิทธิ์');
  const out = applyCommand(s, cmd, { userId: 'planner', deviceId: 'a' });
  s = out.state;
  expect(s.workOrders.at(-1)?.quantity).toBe(6);
  expect(s.fg[0].reserved).toBe(4);
  expect(s.orders[0].lines[0].planned).toBe(10);
  expect(applyCommand(s, cmd, { userId: 'planner', deviceId: 'a' }).state.workOrders.length).toBe(
    4,
  );
  expect(() =>
    applyCommand(
      s,
      { ...cmd, key: 'different', expectedVersion: s.version },
      { userId: 'planner', deviceId: 'a' },
    ),
  ).toThrow('วางแผนแล้ว');
  const low = createSeed();
  low.materials[0].onHand = 0;
  expect(() =>
    applyCommand(
      low,
      {
        ...cmd,
        data: {
          ...cmd.data,
          orderId: undefined,
          lineId: undefined,
          fgQuantity: 0,
          reason: 'Stock',
        },
      },
      { userId: 'planner', deviceId: 'a' },
    ),
  ).toThrow('วัสดุขาด');
});
