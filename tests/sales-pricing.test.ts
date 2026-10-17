import { expect, it } from 'vitest';
import { markedUpPrice, pricingPreview } from '../src/app/features/sales/models/pricing';

it('uses Design costs for markup and computes profit after discount, excluding VAT', () => {
  expect(markedUpPrice(24000, 33.33333333)).toBe(32000);
  expect(pricingPreview(12, 32000, 5, 24000)).toEqual({
    net: 364800, profit: 76800, unitProfit: 6400, margin: 21.05,
  });
});
it('rounds money with decimal arithmetic and does not invent a margin for zero revenue', () => {
  expect(markedUpPrice(0.1, 10)).toBe(0.11);
  expect(pricingPreview(1, 0, 0, 0)?.margin).toBeNull();
  expect(pricingPreview(2, 10, 0, 15)?.profit).toBe(-10);
  expect(pricingPreview(1, NaN, 0, 10)).toBeNull();
});
