import { expect, it } from 'vitest';
import { materialAmount } from '../src/app/shared/utils/material-cost';
import { markedUpPrice, pricingPreview } from '../src/app/features/sales/models/pricing';

it('costs BOM base quantities including scrap and preserves unknown versus actual zero cost', () => {
  expect(materialAmount(3.5, 5, 125.123456)).toBe(459.828701);
  expect(materialAmount(2, 10, 0)).toBe(0);
  expect(materialAmount(2, 10, null)).toBeNull();
  expect(materialAmount(2, 101, 30)).toBeNull();
  expect(materialAmount(NaN, 0, 30)).toBeNull();
});
it('uses Sales COGS rather than engineering reference costs for selling price and margin', () => {
  const salesCogs = 25;
  expect(markedUpPrice(salesCogs, 30)).toBe(32.5);
  expect(pricingPreview(2, 32.5, 0, salesCogs).profit).toBe(15);
});
