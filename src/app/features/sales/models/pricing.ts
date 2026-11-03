import Decimal from 'decimal.js';

export function markedUpPrice(cost: number, markup: number): number {
  return new Decimal(cost).mul(new Decimal(markup).div(100).plus(1)).toDecimalPlaces(2).toNumber();
}

// Same rule as the server (QuotationAmounts, 3 Nov 2026): the discount amount is kept at 6 dp, each line net
// is rounded to 2 dp half away from zero, VAT is computed per rate on the rounded nets. decimal.js ROUND_HALF_UP
// rounds ties away from zero, matching PostgreSQL round() and MidpointRounding.AwayFromZero.
export function lineNet(quantity: number, price: number, discountPercent: number) {
  const gross = new Decimal(quantity).mul(price);
  return gross.minus(gross.mul(discountPercent).div(100).toDecimalPlaces(6)).toDecimalPlaces(2);
}

export function pricingPreview(quantity: number, price: number, discount: number, cost: number) {
  if (![quantity, price, discount, cost].every(Number.isFinite)) return null;
  const net = lineNet(quantity, price, discount);
  const totalCost = new Decimal(cost).mul(quantity).toDecimalPlaces(2);
  const profit = net.minus(totalCost).toDecimalPlaces(2);
  return { net: net.toNumber(), profit: profit.toNumber(),
    unitProfit: quantity > 0 ? profit.div(quantity).toDecimalPlaces(2).toNumber() : null,
    margin: net.gt(0) ? profit.div(net).mul(100).toDecimalPlaces(2).toNumber() : null,
    belowCost: net.lt(totalCost) };
}

// Overhead as % of (Material + Labor) per unit; the server derives the same THB amount (6 dp, half away from zero).
export function overheadFromPercent(material: number, labor: number, rate: number): number | null {
  if (![material, labor, rate].every(Number.isFinite) || labor < 0 || rate < 0) return null;
  return new Decimal(material).plus(labor).mul(rate).div(100).toDecimalPlaces(6).toNumber();
}

export interface SummaryLine { quantity: number; unitPrice: number; discountPercent: number; cogs: number | null; ready: boolean }
// Quotation-level internal summary: revenue before VAT, total COGS, overall margin and lines not ready to issue.
export function quotationSummary(lines: SummaryLine[]) {
  let revenue = new Decimal(0), cogs = new Decimal(0);
  for (const line of lines.filter((x) => x.ready)) {
    revenue = revenue.plus(lineNet(line.quantity, line.unitPrice, line.discountPercent));
    cogs = cogs.plus(new Decimal(line.cogs ?? 0).mul(line.quantity).toDecimalPlaces(2));
  }
  const profit = revenue.minus(cogs);
  return { revenue: revenue.toNumber(), cogs: cogs.toNumber(), profit: profit.toNumber(),
    margin: revenue.gt(0) ? profit.div(revenue).mul(100).toDecimalPlaces(2).toNumber() : null,
    notReady: lines.filter((x) => !x.ready).length };
}

export type LineStatus = 'NotSent' | 'WaitingDesign' | 'ReadyToPrice' | 'Priced';
export const lineStatusLabels: Record<LineStatus, string> = {
  NotSent: 'รอส่ง Design', WaitingDesign: 'รอ Design', ReadyToPrice: 'พร้อมตั้งราคา', Priced: 'ตั้งราคาแล้ว',
};
// Chip per line: Design state from the server plus whether the latest saved revision already has a price and COGS.
export function lineStatus(designState: string | undefined, savedPrice: number | null | undefined, savedCogs: number | null | undefined): LineStatus {
  if (designState === 'NotSent') return 'NotSent';
  if (designState !== 'Ready') return 'WaitingDesign';
  return (savedPrice ?? 0) > 0 && savedCogs != null ? 'Priced' : 'ReadyToPrice';
}

export interface CostSuggestion {
  productRevisionId: string;
  basis: 'PRODUCT_REVISION' | 'ITEM' | null;
  laborCost: number | null;
  overheadCost: number | null;
  overheadMethod: 'AMOUNT' | 'PERCENT' | null;
  overheadRate: number | null;
  source: { quotationId: string; quotationNo: string; revision: number; enteredAt: string; productRevisionId: string } | null;
}
export interface CostInputs { salesLaborCost?: number | null; salesOverheadCost?: number | null; salesOverheadMethod?: 'AMOUNT' | 'PERCENT' | null; salesOverheadRate?: number | null }
// Prefill (editable): the latest visible priced line of the same revision/item, else the configured default overhead %.
export function prefillCosts(suggestion: CostSuggestion | undefined, defaultOverheadPercent: number | null | undefined): CostInputs | null {
  if (suggestion?.basis && suggestion.laborCost != null)
    return suggestion.overheadMethod === 'PERCENT' && suggestion.overheadRate != null
      ? { salesLaborCost: suggestion.laborCost, salesOverheadMethod: 'PERCENT', salesOverheadRate: suggestion.overheadRate, salesOverheadCost: null }
      : { salesLaborCost: suggestion.laborCost, salesOverheadMethod: 'AMOUNT', salesOverheadRate: null, salesOverheadCost: suggestion.overheadCost };
  if (defaultOverheadPercent != null)
    return { salesLaborCost: null, salesOverheadMethod: 'PERCENT', salesOverheadRate: defaultOverheadPercent, salesOverheadCost: null };
  return null;
}
