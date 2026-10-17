import Decimal from 'decimal.js';

export function markedUpPrice(cost: number, markup: number): number {
  return new Decimal(cost).mul(new Decimal(markup).div(100).plus(1)).toDecimalPlaces(2).toNumber();
}

export function pricingPreview(quantity: number, price: number, discount: number, cost: number) {
  if (![quantity, price, discount, cost].every(Number.isFinite)) return null;
  const gross = new Decimal(quantity).mul(price).toDecimalPlaces(2);
  const net = gross.minus(gross.mul(discount).div(100)).toDecimalPlaces(2);
  const totalCost = new Decimal(cost).mul(quantity).toDecimalPlaces(2);
  const profit = net.minus(totalCost).toDecimalPlaces(2);
  return { net: net.toNumber(), profit: profit.toNumber(),
    unitProfit: quantity > 0 ? profit.div(quantity).toDecimalPlaces(2).toNumber() : null,
    margin: net.gt(0) ? profit.div(net).mul(100).toDecimalPlaces(2).toNumber() : null };
}
