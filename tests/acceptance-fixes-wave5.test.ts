import { readFileSync } from 'node:fs';
import { create, createInjector } from './support/angular';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../src/app/core/auth/auth.service';
import { ApiClient } from '../src/app/core/services/api/api-client.service';
import { CustomersComponent } from '../src/app/features/customers/pages/customers.component';
import { CustomerApi } from '../src/app/features/customers/customer-api.service';
import { MutationSession } from '../src/app/shared/utils/mutation-session';
import { signal } from '@angular/core';
import { DeliveryWorkspacePage } from '../src/app/features/delivery/pages/delivery-workspace.component';
import { DeliveryApi } from '../src/app/features/delivery/services/delivery-api.service';
import { DeliveryCommands } from '../src/app/features/delivery/services/delivery-commands.service';

vi.mock('../src/app/core/auth/auth.service', () => ({ AuthService: class AuthService {} }));

// Wave 5, bug 6 (DEV walkthrough 4 Nov 2026): "โหลดข้อมูลล่าสุด" with unsaved edits used window.confirm().
const customer = { id: 'c-1', code: 'C01', name: 'ลูกค้าเดิม', version: '2', isActive: true, addresses: [{ addressType: 'Billing', addressText: 'BKK' }, { addressType: 'Shipping', addressText: 'BKK' }], quotations: [], salesOrders: [] };
function page() {
  const detail = vi.fn().mockResolvedValue({ ...customer, name: 'ลูกค้าล่าสุด', version: '3' });
  const confirm = vi.fn(() => true); (globalThis as unknown as { confirm: unknown }).confirm = confirm;
  const c = create(CustomersComponent, createInjector([
    MutationSession, FormBuilder, { provide: ApiClient, useValue: { post: vi.fn() } }, { provide: CustomerApi, useValue: { detail, list: vi.fn() } },
    { provide: AuthService, useValue: { has: () => true } }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map() } } },
  ]));
  c.open.set(true); c.selected.set(customer as never); c.edit(); c.form.controls.name.setValue('กำลังแก้'); c.form.markAsDirty();
  return { c, detail, confirm };
}

