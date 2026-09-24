import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
import { issueProof } from '../src/app/core/credentials';
it('AC08 AC10 Station Start binds worker and machine; finishing one card leaves another untouched', () => {
  let s = createSeed();
  const act = (type: string, data: unknown, at: string) => {
    const r = applyCommand(
      s,
      { type, data, expectedVersion: s.version, key: crypto.randomUUID() },
      { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' },
      at,
    );
    s = r.state;
    return r.result;
  };
  s.workOrders[0].issued['mat-steel'] = 16;
  s.workOrders[1].issued['mat-steel'] = 12;
  let p = issueProof(
    s,
    { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' },
    'wo-demo-1',
    'start',
    'somchai',
    'demo',
  );
  act(
    'execution.start',
    { woId: 'wo-demo-1', machine: 'LASER-01', proof: p },
    '2026-09-22T00:00:00Z',
  );
  p = issueProof(
    s,
    { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' },
    'wo-demo-2',
    'start',
    'mana',
    'demo',
  );
  act(
    'execution.start',
    { woId: 'wo-demo-2', machine: 'LASER-02', proof: p },
    '2026-09-22T00:00:00Z',
  );
  expect(s.executions.map((e) => [e.workerId, e.machine])).toEqual([
    ['somchai', 'LASER-01'],
    ['mana', 'LASER-02'],
  ]);
  p = issueProof(
    s,
    { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' },
    'wo-demo-1',
    'complete',
    'somchai',
    '123456',
  );
  act(
    'execution.complete',
    { woId: 'wo-demo-1', good: 8, reject: 0, scrap: 0, proof: p },
    '2026-09-22T00:02:00Z',
  );
  expect(s.workOrders[0].stage).toBe('bend');
  expect(s.workOrders[1].status).toBe('Running');
  expect(s.executions[1].segmentStartedAt).toBe('2026-09-22T00:00:00Z');
});
it('AC11 rejects stale simultaneous Start and a second machine on same WO', () => {
  let s = createSeed();
  s.workOrders[0].issued['mat-steel'] = 16;
  const actor = { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' },
    p = issueProof(s, actor, 'wo-demo-1', 'start', 'somchai', 'demo');
  const cmd = {
    type: 'execution.start',
    data: { woId: 'wo-demo-1', machine: 'LASER-01', proof: p },
    expectedVersion: 0,
    key: 'a',
  };
  const next = applyCommand(s, cmd, actor);
  expect(() =>
    applyCommand(
      next.state,
      { ...cmd, key: 'b', data: { ...cmd.data, machine: 'LASER-02' } },
      actor,
    ),
  ).toThrow('ข้อมูลเปลี่ยน');
  expect(next.state.executions).toHaveLength(1);
});
it('AC09 wrong PIN cannot complete and lock does not change WO status', () => {
  let s = createSeed();
  s.workOrders[0].status = 'Running';
  s.executions.push({
    id: 'e',
    woId: 'wo-demo-1',
    stage: 'laser',
    workerId: 'somchai',
    stationId: 'station-laser',
    machine: 'LASER-01',
    status: 'Running',
    startedAt: '2026-09-22T00:00:00Z',
    segmentStartedAt: '2026-09-22T00:00:00Z',
    elapsedMs: 0,
    completedAt: null,
    good: 0,
    reject: 0,
    scrap: 0,
    reason: '',
  });
  const a = { userId: 'station-laser', stationId: 'station-laser', deviceId: 'a' };
  expect(() => issueProof(s, a, 'wo-demo-1', 'complete', 'somchai', '000000')).toThrow('PIN');
  for (let i = 0; i < 5; i++)
    s = applyCommand(
      s,
      {
        type: 'auth.pinFailure',
        data: { id: 'somchai' },
        key: String(i),
        expectedVersion: s.version,
      },
      a,
    ).state;
  expect(s.users.find((u) => u.id === 'somchai')?.locked).toBe(true);
  expect(s.workOrders[0].status).toBe('Running');
});
