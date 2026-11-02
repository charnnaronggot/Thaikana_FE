import { describe, expect, it } from 'vitest';
import { StockForm, stockBody, stockFormErrors } from '../src/app/features/planning/models/stock-work-order';

const option = { productRevisionId: 'rev-1', version: 3, decimalPlaces: 0, costReady: true };
const form = (patch: Partial<StockForm> = {}): StockForm => ({ plantId: 'plant-1', productRevisionId: 'rev-1', quantity: 5, plannedStart: '2026-11-20', dueDate: '2026-12-01', priority: 1, reason: ' เติมสต็อก ', ...patch });

describe('F07 make-to-stock Draft WO form', () => {
  it('builds the typed body with the revision version as expectedVersion and a trimmed reason', () => {
    expect(stockFormErrors(form(), option)).toEqual({});
    expect(stockBody(form(), option)).toEqual({ expectedVersion: 3, productRevisionId: 'rev-1', plantId: 'plant-1', quantity: 5, plannedStart: '2026-11-20', dueDate: '2026-12-01', priority: 1, reason: 'เติมสต็อก' });
  });
  it('blocks a revision whose cost is not ready (no free material)', () => {
    expect(stockFormErrors(form(), { ...option, costReady: false })['revision']).toContain('มากกว่า 0');
    expect(stockFormErrors(form(), undefined)['revision']).toBeTruthy();
  });
  it('validates quantity against the unit precision, dates and reason', () => {
    expect(stockFormErrors(form({ quantity: 1.5 }), option)['quantity']).toBe('หน่วยนี้ใช้จำนวนเต็มเท่านั้น');
    expect(stockFormErrors(form({ quantity: 1.25 }), { ...option, decimalPlaces: 2 })).toEqual({});
    expect(stockFormErrors(form({ quantity: 0 }), option)['quantity']).toBeTruthy();
    expect(stockFormErrors(form({ plannedStart: '2026-12-02' }), option)['dates']).toContain('ไม่เกิน');
    expect(stockFormErrors(form({ dueDate: '' }), option)['dates']).toBeTruthy();
    expect(stockFormErrors(form({ reason: '   ' }), option)['reason']).toBeTruthy();
    expect(stockFormErrors(form({ plantId: '' }), option)['plant']).toBeTruthy();
  });
});
