import { expect, test } from '@playwright/test';
import { encryptLogin } from '../../src/app/core/auth/login-encryption';
import { mkdirSync } from 'node:fs';
// Interception tests must not be bypassed by Angular's production service worker.
test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ context }) => {
  await context.route('**/api/v1/**', async route => {
    const request = route.request();
    if (request.method() !== 'GET' && !new URL(request.url()).pathname.startsWith('/api/v1/auth/')) {
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
});
async function login(page: any, username: string) {
  const password = process.env['LOCAL_TEST_PASSWORD'];
  if (!password) throw new Error('Provide private LOCAL_TEST_PASSWORD.');
  await page.goto('/login');
  await page.getByLabel('USERNAME', { exact: true }).fill(username);
  await page.getByLabel('PASSWORD', { exact: true }).fill(password);
  const result = page.waitForResponse((r: any) => r.url().endsWith('/auth/login/encrypted'), {
    timeout: 90000,
  });
  await page.locator('.login-submit').click();
  expect((await result).status()).toBe(200);
}
test('Planning command keeps idempotency key after network uncertainty and requires denial reason', async ({
  page,
}) => {
  await page.route('**/api/v1/records/planning-requests?*', async route => {
    const response = await route.fetch();
    const data = await response.json();
    // Only the displayed status is a fixture; never change shared test records.
    if (data.items?.length) data.items[0].status = 'PENDING';
    await route.fulfill({ response, json: data });
  });
  await login(page, 'dev-planning');
  await expect(page).toHaveURL(/\/planning$/);
  await expect(page.locator('main .loading-state')).toHaveCount(0, { timeout: 120000 });
  await page
    .locator('tbody tr')
    .filter({ hasText: 'PENDING' })
    .first()
    .getByRole('button', { name: 'ดูรายละเอียด' })
    .click();
  const detail = page.getByRole('dialog').first();
  await expect(detail.locator('.loading-state')).toHaveCount(0, { timeout: 90000 });
  await detail.getByRole('button', { name: 'ปฏิเสธคำขอ', exact: true }).click();
  let confirm = page.getByRole('dialog', { name: 'ยืนยันปฏิเสธคำขอ', exact: true });
  await expect(confirm.getByRole('button', { name: 'ยืนยัน', exact: true })).toBeDisabled();
  await confirm.getByLabel('เหตุผล').fill('ตรวจสอบข้อมูลวัสดุเพิ่มเติม');
  await expect(confirm.getByRole('button', { name: 'ยืนยัน', exact: true })).toBeEnabled();
  await confirm.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  const keys: string[] = [];
  await page.route('**/api/v1/planning-requests/*/create-work-order', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    expect(route.request().postDataJSON()).toEqual({});
    await route.fulfill({
      status: keys.length === 1 ? 503 : 409,
      contentType: 'application/problem+json',
      body: JSON.stringify(
        keys.length === 1
          ? { code: 'service_unavailable', title: 'ทดสอบการเชื่อมต่อขาดหาย' }
          : { code: 'material_shortage', title: 'วัสดุยังไม่พร้อมสำหรับ WO' },
      ),
    });
  });
  await detail.getByRole('button', { name: 'สร้างใบสั่งผลิต', exact: true }).click();
  confirm = page.getByRole('dialog', { name: 'ยืนยันสร้างใบสั่งผลิต', exact: true });
  await confirm.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await expect(confirm.getByText('ยังไม่ทราบผล', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'ตรวจผล / ลองคำสั่งเดิม', exact: true }).click();
  await expect(confirm.getByText('วัสดุยังไม่พร้อมสำหรับ WO', { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  await confirm.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
});
test('Station data is scoped by server and Viewer cannot request work orders', async ({
  request,
}) => {
  const password = process.env['LOCAL_TEST_PASSWORD'];
  if (!password) throw new Error('Provide private LOCAL_TEST_PASSWORD.');
  async function auth(username: string) {
    const challenge = await (await request.get('/api/v1/auth/login-challenge')).json();
    const r = await request.post('/api/v1/auth/login/encrypted', {
      data: await encryptLogin(challenge, username, password),
    });
    expect(r.status()).toBe(200);
    return r.json();
  }
  const admin = await auth('dev-admin'),
    station = await auth('dev-station');
  const all = await (
    await request.get('/api/v1/production-board', {
      headers: { Authorization: 'Bearer ' + admin.accessToken },
    })
  ).json();
  const scoped = await request.get('/api/v1/production-board', {
    headers: { Authorization: 'Bearer ' + station.accessToken },
  });
  expect(scoped.status()).toBe(200);
  const data = await scoped.json();
  expect(data.operations.length).toBeGreaterThan(0);
  expect(data.operations.every((o: any) => o.workCenterId === station.user.stationId)).toBe(true);
  const foreign = all.operations.find((o: any) => o.workCenterId !== station.user.stationId);
  expect(foreign).toBeTruthy();
  expect(
    (
      await request.get('/api/v1/records/operations/' + foreign.id, {
        headers: { Authorization: 'Bearer ' + station.accessToken },
      })
    ).status(),
  ).toBe(403);
  const viewer = await auth('dev-viewer');
  expect(
    (
      await request.get('/api/v1/records/work-orders', {
        headers: { Authorization: 'Bearer ' + viewer.accessToken },
      })
    ).status(),
  ).toBe(403);
});
test('Native Station page is responsive and does not show unsupported execution actions', async ({
  page,
}) => {
  await login(page, 'dev-station');
  await expect(page).toHaveURL(/\/station$/);
  await expect(page.locator('main .loading-state')).toHaveCount(0, { timeout: 120000 });
  await expect(page.getByRole('button', { name: 'เริ่มงาน', exact: true })).toHaveCount(0);
  const out = process.env['LOCAL_TEST_ARTIFACTS'];
  for (const [width, height] of [
    [1920, 1080],
    [1194, 834],
    [834, 1194],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (out) {
      mkdirSync(out, { recursive: true });
      await page.screenshot({ path: `${out}/station-${width}x${height}.png` });
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('tbody tr').first().getByRole('button', { name: 'ดูรายละเอียด' }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.locator('.loading-state')).toHaveCount(0, { timeout: 90000 });
  await expect(detail.locator('.notice.error')).toHaveCount(0);
  await expect(detail.getByText('ขั้นตอนผลิต', { exact: true })).toBeVisible();
});
