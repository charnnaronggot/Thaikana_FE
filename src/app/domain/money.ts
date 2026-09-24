import Decimal from 'decimal.js';
import { QuoteLine } from './models';
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export const round = (v: Decimal.Value) => new Decimal(v).toDecimalPlaces(2).toNumber();
export function priceLine(
  line: Pick<QuoteLine, 'quantity' | 'unitPrice' | 'discount'>,
  cost: number | null = null,
) {
  const subtotal = round(new Decimal(line.quantity).mul(line.unitPrice ?? 0));
  const discount = round(new Decimal(subtotal).mul(line.discount).div(100));
  const net = round(new Decimal(subtotal).minus(discount));
  const cogs = cost === null ? null : round(new Decimal(line.quantity).mul(cost));
  const profit = cogs === null ? null : round(new Decimal(net).minus(cogs));
  return {
    subtotal,
    discount,
    net,
    cogs,
    profit,
    margin: profit === null || net === 0 ? null : round(new Decimal(profit).div(net).mul(100)),
    markup: profit === null || !cogs ? null : round(new Decimal(profit).div(cogs).mul(100)),
  };
}
export function quoteTotals(
  lines: Pick<QuoteLine, 'quantity' | 'unitPrice' | 'discount'>[],
  vatRate: number,
) {
  const net = round(lines.reduce((s, l) => s.plus(priceLine(l).net), new Decimal(0)));
  const vat = round(new Decimal(net).mul(vatRate).div(100));
  return { net, vat, total: round(new Decimal(net).plus(vat)) };
}
