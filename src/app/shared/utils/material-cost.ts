import Decimal from 'decimal.js';

export function materialAmount(
  quantity: number,
  scrapPercent: number,
  unitCost: number | null | undefined,
): number | null {
  if (
    unitCost == null ||
    ![quantity, scrapPercent, unitCost].every(Number.isFinite) ||
    quantity <= 0 ||
    scrapPercent < 0 ||
    scrapPercent > 100 ||
    unitCost < 0
  )
    return null;
  return new Decimal(quantity)
    .mul(new Decimal(scrapPercent).div(100).plus(1))
    .mul(unitCost)
    .toDecimalPlaces(6)
    .toNumber();
}
