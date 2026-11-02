import { describe, expect, it } from 'vitest';
import { salesProblemMessages } from '../src/app/core/services/api/sales-problem-messages';
import { quoteExpired } from '../src/app/features/sales/models/workflow';

describe('Sales quotation validity', () => {
  it('is still valid on the last Bangkok business day and expired the day after', () => {
    expect(quoteExpired('2026-11-02', '2026-11-02')).toBe(false);
    expect(quoteExpired('2026-11-01', '2026-11-02')).toBe(true);
    expect(quoteExpired('2026-11-01T00:00:00', '2026-11-02')).toBe(true);
  });
  it('treats a missing validity date as not expired (server remains the authority)', () => {
    expect(quoteExpired(undefined, '2026-11-02')).toBe(false);
    expect(quoteExpired(null, '2026-11-02')).toBe(false);
  });
});

describe('Sales error codes', () => {
  it('has Thai guidance for every Sales/customer rule the API can return', () => {
    for (const code of [
      'customer_inactive', 'customer_required', 'customer_code_exists', 'quote_expired', 'quote_not_sent',
      'quote_not_issued', 'pdf_not_ready', 'already_accepted', 'order_exists', 'quotation_closed',
      'design_not_ready', 'invalid_price', 'price_only_revision_mismatch',
    ]) {
      expect(salesProblemMessages[code], code).toMatch(/[฀-๿]/);
    }
    expect(salesProblemMessages['customer_inactive']).toContain('ปิดใช้งาน');
    expect(salesProblemMessages['quote_expired']).toContain('หมดอายุ');
  });
  it('does not override the shared stale-version reload message', () => {
    expect(salesProblemMessages['stale_version']).toBeUndefined();
  });
});
