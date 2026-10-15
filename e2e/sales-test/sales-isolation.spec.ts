import { expect, test } from '@playwright/test';

test('Sales test publishes only Sales routes and API dependencies', async ({ page, request }) => {
  const username = process.env['SALES_TEST_USERNAME'];
  const password = process.env['SALES_TEST_PASSWORD'];
  if (!username || !password) throw new Error('Provide SALES_TEST_USERNAME and SALES_TEST_PASSWORD as private environment variables.');
  const response = await request.post('/api/v1/auth/login', { data: { username, password } });
  expect(response.status()).toBe(200);
  const auth = await response.json();
  const headers = { Authorization: 'Bearer ' + auth.accessToken };
  for (const path of ['/planning/work-orders', '/work-orders', '/inventory', '/quality', '/delivery/shipments', '/finance/invoices', '/reports/dashboard', '/stations']) {
    expect((await request.get('/api/v1/sales-ui' + path, { headers })).status(), path).toBe(404);
  }
  expect((await request.get('/api/v1/sales-ui/quotations', { headers })).status()).toBe(200);
  expect((await request.get('/api/v1/sales-ui/customers', { headers })).status()).toBe(200);
  const blockedExport = await request.post('/api/v1/sales-ui/documents/invoice/00000000-0000-0000-0000-000000000001/export', {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(blockedExport.status()).toBe(404);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByLabel('USERNAME', { exact: true }).fill(username);
  await page.getByLabel('PASSWORD', { exact: true }).fill(password);
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/sales$/);
  const links = await page.locator('.sidebar nav a').evaluateAll(nodes => nodes.map(n => n.getAttribute('href')));
  expect(links.every(link => ['/sales', '/customers', '/settings'].includes(link!))).toBe(true);
  expect(links).toContain('/sales');
  await page.goto('/planning');
  await expect(page).toHaveURL(/\/denied$/);
});
