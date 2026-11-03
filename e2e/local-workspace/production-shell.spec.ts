import { expect, test } from '@playwright/test';

test.skip(process.env['LOCAL_PRODUCTION_CHECK'] !== 'true', 'Production Nginx preview only.');

test('production shell prevents framing and API caching; PWA caches only static assets', async ({ request }) => {
  const shell = await request.get('/station');
  expect(shell.status()).toBe(200);
  expect(shell.headers()['x-frame-options']).toBe('DENY');
  expect(shell.headers()['x-content-type-options']).toBe('nosniff');
  expect(shell.headers()['cache-control']).toContain('no-cache');
  const challenge = await request.get('/api/v1/auth/login-challenge');
  expect(challenge.status()).toBe(200);
  expect(challenge.headers()['cache-control']).toContain('no-store');
  const manifest = await request.get('/ngsw.json');
  expect(manifest.headers()['cache-control']).toContain('no-cache');
  const config = await manifest.json();
  expect(config.appData.transactionPolicy).toBe('online-only');
  expect(config.dataGroups).toEqual([]);
});

test('production PWA refreshes the real session and does not serve API data offline', async ({ page, context }) => {
  const password = process.env['LOCAL_TEST_PASSWORD'];
  if (!password) throw new Error('Provide private LOCAL_TEST_PASSWORD.');
  await page.goto('/login');
  await page.getByLabel('USERNAME', { exact: true }).fill('dev-viewer');
  await page.getByLabel('PASSWORD', { exact: true }).fill(password);
  await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 90000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page).toHaveURL(/\/overview$/, { timeout: 90000 });
  await expect(page.locator('main .loading-state')).toHaveCount(0, { timeout: 120000 });
  await expect(page.locator('main .notice.error')).toHaveCount(0);
  await context.setOffline(true);
  try {
    const result = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/v1/dashboard');
        return { ok: response.ok, status: response.status };
      } catch { return { ok: false, status: 0 }; }
    });
    expect(result.ok).toBe(false);
    const cachedApi = await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        if ((await cache.keys()).some(r => new URL(r.url).pathname.startsWith('/api/'))) return true;
      }
      return false;
    });
    expect(cachedApi).toBe(false);
  } finally { await context.setOffline(false); }
});
