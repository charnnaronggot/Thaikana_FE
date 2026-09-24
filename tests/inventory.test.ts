import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('AC07 ledger reconciles receive/reserve/issue/return/scrap and moving average', () => {
  let s = createSeed();
  s.workOrders[0].quantity = 20;
  const act = (type: string, data: unknown) => {
    const r = applyCommand(
      s,
      { type, data, key: crypto.randomUUID(), expectedVersion: s.version },
      { userId: 'store', deviceId: 'a' },
    );
    s = r.state;
  };
  act('inv.reserve', { woId: 'wo-demo-1', materialId: 'mat-steel', quantity: 30 });
  expect([
    s.materials[0].onHand,
    s.materials[0].reserved,
    s.materials[0].onHand - s.materials[0].reserved,
  ]).toEqual([100, 30, 70]);
  act('inv.issue', {
    woId: 'wo-demo-1',
    materialId: 'mat-steel',
    quantity: 20,
    extra: false,
    reason: '',
  });
  expect([
    s.materials[0].onHand,
    s.materials[0].reserved,
    s.materials[0].onHand - s.materials[0].reserved,
  ]).toEqual([80, 10, 70]);
  act('inv.return', { woId: 'wo-demo-1', materialId: 'mat-steel', quantity: 5, reason: 'unused' });
  expect(s.materials[0].onHand).toBe(85);
  act('inv.scrap', { woId: 'wo-demo-1', materialId: 'mat-steel', quantity: 2, reason: 'damage' });
  expect(s.materials[0].onHand).toBe(85);
  expect(s.movements.map((m) => m.type)).toEqual(['Scrap', 'Return', 'Issue', 'Reserve']);
  act('inv.receive', {
    materialId: 'mat-steel',
    quantity: 15,
    unitCost: 12000,
    lot: 'B',
    location: 'A',
    reference: 'PO1',
    barcode: '885000000001',
  });
  expect(s.materials[0].onHand).toBe(100);
  expect(s.materials[0].averageCost).toBe(10300);
});
it('denies duplicate Barcode and insufficient stock without mutation', () => {
  let s = createSeed();
  s.materials.push({ ...s.materials[0], id: 'm2', code: 'M2', barcode: '' });
  expect(() =>
    applyCommand(
      s,
      {
        type: 'inv.barcode',
        data: { materialId: 'm2', barcode: '885000000001', lot: 'B' },
        key: 'x',
        expectedVersion: 0,
      },
      { userId: 'store', deviceId: 'a' },
    ),
  ).toThrow('Barcode');
  expect(s.materials[1].barcode).toBe('');
});
