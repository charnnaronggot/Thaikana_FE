import {expect,test,Page} from '@playwright/test';
async function login(page:Page,username:string,path:RegExp){
 const password=process.env['LOCAL_TEST_PASSWORD'];if(!password)throw new Error('Provide private LOCAL_TEST_PASSWORD.');
 await page.goto('/login');await page.getByLabel('USERNAME',{exact:true}).fill(username);await page.getByLabel('PASSWORD',{exact:true}).fill(password);
 const response=page.waitForResponse(r=>r.url().endsWith('/auth/login/encrypted'),{timeout:90000});await page.locator('.login-submit').click();expect((await response).status()).toBe(200);await expect(page).toHaveURL(path);
 await expect(page.locator('main .loading-state')).toHaveCount(0,{timeout:120000});
}
test('Design opens real revision, BOM and authenticated drawing',async({page})=>{
 await login(page,'dev-design',/\/design$/);
 await expect(page.getByText('กำลังโหลดงานออกแบบ…',{exact:true})).toHaveCount(0,{timeout:120000});
 await expect(page.locator('main .feedback.error')).toHaveCount(0);
 await page.getByRole('button',{name:'แบบสินค้า',exact:true}).click();
 await page.locator('tbody tr').first().getByRole('button',{name:'เปิดแบบ',exact:true}).click();
 await expect(page).toHaveURL(/\/design\/revisions\//);
 await expect(page.getByText('กำลังโหลดงานออกแบบ…',{exact:true})).toHaveCount(0,{timeout:120000});
 await expect(page.locator('main .feedback.error')).toHaveCount(0);
 await page.getByRole('button',{name:'BOM',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Bill of Materials',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Drawing',exact:true}).click();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด',exact:true}).first().click();expect(await(await downloaded).failure()).toBeNull();
});
test('Inventory stock detail uses server availability and shows base unit',async({page})=>{
 await login(page,'dev-inventory',/\/inventory$/);await expect(page.locator('th').filter({hasText:'หน่วย'})).toBeVisible();
 await page.locator('tbody tr').first().getByRole('button',{name:'ดูรายละเอียด'}).click();const detail=page.getByRole('dialog');await expect(detail.locator('.loading-state')).toHaveCount(0,{timeout:90000});
 await expect(detail.locator('.notice.error')).toHaveCount(0);await expect(detail.getByText('พร้อมใช้หลังหักจอง',{exact:true})).toBeVisible();await expect(detail.getByText('หน่วย',{exact:true})).toBeVisible();
});
