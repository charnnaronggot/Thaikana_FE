import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';

it('AC14 dispatches and confirms partial deliveries without consuming unshipped FG', () => {
  let s = createSeed();
  s.orders.push({
    id: 'o',
    number: 'SO-1',
    quoteId: 'q',
    customer: 'A',
    po: 'PO',
    address: 'Bangkok',
    dueDate: '2026-10-15',
    lines: [
      {
        id: 'l',
        quoteLineId: 'ql',
        productRevisionId: 'rev-cabinet-1',
        name: 'Cabinet',
        quantity: 4,
        planned: 4,
        allocated: 4,
        dispatched: 0,
        delivered: 0,
      },
    ],
  });
  s.allocations.push({
    id: 'a',
    orderId: 'o',
    lineId: 'l',
    lotId: 'fg-demo',
    quantity: 4,
    dispatched: 0,
  });
  s.fg[0].reserved = 4;
  function run(type: string, data: unknown, key: string) {
    const out = applyCommand(
      s,
      { type, data, key, expectedVersion: s.version },
      { userId: 'delivery', deviceId: 'test' },
    );
    s = out.state;
    return out.result;
  }
  const id = run(
    'delivery.dispatch',
    {
      orderId: 'o',
      lines: [{ allocationId: 'a', quantity: 2 }],
      boxes: 1,
      carrier: 'Truck',
      reference: 'TR-1',
      address: 'Bangkok',
    },
    'one',
  ) as string;
  expect(s.fg[0]).toMatchObject({ quantity: 2, reserved: 2 });
  expect(s.orders[0].lines[0]).toMatchObject({ dispatched: 2, delivered: 0 });
  expect(() =>
    run(
      'delivery.dispatch',
      {
        orderId: 'o',
        lines: [{ allocationId: 'a', quantity: 3 }],
        boxes: 1,
        carrier: 'Truck',
        reference: 'TR-2',
        address: 'Bangkok',
      },
      'too-many',
    ),
  ).toThrow();
  expect(() =>
    run('delivery.delivered', { id, receiver: '', proof: '', coordinates: '' }, 'no-proof'),
  ).toThrow();
  run(
    'delivery.delivered',
    { id, receiver: 'Buyer', proof: 'Signed POD', coordinates: '' },
    'received',
  );
  expect(s.orders[0].lines[0].delivered).toBe(2);
  expect(() =>
    run(
      'delivery.delivered',
      { id, receiver: 'Buyer', proof: 'Signed POD', coordinates: '' },
      'again',
    ),
  ).toThrow();
  const second = run(
    'delivery.dispatch',
    {
      orderId: 'o',
      lines: [{ allocationId: 'a', quantity: 2 }],
      boxes: 1,
      carrier: 'Truck',
      reference: 'TR-2',
      address: 'Bangkok',
    },
    'two',
  ) as string;
  run(
    'delivery.delivered',
    { id: second, receiver: 'Buyer', proof: 'Signed POD', coordinates: '' },
    'second-received',
  );
  expect(s.orders[0].lines[0].delivered).toBe(4);
  expect(s.fg[0]).toMatchObject({ quantity: 0, reserved: 0 });
});
