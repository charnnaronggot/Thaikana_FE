import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('Sales forms use Backend main customer, published catalogue, mixed draft and native units', async ({page})=>{
  const username=process.env['SALES_TEST_USERNAME'],password=process.env['SALES_TEST_PASSWORD'];
  if(!username||!password)throw new Error('Provide private SALES_TEST_USERNAME and SALES_TEST_PASSWORD.');
  await page.goto('/');await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.getByLabel('USERNAME',{exact:true}).fill(username);await page.getByLabel('PASSWORD',{exact:true}).fill(password);await page.locator('.login-submit').click();
  await expect(page).toHaveURL(/\/sales$/);
  await page.getByRole('button',{name:'สร้างใบเสนอราคา',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'สร้างใบเสนอราคา',exact:true});await expect(dialog).toBeVisible();
  await dialog.locator('app-customer-picker input').fill('UI-CUSTOMER');
  await dialog.locator('.customer-options button').first().click();
  await expect(dialog.locator('.selected-customer')).toBeVisible();
  await dialog.locator('[formControlName=number]').fill('UI-MAIN-'+Date.now());
  await dialog.locator('[formControlName=validUntil]').fill('2099-12-31');
  await dialog.getByLabel('ที่อยู่',{exact:true}).fill('ที่อยู่ออกเอกสารเฉพาะใบนี้ ไม่เปลี่ยนทะเบียนลูกค้า');
  await dialog.getByRole('button',{name:'สินค้าเดิม',exact:true}).first().click();
  await dialog.locator('app-quotation-product-picker input').fill('UI-FG-BRACKET');
  await dialog.locator('.product-options button').first().click();
  await dialog.getByRole('button',{name:'เพิ่มรายการ',exact:true}).click();
  const mbo=dialog.locator('.form-section').last();
  await mbo.getByLabel('รหัสสินค้า',{exact:true}).fill('UI-MBO-TEST');
  await mbo.getByLabel('รายละเอียด / Requirement',{exact:true}).fill('ถาดสเตนเลสสั่งทำเฉพาะงาน');
  await mbo.getByLabel('หน่วย',{exact:true}).selectOption('PCS');
  await mbo.getByLabel('ราคาต่อหน่วย',{exact:true}).fill('250');
  for(const [width,height] of [[1920,1080],[1194,834],[834,1194],[390,844]]){
    await page.setViewportSize({width,height});await expect(dialog.getByRole('button',{name:'บันทึกร่าง',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const output=process.env['SALES_TEST_ARTIFACTS'];if(output){mkdirSync(output,{recursive:true});await page.screenshot({path:`${output}/sales-main-mixed-${width}x${height}.png`});}
  }
  await expect(dialog.getByRole('button',{name:'บันทึกร่าง',exact:true})).toBeEnabled();
  const saved=page.waitForResponse(r=>r.url().endsWith('/sales-ui/quotations')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();const response=await saved;
  expect(response.status()).toBe(200);const quote=await response.json();expect(quote.items).toHaveLength(2);expect(quote.items[0].productRevisionId).toBeTruthy();expect(quote.items[1].productRevisionId).toBeNull();expect(quote.items[0].unit).toBe('PCS');expect(quote.customerAddress).toContain('เฉพาะใบนี้');
  await expect(dialog).not.toBeVisible();
});
