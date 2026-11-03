import { describe, expect, it } from 'vitest';
import { businessDateInput } from '../src/app/shared/utils/business-date';

describe('Thai quotation date', () => {
  it('keeps the previous date until midnight Bangkok', () => {
    expect(businessDateInput(new Date('2026-10-25T16:59:59.999Z'))).toBe('2026-10-25');
  });
  it('uses the new Thai date while UTC is still the previous day', () => {
    expect(businessDateInput(new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-26');
  });
  it('rolls the calendar year at midnight Bangkok', () => {
    expect(businessDateInput(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });
});
