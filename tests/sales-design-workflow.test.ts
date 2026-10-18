import { it, expect } from 'vitest';
import { lineProgress, suggestedProduct } from '../src/app/features/sales/models/workflow';
import { designReadiness } from '../src/app/features/design/models/readiness';
import type { DesignDetail } from '../src/app/features/design/models/design.models';
import type { ProductRevision } from '../src/app/features/sales/models/sales-api.models';

const product = (id: string, designId: string) =>
  ({ id, designId, status: 'Approved', cost: { unitCost: 100 } }) as ProductRevision;
it('selects the one costed revision for the current Sales requirement, without crossing into another line', () => {
  expect(
    suggestedProduct({ requiredDesignId: 'current' }, [
      product('wrong', 'old'),
      product('correct', 'current'),
    ]),
  ).toBe('correct');
  expect(
    suggestedProduct({ requiredDesignId: 'current' }, [
      product('one', 'current'),
      product('two', 'current'),
    ]),
  ).toBeUndefined();
  expect(
    suggestedProduct({ productRevisionId: 'kept' }, [
      product('kept', 'old'),
      product('new', 'old'),
    ]),
  ).toBe('kept');
  expect(
    suggestedProduct({ requiredDesignId: 'current' }, [
      { ...product('one', 'current'), cost: null },
    ]),
  ).toBeUndefined();
});
it('separates not-sent, queued, active Design and ready-for-Sales handoffs', () => {
  expect(lineProgress({ designState: 'NotSent' }).owner).toContain('Sales');
  expect(lineProgress({ designState: 'Waiting' }).label).toContain('รอเริ่มงาน');
  expect(lineProgress({ designState: 'InProgress' }).owner).toContain('Design');
  expect(lineProgress({ designState: 'Ready' }).owner).toContain('ตั้งราคา');
});
const design = () =>
  ({
    item: { id: 'finished' },
    outputBaseQty: 1,
    specification: { checklist: [{ code: 'DIM', required: true }] },
    drawings: [],
    components: [],
    costs: [],
  }) as unknown as DesignDetail;
it('guides Design to missing drawing, material and cost before returning work to Sales', () => {
  const d = design();
  expect(
    designReadiness(d)
      .filter((x) => !x.ready)
      .map((x) => x.tab),
  ).toEqual(['Drawing', 'BOM', 'BOM']);
  d.drawings = [{ fileId: 'file', drawingNo: 'DWG-01', note: null }];
  d.components = [
    { itemId: 'material', quantity: 2, revisionId: null, scrapAllowancePct: 0, note: null },
  ];
  d.costs = [{ category: 'MATERIAL', quantity: 2, unitCost: 10, sourceNote: 'Supplier quotation' }];
  expect(designReadiness(d).find((x) => x.label === 'ต้นทุนวัตถุดิบ')?.ready).toBe(false);
  d.components[0].unitCost = 10;
  d.components[0].costSource = 'Supplier quotation';
  expect(designReadiness(d).every((x) => x.ready)).toBe(true);
  d.components[0].costSource = '';
  expect(designReadiness(d).find((x) => x.label === 'ต้นทุนวัตถุดิบ')?.ready).toBe(false);
  d.components[0].itemId = 'finished';
  expect(designReadiness(d).find((x) => x.tab === 'BOM')?.ready).toBe(false);
  d.specification.checklist.push({ code: 'DIM', required: true });
  expect(designReadiness(d)[0].ready).toBe(false);
});
