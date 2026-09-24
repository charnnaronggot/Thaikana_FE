import { test, expect } from '@playwright/test';
test('AC01 AC04 Sales creates two products and archives a real quotation PDF', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /^sales/ }).click();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ Demo' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/sales/new');
  await page.getByLabel('ลูกค้า *').fill('Browser Buyer');
  await page.getByLabel('กำหนดส่ง *').fill('2026-10-15');
  await page.getByLabel('ใบเสนอราคามีผลถึง *').fill('2026-10-01');
  await page.getByRole('button', { name: 'สร้างเอกสารและเพิ่มสินค้า' }).click();
  await expect(page.getByRole('heading', { name: /QT-/ })).toBeVisible();
  for (const qty of [12, 1]) {
    await page.getByRole('button', { name: /เพิ่มสินค้า/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('ประเภทสินค้า').selectOption('Existing');
    await dialog.getByLabel('เลือกสินค้าที่พร้อมผลิต').selectOption('rev-cabinet-1');
    await dialog.getByLabel('จำนวน *').fill(String(qty));
    await dialog.getByLabel('ราคาต่อหน่วย').fill('32000');
    await dialog.getByLabel('ส่วนลด %').fill('5');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.getByText('รายการสินค้า (2)')).toBeVisible();
  await page.getByRole('button', { name: 'ตรวจข้อมูลและส่ง Design' }).click();
  await expect(page.getByRole('button', { name: 'ออก PDF และส่งลูกค้า' })).toBeVisible();
  await page.getByRole('button', { name: 'ออก PDF และส่งลูกค้า' }).click();
  await expect(page.getByRole('button', { name: 'เปิด PDF ที่ออกแล้ว' })).toBeVisible({
    timeout: 30000,
  });
  const doc = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('thaikana-demo-v1', 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return new Promise<{ kind: string; size: number; type: string }>((resolve, reject) => {
      const tx = db.transaction('state', 'readonly');
      const r = tx.objectStore('state').get('current');
      r.onsuccess = () => {
        const s = r.result;
        const d = s.documents.find((x: { kind: string }) => x.kind === 'Quotation');
        const a = s.assets.find((x: { id: string }) => x.id === d.assetId);
        resolve({ kind: d.kind, size: a.blob.size, type: a.blob.type });
      };
      r.onerror = () => reject(r.error);
    });
  });
  expect(doc.kind).toBe('Quotation');
  expect(doc.type).toBe('application/pdf');
  expect(doc.size).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'บันทึกผลตอบรับลูกค้า' }).click();
  await page.getByRole('dialog').getByLabel('หลักฐานการยอมรับ / เอกสารอ้างอิง').fill('Signed PO');
  await page.getByRole('dialog').getByLabel('Customer PO').fill('PO-BROWSER');
  await page.getByRole('dialog').getByRole('button', { name: 'บันทึกผลตอบรับ' }).click();
  await expect(page.getByRole('link', { name: /ส่งต่อ Planning/ })).toBeVisible();
});
