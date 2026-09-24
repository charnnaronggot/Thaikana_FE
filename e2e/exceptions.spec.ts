import { test, expect } from '@playwright/test';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
import { issueProof } from '../src/app/core/credentials';
import { DemoState } from '../src/app/domain/models';

function fixture() {
  let s: DemoState = createSeed();
  const run = (userId: string, type: string, data: unknown, key = crypto.randomUUID()) => {
    const r = applyCommand(
      s,
      { type, data, key, expectedVersion: s.version },
      {
        userId,
        stationId: userId === 'station-laser' ? userId : undefined,
        deviceId: 'acceptance',
      },
    );
    s = r.state;
    return r.result;
  };
  return {
    run,
    get state() {
      return s;
    },
    set state(v: DemoState) {
      s = v;
    },
  };
}
test('AC07 ledger reconciles 80 on hand, 10 reserved, 70 available; return, scrap, receive', () => {
  const f = fixture(),
    s = f.state;
  s.workOrders[0].quantity = 20;
  f.run('store', 'inv.reserve', { woId: 'wo-demo-1', materialId: 'mat-steel', quantity: 30 });
  f.run('store', 'inv.issue', {
    woId: 'wo-demo-1',
    materialId: 'mat-steel',
    quantity: 20,
    extra: false,
    reason: '',
  });
  expect([
    f.state.materials[0].onHand,
    f.state.materials[0].reserved,
    f.state.materials[0].onHand - f.state.materials[0].reserved,
  ]).toEqual([80, 10, 70]);
  f.run('store', 'inv.return', {
    woId: 'wo-demo-1',
    materialId: 'mat-steel',
    quantity: 5,
    reason: 'unused',
  });
  f.run('store', 'inv.scrap', {
    woId: 'wo-demo-1',
    materialId: 'mat-steel',
    quantity: 2,
    reason: 'damaged',
  });
  f.run('store', 'inv.receive', {
    materialId: 'mat-steel',
    quantity: 15,
    unitCost: 12000,
    lot: 'B',
    location: 'A',
    reference: 'PO1',
    barcode: '885000000001',
  });
  expect(f.state.movements.map((m) => m.type)).toEqual([
    'Receive',
    'Scrap',
    'Return',
    'Issue',
    'Reserve',
  ]);
  expect(f.state.materials[0].onHand).toBe(100);
});
test('AC09 AC10 PIN lock and independent Station cards', () => {
  const f = fixture(),
    s = f.state;
  for (const [id, n] of [
    ['wo-demo-1', 16],
    ['wo-demo-2', 12],
  ] as const)
    s.workOrders.find((w) => w.id === id)!.issued['mat-steel'] = n;
  const actor = { userId: 'station-laser', stationId: 'station-laser', deviceId: 'acceptance' };
  for (const [woId, workerId, machine] of [
    ['wo-demo-1', 'somchai', 'LASER-01'],
    ['wo-demo-2', 'mana', 'LASER-02'],
  ] as const) {
    const proof = issueProof(f.state, actor, woId, 'start', workerId, 'demo');
    f.run('station-laser', 'execution.start', { woId, machine, proof });
  }
  expect(f.state.executions.filter((e) => e.status === 'Running')).toHaveLength(2);
  expect(() => issueProof(f.state, actor, 'wo-demo-1', 'complete', 'somchai', '000000')).toThrow(
    'PIN',
  );
  for (let i = 0; i < 5; i++) f.run('station-laser', 'auth.pinFailure', { id: 'somchai' });
  expect(f.state.users.find((u) => u.id === 'somchai')?.locked).toBe(true);
  expect(f.state.workOrders[0].status).toBe('Running');
  f.run('admin', 'user.reset', { id: 'somchai' });
  const proof = issueProof(f.state, actor, 'wo-demo-1', 'complete', 'somchai', '123456');
  f.run('station-laser', 'execution.complete', {
    woId: 'wo-demo-1',
    good: 8,
    reject: 0,
    scrap: 0,
    proof,
  });
  expect(f.state.workOrders[1].status).toBe('Running');
  expect(f.state.executions[1].workerId).toBe('mana');
});
test('AC12 AC13 problem, partial QC pass and rework preserve trace and receive only passed FG', () => {
  const f = fixture();
  f.state.workOrders[0].status = 'Running';
  f.run('somchai', 'production.problem', {
    woId: 'wo-demo-1',
    reason: 'weld mark',
    destination: 'weld',
    note: 'rework',
    assetIds: [],
  });
  f.state.workOrders[0].status = 'QC';
  f.state.workOrders[0].qcPending = 8;
  for (const side of ['front', 'back', 'left', 'right'])
    f.state.assets.push({ id: side, name: side, mime: 'image/png', blob: new Blob(['img']) });
  const inspection = f.run('qc', 'qc.inspect', {
    woId: 'wo-demo-1',
    quantity: 8,
    passed: 5,
    failed: 2,
    pending: 1,
    checklist: [true, true, true],
    photos: ['front', 'back', 'left', 'right'],
    reason: 'scratch',
    destination: 'polish',
  }) as string;
  expect(f.state.workOrders[0].qcPending).toBe(1);
  expect(f.state.workOrders.at(-1)).toMatchObject({
    quantity: 2,
    stage: 'polish',
    status: 'Ready',
  });
  f.run('qc', 'fg.receive', { inspectionId: inspection, lot: 'LOT-QC', location: 'FG-A' });
  expect(f.state.fg.at(-1)?.quantity).toBe(5);
  expect(f.state.problems).toHaveLength(2);
  expect(() =>
    f.run('qc', 'fg.receive', { inspectionId: inspection, lot: 'LOT-QC', location: 'FG-A' }),
  ).toThrow();
});
test('AC15 disabled user and wrong role cannot mutate data', () => {
  const f = fixture(),
    version = f.state.version;
  expect(() =>
    f.run('viewer', 'planning.create', {
      revisionId: 'rev-cabinet-1',
      fgQuantity: 0,
      makeQuantity: 1,
      dueDate: '2026-10-15',
      priority: 'Normal',
      reason: 'Stock',
    }),
  ).toThrow('ไม่มีสิทธิ์');
  expect(f.state.version).toBe(version);
  f.run('admin', 'user.status', { id: 'sales', active: false });
  expect(() =>
    f.run('sales', 'quote.save', {
      customer: 'Buyer',
      dueDate: '2026-10-15',
      validUntil: '2026-10-01',
    }),
  ).toThrow('บัญชีถูกระงับ');
  expect(f.state.quotations).toHaveLength(0);
  expect(f.state.audit.some((x) => x.action === 'User disabled')).toBe(true);
});
