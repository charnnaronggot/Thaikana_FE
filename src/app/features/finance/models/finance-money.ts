import Decimal from 'decimal.js';
export function moneySum(values: readonly number[]) {
  return values
    .reduce((sum, value) => sum.plus(Number.isFinite(value) ? String(value) : 0), new Decimal(0))
    .toNumber();
}
export function moneyRemaining(amount: number, allocated: number) {
  return Decimal.max(0, new Decimal(Number.isFinite(amount) ? String(amount) : 0).minus(Number.isFinite(allocated) ? String(allocated) : 0)).toNumber();
}
export function validMoney(value: number) {
  return Number.isFinite(value) && value > 0 && new Decimal(String(value)).decimalPlaces() <= 2;
}
