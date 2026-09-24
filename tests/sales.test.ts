import { it, expect } from 'vitest';
import { createSeed } from '../src/app/domain/seed';
import { applyCommand } from '../src/app/data-access/demo-repository';
it('AC01 AC02 multi-line quotation keeps product and PDF snapshots through price revision', () => {
  let s = createSeed();
  const act = (type: string, data: unknown) => {
    const r = applyCommand(
      s,
      { type, data, expectedVersion: s.version, key: crypto.randomUUID() },
      { userId: 'admin', deviceId: 't' },
    );
    s = r.state;
    return r.result as string;
  };
  const id = act('quote.save', {
    customer: 'North Studio',
    dueDate: '2026-10-15',
    validUntil: '2026-10-01',
  });
  for (let i = 0; i < 2; i++)
    act('quote.line', {
      quoteId: id,
      line: {
        id: '',
        kind: 'Existing',
        productRevisionId: 'rev-cabinet-1',
        name: 'Cabinet ' + i,
        category: 'Steel',
        quantity: 12,
        unit: 'piece',
        spec: 'test',
        finish: 'HL',
        requirement: '',
        unitPrice: 32000,
        discount: 5,
      },
    });
  act('quote.design', { id });
  act('quote.issue', { id, pdf: new Blob(['%PDF-demo']) });
  const next = act('quote.revise', { id, kind: 'price', lineIds: [], reason: '' });
  expect(s.quotations.find((q) => q.id === next)?.revision).toBe(2);
  expect(
    s.quotations
      .find((q) => q.id === next)
      ?.lines.every((l) => l.productRevisionId === 'rev-cabinet-1'),
  ).toBe(true);
  expect(s.documents[0].referenceId).toBe(id);
  expect(s.quotations.find((q) => q.id === id)?.superseded).toBe(true);
  expect(s.orders).toHaveLength(0);
});
it('requirements can have no price and cannot issue without Design', () => {
  let s = createSeed();
  let r = applyCommand(
    s,
    {
      type: 'quote.save',
      data: { customer: 'test', dueDate: '2026-10-01', validUntil: '2026-10-01' },
      expectedVersion: 0,
      key: '1',
    },
    { userId: 'sales', deviceId: 'a' },
  );
  s = r.state;
  expect(() =>
    applyCommand(
      s,
      {
        type: 'quote.issue',
        data: { id: r.result, pdf: new Blob(['x']) },
        expectedVersion: s.version,
        key: '2',
      },
      { userId: 'sales', deviceId: 'a' },
    ),
  ).toThrow('รอ Design');
});
