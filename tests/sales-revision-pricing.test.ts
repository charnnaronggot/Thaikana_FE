import { describe, expect, it } from 'vitest';
import {
  CostSuggestion,
  lineNet,
  lineStatus,
  lineStatusLabels,
  overheadFromPercent,
  prefillCosts,
  pricingPreview,
  quotationSummary,
} from '../src/app/features/sales/models/pricing';
import { salesProblemMessages } from '../src/app/core/services/api/sales-problem-messages';

const suggestion = (patch: Partial<CostSuggestion>): CostSuggestion => ({
  productRevisionId: 'rev-1', basis: 'PRODUCT_REVISION', laborCost: 10, overheadCost: 3.75,
  overheadMethod: 'PERCENT', overheadRate: 12.5,
  source: { quotationId: 'q', quotationNo: 'Q-1', revision: 3, enteredAt: '2026-11-03T03:00:00Z', productRevisionId: 'rev-1' },
  ...patch,
});

describe('Overhead % of Material + Labor', () => {
  it('derives THB per unit at 6 dp half away from zero, like the server', () => {
    expect(overheadFromPercent(20, 10, 12.5)).toBe(3.75);
    expect(overheadFromPercent(1, 0, 33.3333335)).toBe(0.333333);
    expect(overheadFromPercent(0.0000005, 0, 100)).toBe(0.000001);
    expect(overheadFromPercent(20, 0, 0)).toBe(0);
  });
  it('does not invent an amount for missing or negative inputs', () => {
    expect(overheadFromPercent(20, NaN, 10)).toBeNull();
    expect(overheadFromPercent(20, -1, 10)).toBeNull();
    expect(overheadFromPercent(20, 1, -5)).toBeNull();
  });
});

describe('Labor/Overhead prefill', () => {
  it('keeps a percent source as method + rate so the amount follows this line material', () => {
    expect(prefillCosts(suggestion({}), 15)).toEqual({ salesLaborCost: 10, salesOverheadMethod: 'PERCENT', salesOverheadRate: 12.5, salesOverheadCost: null });
  });
  it('copies a THB source as an amount (also legacy rows without a method)', () => {
    expect(prefillCosts(suggestion({ overheadMethod: 'AMOUNT', overheadRate: null, overheadCost: 7 }), 15))
      .toEqual({ salesLaborCost: 10, salesOverheadMethod: 'AMOUNT', salesOverheadRate: null, salesOverheadCost: 7 });
    expect(prefillCosts(suggestion({ basis: 'ITEM', overheadMethod: null, overheadRate: null, overheadCost: 2 }), null)?.salesOverheadCost).toBe(2);
  });
  it('falls back to the configured default % and otherwise leaves Sales to enter values', () => {
    expect(prefillCosts(suggestion({ basis: null, laborCost: null, source: null }), 12)).toEqual({ salesLaborCost: null, salesOverheadMethod: 'PERCENT', salesOverheadRate: 12, salesOverheadCost: null });
    expect(prefillCosts(undefined, 0)?.salesOverheadRate).toBe(0);
    expect(prefillCosts(undefined, null)).toBeNull();
  });
});

describe('Quotation money rule shared with the server', () => {
  it('rounds the line net to 2 dp after a 6 dp discount', () => {
    expect(lineNet(3, 33.333333, 12.5).toNumber()).toBe(87.5);
    expect(lineNet(1, 10.005, 0).toNumber()).toBe(10.01);
    expect(lineNet(1, 1, 66.666666).toNumber()).toBe(0.33);
  });
  it('flags a net price below COGS as a warning only', () => {
    expect(pricingPreview(2, 26, 5, 20)).toMatchObject({ net: 49.4, profit: 9.4, margin: 19.03, belowCost: false });
    expect(pricingPreview(2, 21, 10, 20)).toMatchObject({ net: 37.8, profit: -2.2, belowCost: true });
  });
});

describe('Quotation-level summary', () => {
  it('totals revenue and COGS of ready lines, the overall margin and lines not ready', () => {
    const summary = quotationSummary([
      { quantity: 2, unitPrice: 100, discountPercent: 0, cogs: 33.75, ready: true },
      { quantity: 3, unitPrice: 33.333333, discountPercent: 12.5, cogs: 20, ready: true },
      { quantity: 1, unitPrice: 0, discountPercent: 0, cogs: null, ready: false },
    ]);
    expect(summary).toEqual({ revenue: 287.5, cogs: 127.5, profit: 160, margin: 55.65, notReady: 1 });
  });
  it('shows N/A margin and a negative profit without revenue', () => {
    expect(quotationSummary([{ quantity: 1, unitPrice: 0, discountPercent: 0, cogs: 5, ready: false }]))
      .toEqual({ revenue: 0, cogs: 0, profit: 0, margin: null, notReady: 1 });
    expect(quotationSummary([{ quantity: 1, unitPrice: 10, discountPercent: 0, cogs: 12, ready: true }]).margin).toBe(-20);
  });
});

describe('Per-line status chips', () => {
  it('maps Design state and the saved price to the four Sales chips', () => {
    expect(lineStatusLabels[lineStatus('NotSent', 0, null)]).toBe('รอส่ง Design');
    for (const state of ['Waiting', 'InProgress', 'CostMissing']) expect(lineStatusLabels[lineStatus(state, 0, null)]).toBe('รอ Design');
    expect(lineStatusLabels[lineStatus('Ready', 0, null)]).toBe('พร้อมตั้งราคา');
    expect(lineStatusLabels[lineStatus('Ready', 100, null)]).toBe('พร้อมตั้งราคา');
    expect(lineStatusLabels[lineStatus('Ready', 100, 33.75)]).toBe('ตั้งราคาแล้ว');
  });
  it('has Thai guidance for the new Sales rule codes', () => {
    for (const code of ['price_on_create', 'invalid_quantity_precision', 'invalid_valid_until', 'no_made_by_order_lines', 'invalid_sales_cogs'])
      expect(salesProblemMessages[code], code).toMatch(/[฀-๿]/);
    expect(salesProblemMessages['quote_expired']).toContain('Revision ใหม่');
  });
});
