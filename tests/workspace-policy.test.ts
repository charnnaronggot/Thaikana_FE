import { describe, it, expect } from 'vitest';
import { homeFor, canOpenModule, safeDestination } from '../src/app/core/auth/workspace-policy';
import { UserProfile } from '../src/app/core/models/api.models';
const profile = (role: string, permissions: string[], station = false) =>
  ({
    roles: [role],
    permissions,
    accountType: station ? 'Station' : 'Personal',
    mustChangePassword: false,
  }) as UserProfile;
describe('Native role workspace routing', () => {
  const cases: [string, string[], string, boolean?][] = [
    ['SystemAdmin', ['dashboard.view', 'sales.manage', 'work_order.view'], '/overview'],
    ['Sales', ['business.view', 'sales.manage'], '/sales'],
    ['Design', ['business.view', 'design.manage'], '/design'],
    ['Planning', ['business.view', 'planning.decide'], '/planning'],
    ['Inventory', ['business.view', 'inventory.manage'], '/inventory'],
    ['ProductionManager', ['work_order.view', 'dashboard.view'], '/production'],
    ['Supervisor', ['work_order.view', 'production.execute'], '/production'],
    ['Operator', ['work_order.view', 'production.execute'], '/station'],
    ['Station', ['master.view', 'work_order.view'], '/station', true],
    ['QC', ['qc.inspect', 'dashboard.view'], '/qc'],
    ['Delivery', ['delivery.confirm', 'business.view'], '/delivery'],
    ['Finance', ['finance.view','finance.payment_confirm','document.manage'], '/finance'],
    ['DashboardViewer', ['dashboard.view'], '/overview'],
  ];
  it.each(cases)('%s has its own landing route', (role, permissions, path, station) =>
    expect(homeFor(profile(role, permissions, station))).toBe(path),
  );
  it('generic business.view does not grant a Sales route', () => {
    const user = profile('Design', ['business.view', 'design.manage']);
    expect(canOpenModule(user, 'sales')).toBe(false);
    expect(safeDestination(user, '/sales/foreign')).toBe('/design');
  });
  it('Finance deep links require financial view permission and never open for a Station account', () => {
    const finance=profile('Finance',['finance.view']);
    expect(safeDestination(finance,'/finance/receipts/abc')).toBe('/finance/receipts/abc');
    expect(canOpenModule(profile('DashboardViewer',['business.view','dashboard.view']),'finance')).toBe(false);
    expect(canOpenModule(profile('Station',['work_order.view','finance.view'],true),'finance')).toBe(false);
  });
  it('station is restricted even if extra human permissions appear', () => {
    const user = profile('Station', ['work_order.view', 'user.manage', 'sales.manage'], true);
    expect(canOpenModule(user, 'station')).toBe(true);
    expect(canOpenModule(user, 'sales')).toBe(false);
    expect(canOpenModule(user, 'settings')).toBe(false);
  });
  it('must-change and ungranted roles do not bypass access', () => {
    expect(homeFor({ ...profile('Sales', ['sales.manage']), mustChangePassword: true })).toBe(
      '/change-password',
    );
    expect(homeFor(profile('Unknown', ['business.view']))).toBe('/workspace');
  });
  it('rejects external redirects and preserves authorized deep links', () => {
    const user = profile('Sales', ['sales.manage']);
    expect(safeDestination(user, '//example.test')).toBe('/sales');
    expect(safeDestination(user, '/\\example.test')).toBe('/sales');
    expect(safeDestination(user, '/sales/abc?tab=revisions')).toBe('/sales/abc?tab=revisions');
  });
});
