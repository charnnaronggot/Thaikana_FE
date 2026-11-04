import { describe, expect, it } from 'vitest';
import { salesProblemMessages } from '../src/app/core/services/api/sales-problem-messages';
import { canOpenModule, workspaceModules } from '../src/app/core/auth/workspace-policy';
import type { UserProfile } from '../src/app/core/models/api.models';
import { hitLink, searchSummary, statusLabel, validSearch } from '../src/app/features/search/services/search-view';
import { auditField, auditValue, maskedCount } from '../src/app/features/reports/services/audit-view';
import { customerAddress, inactiveCustomerNotice, mapUrl } from '../src/app/features/customers/models/customer-view';
import { settingsChanges } from '../src/app/features/settings/settings-preview';
import type { Customer } from '../src/app/features/customers/models/customer.models';
import type { CompanySettingsSnapshot } from '../src/app/features/settings/settings.models';

const user = (permissions: string[], accountType = 'Personal') => ({ id: 'u', username: 'u', displayName: 'u', roles: [], permissions, permissionScopes: [], accountType, mustChangePassword: false }) as unknown as UserProfile;
const group = (kind: string, total: number) => ({ kind, label: kind, total, items: [] });

describe('F15 global search page', () => {
  it('is a separate page opened by any list grant, never by dashboard-only Viewer or a Station account', () => {
    expect(workspaceModules.at(-1)?.key).toBe('search');
    expect(canOpenModule(user(['business.view']), 'search')).toBe(true);
    expect(canOpenModule(user(['finance.view']), 'search')).toBe(true);
    expect(canOpenModule(user(['dashboard.view']), 'search')).toBe(false);
    expect(canOpenModule(user(['master.view', 'work_order.view'], 'Station'), 'search')).toBe(false);
  });
  it('requires 2–100 characters', () => {
    expect(validSearch(' a ')).toBe(false);
    expect(validSearch('SO')).toBe(true);
    expect(validSearch('x'.repeat(101))).toBe(false);
  });
  it('distinguishes no permitted module from no match (a missing group is not a zero count)', () => {
    const at = '2026-11-04T00:00:00Z';
    expect(searchSummary(null)).toBe('none');
    expect(searchSummary({ query: 'SO', generatedAt: at, groups: [] })).toBe('no-modules');
    expect(searchSummary({ query: 'SO', generatedAt: at, groups: [group('quotations', 0)] })).toBe('no-match');
    expect(searchSummary({ query: 'SO', generatedAt: at, groups: [group('quotations', 0), group('invoices', 2)] })).toBe('found');
  });
  it('only links internal server routes and keeps their query parameters', () => {
    expect(hitLink('/sales?salesOrderId=abc')).toEqual({ path: '/sales', queryParams: { salesOrderId: 'abc' } });
    expect(hitLink('/finance/invoices/1')).toEqual({ path: '/finance/invoices/1', queryParams: {} });
    expect(hitLink(null)).toBeNull();
    expect(hitLink('https://evil.example/x')).toBeNull();
    expect(hitLink('//evil.example/x')).toBeNull();
    expect(statusLabel('INACTIVE')).toBe('ปิดใช้งาน');
    expect(statusLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE');
  });
  it('explains that a confirmed order of an inactive customer still finishes', () => {
    expect(salesProblemMessages['customer_inactive']).toContain('ใบแจ้งหนี้เดิม');
  });
});

describe('F15 audit detail', () => {
  it('explains server-masked values instead of showing them', () => {
    expect(auditValue({ field: 'salesUnitCost', before: null, after: null, masked: 'cost' }, 'after')).toContain('ต้นทุน');
    expect(auditValue({ field: 'unitPrice', before: null, after: null, masked: 'finance' }, 'before')).toContain('การเงิน');
    expect(auditValue({ field: 'pin', before: null, after: null, masked: 'secret' }, 'after')).toContain('ยืนยันตัวตน');
    expect(auditValue({ field: 'name', before: 'A', after: 'B', masked: null }, 'before')).toBe('A');
    expect(auditValue({ field: 'name', before: null, after: '', masked: null }, 'after')).toBe('—');
    expect(maskedCount([{ field: 'a', before: '1', after: '2', masked: null }, { field: 'b', before: null, after: null, masked: 'cost' }])).toBe(1);
    expect(auditField('lines[0].unitPrice')).toBe('lines 1 · unitPrice');
  });
});

describe('F04 customer and settings', () => {
  const customer = (addresses: object[]) => ({ id: 'c', code: 'C', name: 'N', version: '1', addresses, quotations: [], salesOrders: [] }) as unknown as Customer;
  it('opens a map only for confirmed coordinates; the text address stands alone', () => {
    const located = customer([{ addressType: 'Billing', addressText: 'Bangkok', latitude: 13.75, longitude: 100.5 }, { addressType: 'Shipping', addressText: 'Rayong' }]);
    expect(mapUrl(customerAddress(located, 'Billing'))).toBe('https://www.google.com/maps/search/?api=1&query=13.75%2C100.5');
    expect(mapUrl(customerAddress(located, 'Shipping'))).toBeNull();
    expect(mapUrl({ latitude: 95, longitude: 10 })).toBeNull();
    expect(inactiveCustomerNotice).toContain('ใบสั่งขายที่ยืนยันแล้ว');
  });
  it('previews only the settings that change, including VAT and the logo', () => {
    const current = { revisionId: 'r', revision: 3, legalName: 'Thaikana', address: 'BKK', taxId: null, logoFileId: 'logo-1', vatRate: 7, currency: 'THB', paymentTerms: 'Net 30', bankName: null, bankAccountName: null, bankAccountNumber: null, effectiveAt: '', updatedByUserId: '', defaultOverheadPercent: 10 } as CompanySettingsSnapshot;
    const same = { legalName: 'Thaikana', address: 'BKK', taxId: '', vatRate: 7, currency: 'thb', paymentTerms: 'Net 30', defaultOverheadPercent: 10, bankName: '', bankAccountName: null, bankAccountNumber: null, logoFileId: 'logo-1' };
    expect(settingsChanges(current, same)).toEqual([]);
    expect(settingsChanges(current, { ...same, vatRate: 8, logoFileId: null })).toEqual([
      { label: 'VAT (%)', before: '7', after: '8' },
      { label: 'โลโก้', before: 'โลโก้เดิม', after: 'นำโลโก้ออก' },
    ]);
    expect(settingsChanges(null, same).map((x) => x.label)).toContain('ชื่อบริษัท');
  });
});
