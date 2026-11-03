import { describe, expect, it } from 'vitest';
import { canOpenModule, homeFor, workspaceModules } from '../src/app/core/auth/workspace-policy';
import type { UserProfile } from '../src/app/core/models/api.models';
import { dashboardNextActions, dashboardStats, type DashboardSummary } from '../src/app/features/modules/dashboard-summary';

// Default grants after the owner decisions of 2 Nov 2026 (backend PermissionCatalog).
const all = ['sales.manage','design.manage','planning.decide','inventory.manage','delivery.manage','delivery.confirm','delivery.gps_approve','file.manage','document.manage','business.view','user.view','user.manage','master.view','master.manage','customer.manage','work_order.view','work_order.release','production.execute','production.override','qc.inspect','qc.approve','dashboard.view','report.export','finance.view','finance.draft','finance.post','finance.payment_draft','finance.payment_confirm','finance.reverse','finance.adjust','finance.export'];
const defaults: Record<string, string[]> = {
  SystemAdmin: all.filter((p) => !['finance.post','finance.payment_confirm','finance.reverse','finance.adjust'].includes(p)),
  ProductionManager: ['user.view','master.view','business.view','work_order.view','work_order.release','dashboard.view','report.export'],
  Supervisor: ['user.view','master.view','business.view','delivery.gps_approve','file.manage','work_order.view','production.execute','production.override','dashboard.view'],
  Delivery: ['master.view','delivery.confirm','business.view','file.manage'],
  Inventory: ['master.view','work_order.view','dashboard.view','report.export','business.view','inventory.manage','delivery.manage','file.manage','document.manage'],
};
const user = (role: string) => ({ roles: [role], permissions: defaults[role], permissionScopes: defaults[role].map((permission) => ({ permission, scope: 'all' })), accountType: 'Personal', mustChangePassword: false }) as UserProfile;
const menu = (role: string) => workspaceModules.filter((m) => canOpenModule(user(role), m.key)).map((m) => m.key).sort();

describe('Menus follow the owner role decisions (2 Nov 2026)', () => {
  it('production planning Manager reads and releases only: no master, customer, QC, delivery or planning editor', () => {
    expect(menu('ProductionManager')).toEqual(['overview', 'production', 'reports', 'users']);
    expect(homeFor(user('ProductionManager'))).toBe('/production');
  });
  it('SystemAdmin keeps administration and Finance read without money commands in its grants', () => {
    const keys = menu('SystemAdmin');
    for (const key of ['overview', 'users', 'operations', 'settings', 'finance', 'master-data'] as const) expect(keys).toContain(key);
    expect(user('SystemAdmin').permissions).not.toContain('finance.payment_confirm');
  });
  it('Delivery works team-wide in its delivery home; Inventory still picks and packs', () => {
    expect(homeFor(user('Delivery'))).toBe('/delivery');
    expect(menu('Delivery')).toEqual(['delivery']);
    expect(canOpenModule(user('Inventory'), 'delivery')).toBe(true);
  });
  it('Supervisor keeps its production home; Station scope is enforced by the API', () => {
    expect(homeFor(user('Supervisor'))).toBe('/production');
    expect(menu('Supervisor')).toContain('station');
  });
});

describe('Dashboard summary is scoped by the API', () => {
  const summary = (patch: Partial<DashboardSummary>): DashboardSummary => ({
    openWorkOrders: null, activeRuns: null, materialShortages: null, pendingQc: null, pendingGps: null, failedPdf: null, unpublishedEvents: null, nextActions: [], ...patch,
  });
  it('hides counts outside the actor scope instead of showing zero', () => {
    expect(dashboardStats(summary({}))).toEqual([]);
    expect(dashboardStats(summary({ openWorkOrders: 0, pendingQc: '3' }))).toEqual([
      { label: 'WO ที่ยังไม่จบ', value: 0 },
      { label: 'รอตรวจ QC', value: 3 },
    ]);
  });
  it('labels next actions and keeps only internal links', () => {
    expect(dashboardNextActions(summary({ nextActions: [
      { code: 'delivery.awaiting_pod', count: 2, path: '/delivery' },
      { code: 'qc.pending_inspection', count: '1', path: '//evil.test' },
      { code: 'unknown.code', count: 0, path: '/planning' },
    ] }))).toEqual([
      { label: 'ส่งออกแล้ว · รอยืนยันส่งมอบ (POD)', count: 2, path: '/delivery' },
      { label: 'unknown.code', count: 0, path: '/planning' },
    ]);
  });
});
