import { test, expect, Page } from '@playwright/test';
async function stationLogin(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /^station/ }).click();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ Demo' }).click();
  await expect(page).toHaveURL(/\/station$/);
}
test('AC08 AC11 two tabs cannot Start the same WO twice', async ({ context, page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /^station/ })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('thaikana-demo-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      const get = store.get('current');
      get.onsuccess = () => {
        const state = get.result;
        state.workOrders.find((w: { id: string }) => w.id === 'wo-demo-1').issued['mat-steel'] = 16;
        state.version++;
        store.put(state, 'current');
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await stationLogin(page);
  const other = await context.newPage();
  await stationLogin(other);
  await page.reload();
  await expect(page.locator('.job-card').filter({ hasText: 'WO-260922-001' })).toBeVisible();
  for (const tab of [page, other]) {
    await tab
      .locator('.job-card')
      .filter({ hasText: 'WO-260922-001' })
      .getByRole('button', { name: 'Start' })
      .click();
    await tab.getByRole('dialog').getByLabel('Username ของผู้ทำงาน').fill('somchai');
    await tab.getByRole('dialog').getByLabel('Password').fill('demo');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/screenshots/station-dialog-390.png' });
  await page.getByRole('dialog').getByRole('button', { name: 'ยืนยัน start' }).click();
  await expect(page.locator('.job-card').filter({ hasText: 'WO-260922-001' })).toContainText(
    'Running',
  );
  await other.getByRole('dialog').getByRole('button', { name: 'ยืนยัน start' }).click();
  await expect(other.getByRole('alert').first()).toContainText('ข้อมูลเปลี่ยน');
  const executions = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('thaikana-demo-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise<number>((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get('current');
      request.onsuccess = () =>
        resolve(
          request.result.executions.filter((x: { woId: string }) => x.woId === 'wo-demo-1').length,
        );
      request.onerror = () => reject(request.error);
    });
  });
  expect(executions).toBe(1);
});
