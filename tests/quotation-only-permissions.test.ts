import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/app/core/auth/auth.service';

const has = (permissions: string[], permission: string) =>
  AuthService.prototype.has.call({ user: () => ({ permissions }) } as unknown as AuthService, permission);

describe('Quotation-only account capabilities', () => {
  it('keeps quotation editing/sending while hiding PO acceptance and SO commands', () => {
    const permissions = ['sales.manage', 'business.view', 'master.view', 'file.manage', 'document.manage'];
    expect(has(permissions, 'quotation.manage')).toBe(true);
    expect(has(permissions, 'quotation.send')).toBe(true);
    expect(has(permissions, 'quotation.accept')).toBe(false);
    expect(has(permissions, 'sales_order.manage')).toBe(false);
    expect(has(permissions, 'customer.manage')).toBe(false);
    expect(has(permissions, 'finance.draft')).toBe(false);
  });
  it('requires both quotation and order authority for PO/SO actions', () => {
    for (const permission of ['quotation.accept', 'sales_order.manage']) {
      expect(has(['sales.manage', 'sales.order_manage'], permission)).toBe(true);
      expect(has(['sales.order_manage'], permission)).toBe(false);
      expect(has([], permission)).toBe(false);
    }
  });
});
