import {expect,test} from '@playwright/test';
import {mkdirSync} from 'node:fs';

test('Quotation separates commercial terms, locks company VAT and fits four viewports',async({page})=>{
 const username=process.env['SALES_TEST_USERNAME'],password=process.env['SALES_TEST_PASSWORD'];
 if(!username||!password)throw new Error('Provide private Sales test credentials.');
 await page.goto('/login');await page.getByLabel('USERNAME',{exact:true}).fill(username);await page.getByLabel('PASSWORD',{exact:true}).fill(password);
 await page.locator('.login-submit').click();await expect(page).toHaveURL(/\/sales$/);
 await page.getByRole('button',{name:'สร้างใบเสนอราคา',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'สร้างใบเสนอราคา',exact:true});
 await dialog.locator('app-customer-picker input').fill('');await dialog.locator('app-customer-picker input').focus();
 await dialog.locator('.customer-options button').first().click();await expect(dialog.locator('.selected-customer')).toBeVisible();
 await dialog.locator('[formControlName=number]').fill('PREVIEW-ONLY');await dialog.locator('[formControlName=validUntil]').fill('2099-12-31');
 await expect(dialog.locator('[formControlName=vatRate]')).toHaveAttribute('readonly','');
 for(const name of ['เงื่อนไขชำระเงิน','กำหนดส่งมอบ','สถานที่ส่งมอบ','ค่าขนส่ง / เงื่อนไขการจัดส่ง','หมายเหตุเพิ่มเติม'])
  await expect(dialog.getByLabel(name,{exact:true})).toBeEditable();
 await dialog.getByRole('button',{name:'Made By Order',exact:true}).click();
 await expect(dialog.getByLabel('รหัสสินค้า (ถ้ามี)',{exact:true})).toBeEmpty();
 await dialog.getByLabel('รายละเอียด / Requirement',{exact:true}).fill('งานพับเหล็กตามแบบลูกค้า');
 await expect(dialog.getByRole('button',{name:'บันทึกร่าง',exact:true})).toBeEnabled();
 for(const [width,height] of [[1920,1080],[1194,834],[834,1194],[390,844]]){
  await page.setViewportSize({width,height});await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(process.env['SALES_TEST_ARTIFACTS']){mkdirSync(process.env['SALES_TEST_ARTIFACTS'],{recursive:true});await page.screenshot({path:`${process.env['SALES_TEST_ARTIFACTS']}/quotation-form-${width}x${height}.png`});}
 }
 await dialog.getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(dialog).not.toBeVisible();
});
