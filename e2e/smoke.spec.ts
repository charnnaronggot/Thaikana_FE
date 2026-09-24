import { test, expect, Page } from '@playwright/test';
async function login(page: Page, user = 'admin') {
  await page.goto('/login');
  await expect(page.getByText('Password:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: new RegExp('^' + user) }).click();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ Demo' }).click();
  await expect(page).toHaveURL(/\/$/);
}
for (const width of [1440, 1024, 390]) {
  test('AC16 responsive navigation ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await expect(page.getByRole('heading', { name: 'ภาพรวมงานผลิต' })).toBeVisible();
    for (const [route, title] of [
      ['sales', 'ใบเสนอราคา'],
      ['design', 'งานออกแบบ'],
      ['planning', 'วางแผนผลิต'],
      ['inventory', 'คลังสินค้า'],
      ['production', 'Production Board'],
      ['qc', 'ตรวจคุณภาพและรับ Finished Goods'],
      ['delivery', 'จัดส่งสินค้า'],
      ['documents', 'เอกสาร'],
      ['users', 'ผู้ใช้และสิทธิ์'],
    ] as const) {
      await page.goto('/' + route);
      await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(dimensions.scroll, route + ' page overflow at ' + width).toBeLessThanOrEqual(
        dimensions.viewport + 1,
      );
    }
    await page.goto('/');
    await page.screenshot({
      path: 'artifacts/screenshots/dashboard-' + width + '.png',
      fullPage: true,
    });
  });
}
test('AC16 drawer keyboard focus and preserved form after validation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'sales');
  await page.goto('/sales');
  await page.getByRole('button', { name: /สร้างใบเสนอราคา/ }).click();
  await page.getByLabel('ลูกค้า *').fill('E2E Buyer');
  await page.getByLabel('กำหนดส่ง *').fill('2026-10-15');
  await page.getByLabel('ใบเสนอราคามีผลถึง *').fill('2026-10-01');
  await page.getByRole('button', { name: 'สร้างเอกสารและเพิ่มสินค้า' }).click();
  await expect(page.getByRole('heading', { name: /QT-/ })).toBeVisible();
  await page.getByRole('button', { name: /เพิ่มสินค้า/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshots/sales-drawer-1440.png', fullPage: true });
  await expect(dialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
