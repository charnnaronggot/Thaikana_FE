import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const cases: [string, string, string, string][] = [
  ['dev-admin', 'SystemAdmin', '/overview', 'ภาพรวม'],
  ['dev-sales', 'Sales', '/sales', 'ใบเสนอราคา'],
  ['dev-sales2', 'Sales', '/sales', 'ใบเสนอราคา'],
  ['dev-design', 'Design', '/design', 'ออกแบบ'],
  ['dev-planning', 'Planning', '/planning', 'วางแผนผลิต'],
  ['dev-inventory', 'Inventory', '/inventory', 'คลังสินค้า'],
  ['dev-productionmanager', 'ProductionManager', '/production', 'งานผลิต'],
  ['dev-supervisor', 'Supervisor', '/production', 'งานผลิต'],
  ['dev-operator', 'Operator', '/station', 'งานของสถานี'],
  ['dev-operator2', 'Operator', '/station', 'งานของสถานี'],
  ['dev-qc', 'QC', '/qc', 'ตรวจคุณภาพ'],
  ['dev-delivery', 'Delivery', '/delivery', 'จัดส่ง'],
  ['dev-viewer', 'DashboardViewer', '/overview', 'ภาพรวม'],
  ['dev-station', 'Station', '/station', 'งานของสถานี'],
];
for (const [username, role, destination, title] of cases)
  test(`${role}: ${username} lands in its own workspace`, async ({ page }) => {
    const password = process.env['LOCAL_TEST_PASSWORD'];
    if (!password) throw new Error('Provide private LOCAL_TEST_PASSWORD.');
    const failures: { path: string; status: number }[] = [];
    page.on('response', (r) => {
      if (r.url().includes('/api/v1/') && r.status() >= 400 && !r.url().includes('/auth/refresh'))
        failures.push({ path: new URL(r.url()).pathname, status: r.status() });
    });
    await page.goto('/login' + (role === 'Design' ? '?returnUrl=/sales' : ''));
    await page.getByLabel('USERNAME', { exact: true }).fill(username);
    await page.getByLabel('PASSWORD', { exact: true }).fill(password);
    const login = page.waitForResponse((r) => r.url().endsWith('/auth/login/encrypted'), {
      timeout: 90000,
    });
    await page.locator('.login-submit').click();
    expect((await login).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(destination + '$'));
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.locator('main .loading-state')).toHaveCount(0, { timeout: 120000 });
    await expect(page.locator('main .notice.error')).toHaveCount(0);
    const links = await page
      .locator('.sidebar nav a')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href')));
    if (role !== 'Sales' && role !== 'SystemAdmin') expect(links).not.toContain('/sales');
    if (role === 'Station') expect(links).toEqual(['/station']);
    if (role === 'DashboardViewer') expect(links).toEqual(['/overview']);
    expect(failures).toEqual([]);
    const output = process.env['LOCAL_TEST_ARTIFACTS'];
    if (output) {
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/${username}.png` });
    }
    if (role === 'Operator' || role === 'Station' || role === 'DashboardViewer') {
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/denied$/);
    }
    if (role === 'Design') {
      await page.goto('/sales');
      await expect(page).toHaveURL(/\/denied$/);
      await page.goto('/');
      await expect(page).toHaveURL(/\/design$/);
    }
  });
