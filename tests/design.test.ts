import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('Design requires drawing and BOM, freezes approved revision and calculates COGS', () => {
  let s = createSeed();
  const act = (type: string, data: unknown) => {
    const r = applyCommand(
      s,
      { type, data, expectedVersion: s.version, key: crypto.randomUUID() },
      { userId: 'admin', deviceId: 'a' },
    );
    s = r.state;
    return r.result;
  };
  const id = act('design.new', { name: 'New table' });
  const data = {
    id,
    spec: 'SUS304',
    drawingNumber: 'DWG-01',
    drawings: [],
    bom: [{ materialId: 'mat-steel', quantity: 2, scrapPercent: 0, note: '' }],
    labor: 2000,
    overhead: 1000,
    waste: 1000,
    approve: true,
  };
  expect(() => act('design.save', data)).toThrow('Drawing');
  act('asset.add', { id: 'a', name: 'drawing.png', mime: 'image/png', blob: new Blob(['test']) });
  act('design.save', { ...data, drawings: ['a'] });
  const rev = s.revisions.find((r) => r.id === s.designs[0].revisionId)!;
  expect(rev.cost).toBe(24000);
  expect(rev.status).toBe('Approved');
  expect(() => act('design.save', data)).toThrow('แก้ทับไม่ได้');
});
