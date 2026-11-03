import '@angular/compiler';
import { HttpErrorResponse } from '@angular/common/http';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { create, createInjector, templateElements } from './support/angular';
import { AuthService } from '../src/app/core/auth/auth.service';
import { ApiClient } from '../src/app/core/services/api/api-client.service';
import { UsersWorkspace } from '../src/app/features/users/pages/users-workspace.component';
import { UsersApi } from '../src/app/features/users/services/users-api.service';
import { MutationSession } from '../src/app/shared/utils/mutation-session';

// The real AuthService needs a browser session; the editor only reads it for display.
vi.mock('../src/app/core/auth/auth.service', () => ({ AuthService: class AuthService {} }));

const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });
const capabilities = { canEdit: true, canAssign: true, canChangeStatus: true, canResetPassword: true, canSetPin: true, canRevokeSessions: true, canResetMfa: true, canUnlock: true, canEditPermissions: true };
const user = { id: 'u-1', username: 'dev-planning', email: 'p@example.test', employeeCode: 'P01', displayName: 'Planner', accountType: 'HUMAN', stationId: null, roles: ['Planning'], workCenterIds: ['st-1'], isActive: true, version: 5 };
const detail = (overrides: Partial<typeof capabilities> = {}) => ({
  user,
  capabilities: { ...capabilities, ...overrides },
  inheritedPermissions: [{ permission: 'planning.decide', scope: 'all' }, { permission: 'work_order.view', scope: 'own' }],
  permissionOverrides: [{ permission: 'inventory.manage', effect: 'DENY', scope: 'all' }],
  effectivePermissions: [],
});
const options = {
  canProvision: true,
  stations: [{ id: 'st-1', code: 'CUT', name: 'ตัด' }],
  permissions: ['planning.decide', 'work_order.view', 'inventory.manage', 'production.execute', 'qc.inspect'],
  permissionScopes: { 'planning.decide': ['all', 'own'], 'work_order.view': ['all', 'own'], 'inventory.manage': ['all'], 'production.execute': ['all', 'assigned_station'], 'qc.inspect': ['all'] },
};

function setup() {
  const api = {
    list: vi.fn(async () => ({ items: [{ ...user }], page: 1, pageSize: 25, totalCount: 1 })),
    options: vi.fn(async () => options),
    detail: vi.fn(async () => detail()),
    mfa: vi.fn(),
  };
  const post = vi.fn(async () => ({}));
  const page = create(UsersWorkspace, createInjector([MutationSession, { provide: UsersApi, useValue: api }, { provide: ApiClient, useValue: { post } }, { provide: AuthService, useValue: { user: () => null } }]));
  return { page, api, post };
}
async function permissionsForm() {
  const s = setup();
  await s.page.load();
  await s.page.open(user as never);
  await s.page.begin('permissions');
  return s;
}