describe('Customer reload latest uses the shared Dialog', () => {
  it('asks in the dialog first and keeps the unsaved edit when the user goes back', async () => {
    const { c, detail, confirm } = page();
    await c.reloadDetail();
    expect(c.confirmReload()).toBe(true);
    expect(detail).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    c.confirmReload.set(false);
    expect(c.form.controls.name.value).toBe('กำลังแก้');
  });

  it('replaces the form with the latest customer once confirmed in the dialog', async () => {
    const { c, detail, confirm } = page();
    await c.reloadDetail();
    await c.reloadDetail(true);
    expect(detail).toHaveBeenCalledWith('c-1');
    expect(c.confirmReload()).toBe(false);
    expect(c.form.controls.name.value).toBe('ลูกค้าล่าสุด');
    expect(c.selected()?.version).toBe('3');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('reloads at once when nothing is unsaved', async () => {
    const { c, detail } = page();
    c.form.markAsPristine();
    await c.reloadDetail();
    expect(c.confirmReload()).toBe(false);
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it('renders the dialog with the shared overlay and no browser confirm for reload', () => {
    const template = readFileSync('src/app/features/customers/pages/customers.component.html', 'utf8');
    expect(template).toContain('@if(confirmReload()){<app-overlay title="โหลดข้อมูลล่าสุด" reference="ลูกค้า" [dialog]="true"');
    expect(template).toContain('(click)="reloadDetail(true)"');
    const source = readFileSync('src/app/features/customers/pages/customers.component.ts', 'utf8');
    expect(source).not.toContain("confirm('โหลดข้อมูลล่าสุด");
  });
});

// Wave 5, bug 5: DL-202611-000001 second "หยิบสินค้า" listed no FG until the page was reloaded. The dialog was built from the
// detail cached at page load, so FG reserved later (another session's FG receipt) never appeared.
describe('Delivery pick dialog reads the current reservations', () => {
  const line = { id: 'dl-1', planned: 8, picked: 2 };
  const stale = { id: 'd-1', version: 3, items: [line], picks: [], packages: [], availablePicks: [] };
  const fresh = { ...stale, version: 4, availablePicks: [{ reservationId: 'res-wo8', reservationVersion: 1, deliveryItemId: 'dl-1', product: 'FG', revision: 'R01', batch: 'LOT-WO8', location: 'FG', available: 6 }] };
  function page(detail: ReturnType<typeof vi.fn>) {
    const commands = { busy: signal(false), pending: signal(null), uncertain: signal(false), error: signal(''), clearError: vi.fn() };
    const p = create(DeliveryWorkspacePage, createInjector([
      { provide: DeliveryCommands, useValue: commands }, { provide: DeliveryApi, useValue: { detail } },
      { provide: AuthService, useValue: { user: () => ({ id: 'u-1' }), has: () => true } }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map() } } },
    ]));
    p.detail.set(stale as never);
    return p;
  }
  it('refetches the delivery before offering FG, so a later reservation is listed without a reload', async () => {
    const detail = vi.fn().mockResolvedValue(fresh);
    const p = page(detail);
    await p.begin('pick');
    expect(detail).toHaveBeenCalledWith('d-1');
    expect(p.mode()).toBe('pick');
    expect(p.detail()?.availablePicks).toHaveLength(1);
    expect(p.model.choice).toBe('dl-1:res-wo8');
    expect(p.model.quantity).toBe(6);
    expect(p.detail()?.version).toBe(4);
  });
  it('keeps the dialog closed and shows the error when the refresh fails', async () => {
    const p = page(vi.fn().mockRejectedValue(new Error('offline')));
    await p.begin('pick');
    expect(p.mode()).toBeNull();
    expect(p.error()).not.toBe('');
    expect(p.loading()).toBe(false);
  });
});

// Wave 5, selling prices: the server masks quotation/SO prices outside Sales/Finance/SystemAdmin. The only screens that
// render them (/sales, /customers) stay limited to sales.manage, and they already render a null price as "not priced".
describe('Selling-price screens stay with Sales', () => {
  const grants: Record<string, string[]> = {
    Design: ['master.view', 'design.manage', 'business.view', 'file.manage'],
    Planning: ['master.view', 'planning.decide', 'work_order.view', 'business.view'],
    QC: ['master.view', 'work_order.view', 'qc.inspect', 'qc.approve', 'dashboard.view', 'business.view', 'file.manage'],
    Inventory: ['master.view', 'work_order.view', 'dashboard.view', 'report.export', 'business.view', 'inventory.manage', 'delivery.manage', 'file.manage', 'document.manage'],
    ProductionManager: ['user.view', 'master.view', 'business.view', 'work_order.view', 'work_order.release', 'dashboard.view', 'report.export'],
    Supervisor: ['user.view', 'master.view', 'business.view', 'delivery.gps_approve', 'file.manage', 'work_order.view', 'production.execute', 'production.override', 'dashboard.view'],
  };
  it('does not open the quotation or customer screens for roles without price access', async () => {
    const { canOpenModule } = await import('../src/app/core/auth/workspace-policy');
    for (const [role, permissions] of Object.entries(grants)) {
      const user = { id: 'u', username: role, displayName: role, email: '', employeeCode: role, isActive: true, mustChangePassword: false, roles: [role], permissions, accountType: 'Personal' } as never;
      expect(canOpenModule(user, 'sales'), role).toBe(false);
      expect(canOpenModule(user, 'customers'), role).toBe(false);
    }
  });
  it('renders a masked (null) revision total and unit price without breaking', () => {
    const panel = readFileSync('src/app/features/sales/components/quotation-revision-panel.component.html', 'utf8');
    expect(panel).toContain('@if (revision.grandTotal !== null) {');
    expect(panel).toContain('@if (line.unitPrice !== null) {');
    expect(readFileSync('src/app/features/sales/sales.html', 'utf8')).toContain("l.unitPrice === null ? 'รอตั้งราคา' : money(l.unitPrice)");
  });
});

// F14 walkthrough: a DWG with the wrong bytes was reported as "ไฟล์ภาพ". The server now names the expected type.
describe('Upload content mismatch names the actual file type', () => {
  it('shows the server Thai title and never calls a drawing an image', async () => {
    const { HttpErrorResponse } = await import('@angular/common/http');
    const { problemMessage } = await import('../src/app/core/services/api/api-client.service');
    const dwg = new HttpErrorResponse({ status: 400, error: { code: 'content_type_mismatch', title: 'เนื้อหาไฟล์ไม่ใช่ DWG ตามชนิดที่ระบุ กรุณาเลือกไฟล์ DWG ที่เปิดได้สมบูรณ์' } });
    expect(problemMessage(dwg)).toContain('DWG');
    expect(problemMessage(dwg)).not.toContain('ไฟล์ภาพ');
    const english = new HttpErrorResponse({ status: 400, error: { code: 'content_type_mismatch', title: 'File signature does not match its content type.' } });
    expect(problemMessage(english)).toBe('เนื้อหาไฟล์ไม่ตรงกับชนิดที่ระบุ กรุณาเลือกไฟล์ที่เปิดได้สมบูรณ์');
  });
});

// F03 walkthrough: restoring every override in the dialog "did not close and showed no error". The target user's login
// had made the open version stale (fixed on the server); the 409 alert rendered below the long permission table.
describe('Permission editor shows a command conflict at the top of the dialog', () => {
  it('renders the command alert before the form fields', () => {
    const template = readFileSync('src/app/features/users/pages/users-workspace.component.html', 'utf8');
    const form = template.indexOf('<form id="user-command-form"'), alert = template.indexOf('@if (command.error())', form), fields = template.indexOf('<fieldset [disabled]="blocked">', form);
    expect(alert).toBeGreaterThan(form);
    expect(alert).toBeLessThan(fields);
    expect(template.match(/@if \(command\.error\(\)\)/g)).toHaveLength(1);
    expect(template.slice(alert, fields)).toContain("command.problemCode() === 'stale_version'");
  });
});
