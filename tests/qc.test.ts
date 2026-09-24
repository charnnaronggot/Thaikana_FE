import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('AC12 AC13 partial QC creates rework and receives only passed FG', () => {
  let s = createSeed();
  s.workOrders[0].status = 'QC';
  s.workOrders[0].qcPending = 8;
  for (let n = 0; n < 4; n++)
    s.assets.push({ id: 'p' + n, name: 'photo' + n, mime: 'image/png', blob: new Blob(['img']) });
  const act = (type: string, data: unknown) => {
    const x = applyCommand(
      s,
      { type, data, expectedVersion: s.version, key: crypto.randomUUID() },
      { userId: 'qc', deviceId: 'a' },
    );
    s = x.state;
    return x.result as string;
  };
  const p = {
    woId: 'wo-demo-1',
    quantity: 8,
    passed: 5,
    failed: 2,
    pending: 1,
    checklist: [true, true, true],
    photos: ['p0', 'p1', 'p2', 'p3'],
    reason: 'Surface defect',
    destination: 'polish',
  };
  const id = act('qc.inspect', p);
  expect(s.workOrders[0].qcPending).toBe(1);
  expect(s.workOrders.at(-1)?.quantity).toBe(2);
  expect(s.workOrders.at(-1)?.stage).toBe('polish');
  expect(s.problems[0].reason).toBe('Surface defect');
  act('fg.receive', { inspectionId: id, lot: 'L', location: 'FG-A01' });
  expect(s.fg.at(-1)?.quantity).toBe(5);
  expect(() => act('fg.receive', { inspectionId: id, lot: 'L', location: 'FG-A01' })).toThrow(
    'รับ FG แล้ว',
  );
});
it('requires four QC photos and balanced counts', () => {
  let s = createSeed();
  s.workOrders[0].status = 'QC';
  s.workOrders[0].qcPending = 8;
  const base = {
    woId: 'wo-demo-1',
    quantity: 8,
    passed: 6,
    failed: 0,
    pending: 0,
    checklist: [true, true, true],
    photos: [],
    reason: '',
    destination: 'laser',
  };
  expect(() =>
    applyCommand(
      s,
      { type: 'qc.inspect', data: base, expectedVersion: 0, key: 'x' },
      { userId: 'qc', deviceId: 'a' },
    ),
  ).toThrow('ต้องเท่า');
  expect(s.inspections).toHaveLength(0);
});