describe('F03 permission editor', () => {
  it('cannot open when the server did not grant canEditPermissions', async () => {
    const s = setup();
    s.api.detail.mockResolvedValueOnce(detail({ canEditPermissions: false }));
    await s.page.open(user as never);
    await s.page.begin('permissions');
    expect(s.page.action()).toBeNull();
  });
  it('starts from the saved per-user overrides and their scopes', async () => {
    const { page } = await permissionsForm();
    expect(page.action()).toBe('permissions');
    expect(page.model.overrides).toEqual({ 'inventory.manage': 'DENY' });
    expect(page.model.scopes).toEqual({ 'inventory.manage': 'all' });
    expect(page.previewScope('inventory.manage')).toBe('ปิดสิทธิ์นี้');
    expect(page.previewScope('planning.decide')).toBe('ทุกข้อมูล');
    expect(page.previewScope('work_order.view')).toBe('เฉพาะของตน');
    expect(page.previewScope('qc.inspect')).toBe('ไม่มีสิทธิ์จาก Role');
  });
  it('ALLOW picks the inherited scope when allowed, otherwise the narrowest supported scope', async () => {
    const { page } = await permissionsForm();
    page.permissionEffect('work_order.view', 'ALLOW');
    expect(page.model.scopes['work_order.view']).toBe('own');
    page.permissionEffect('production.execute', 'ALLOW');
    expect(page.model.scopes['production.execute']).toBe('assigned_station');
    page.permissionEffect('qc.inspect', 'ALLOW');
    expect(page.model.scopes['qc.inspect']).toBe('all');
    expect(page.allowedScopes('unknown.permission')).toEqual(['all']);
    page.permissionEffect('production.execute', 'DENY');
    expect(page.model.scopes['production.execute']).toBe('all');
    page.permissionEffect('production.execute', 'INHERIT');
    expect('production.execute' in page.model.scopes).toBe(false);
  });
  it('filters by Thai label or permission code', async () => {
    const { page } = await permissionsForm();
    page.permissionSearch = 'สต็อก';
    expect(page.permissionRows()).toEqual(['inventory.manage']);
    page.permissionSearch = 'QC.INSPECT';
    expect(page.permissionRows()).toEqual(['qc.inspect']);
    page.permissionSearch = 'ไม่มีจริง';
    expect(page.permissionRows()).toEqual([]);
  });
  it('requires a 3–500 character reason before sending anything', async () => {
    const { page, post } = await permissionsForm();
    page.permissionEffect('qc.inspect', 'ALLOW');
    page.model.reason = ' x ';
    await page.save();
    expect(post).not.toHaveBeenCalled();
    expect(page.errors('reason')).toBe('กรอกเหตุผล 3–500 ตัวอักษร');
  });
  it('sends only real overrides with expectedVersion and an Idempotency-Key, DENY always at scope all', async () => {
    const { page, post, api } = await permissionsForm();
    page.permissionEffect('inventory.manage', 'INHERIT');
    page.permissionEffect('work_order.view', 'ALLOW');
    page.permissionEffect('production.execute', 'ALLOW');
    page.permissionEffect('qc.inspect', 'DENY');
    page.model.reason = '  ย้ายไปทีม QC  ';
    await page.save();
    expect(post).toHaveBeenCalledOnce();
    const [path, body, key] = post.mock.calls[0] as unknown as [string, any, string];
    expect(path).toBe('/users/u-1/permissions');
    expect(body).toEqual({
      expectedVersion: 5,
      reason: 'ย้ายไปทีม QC',
      overrides: [
        { permission: 'work_order.view', effect: 'ALLOW', scope: 'own' },
        { permission: 'production.execute', effect: 'ALLOW', scope: 'assigned_station' },
        { permission: 'qc.inspect', effect: 'DENY', scope: 'all' },
      ],
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(page.action()).toBeNull();
    expect(page.notice()).toBe('บันทึกแล้ว · กำหนดสิทธิ์รายบุคคล');
    expect(api.detail).toHaveBeenCalledTimes(2);
  });
  it('shows a stale_version conflict with its trace id and reloads the account on request', async () => {
    const { page, post, api } = await permissionsForm();
    post.mockRejectedValueOnce(http(409, { code: 'stale_version', traceId: 'trace-409' }));
    page.permissionEffect('qc.inspect', 'ALLOW');
    page.model.reason = 'เพิ่มสิทธิ์ตรวจ';
    await page.save();
    expect([page.action(), page.command.problemCode(), page.command.traceId(), page.command.uncertain()]).toEqual(['permissions', 'stale_version', 'trace-409', false]);
    expect(page.command.error()).toContain('โหลดข้อมูลล่าสุด');
    await page.reloadConflict();
    expect(page.action()).toBeNull();
    expect(api.detail).toHaveBeenCalledTimes(2);
  });
  it('blocks leaving or closing while dirty, busy or uncertain', async () => {
    const { page, post } = await permissionsForm();
    expect(page.canLeave()).toBe(true);
    page.permissionEffect('qc.inspect', 'ALLOW');
    expect(page.canLeave()).toBe(false);
    expect(page.discard()).toBe(true);
    page.discard.set(false);
    post.mockRejectedValueOnce(http(503, { traceId: 'trace-503' }));
    page.model.reason = 'ทดสอบเครือข่าย';
    await page.save();
    expect(page.command.uncertain()).toBe(true);
    page.closeForm();
    expect([page.action(), page.canLeave()]).toEqual(['permissions', false]);
    // The uncertain command is replayed with the same key, never re-created.
    await page.retry();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
    expect(page.action()).toBeNull();
  });
  it('labels every permission control and keeps the trace reference next to command errors', () => {
    const html = readFileSync('src/app/features/users/pages/users-workspace.component.html', 'utf8');
    const elements = templateElements(html);
    const override = elements.find((e) => e.inputs.includes('name') && e.name === 'select' && e.inputs.includes('aria-label'))!;
    expect(override.outputs).toContain('ngModelChange');
    expect(html).toContain('[attr.aria-label]="\'สิทธิ์ \' + p"');
    expect(html).toContain('[attr.aria-label]="\'ขอบเขต \'+p"');
    expect(elements.find((e) => e.name === 'app-trace-ref')!.inputs).toEqual(['traceId']);
    expect(elements.find((e) => e.name === 'app-state' && e.inputs.includes('view'))).toBeTruthy();
  });
});

describe('F03 users list typed state', () => {
  it('shows denied without retry and without the previous page', async () => {
    const { page, api } = setup();
    await page.load();
    expect([page.rows().length, page.total, page.list().status]).toEqual([1, 1, 'ready']);
    api.list.mockRejectedValueOnce(http(403, { traceId: 'trace-403' }));
    await page.load();
    expect([page.list().status, page.rows(), page.total, page.listEmptyText()]).toEqual(['denied', [], 0, 'ไม่มีสิทธิ์ดูรายการนี้']);
    expect(page.error()).toBe('ไม่มีสิทธิ์ในรายการนี้');
  });
  it('keeps the current rows visible while reloading and reports empty results', async () => {
    const { page, api } = setup();
    await page.load();
    let resolve!: (value: unknown) => void;
    api.list.mockImplementationOnce(() => new Promise((r) => (resolve = r)) as never);
    const pending = page.load();
    expect([page.loading(), page.rows().length]).toEqual([true, 1]);
    // A second load while one is running is ignored instead of racing it.
    await page.load();
    expect(api.list).toHaveBeenCalledTimes(2);
    resolve({ items: [], page: 1, pageSize: 25, totalCount: 0 });
    await pending;
    expect([page.list().status, page.loading(), page.listEmptyText()]).toEqual(['empty', false, 'ไม่พบบัญชีตามตัวกรอง']);
  });
  it('offers retry for a server error', async () => {
    const { page, api } = setup();
    api.list.mockRejectedValueOnce(http(500, { traceId: 'trace-500' }));
    await page.load();
    expect(page.list()).toMatchObject({ status: 'error', retryable: true, traceId: 'trace-500' });
    expect(page.listEmptyText()).toBe('โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง');
  });
});
