import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

test('Sales can prepare PDF, send, attach PO and confirm an order through Backend main',async({page})=>{
  const username=process.env['SALES_TEST_USERNAME'],password=process.env['SALES_TEST_PASSWORD'];
  if(!username||!password)throw new Error('Provide private Sales test credentials.');
  await page.goto('/login');await page.getByLabel('USERNAME',{exact:true}).fill(username);await page.getByLabel('PASSWORD',{exact:true}).fill(password);
  const login=page.waitForResponse(r=>r.url().endsWith('/auth/login/encrypted')&&r.request().method()==='POST');await page.locator('.login-submit').click();const auth=await (await login).json();
  const headers={Authorization:'Bearer '+auth.accessToken,'Idempotency-Key':crypto.randomUUID()};
  const customers=await(await page.request.get('/api/v1/sales-ui/customers',{headers})).json();
  const products=await(await page.request.get('/api/v1/sales-ui/product-revisions',{headers})).json();
  expect(customers.items.length).toBeGreaterThan(0);expect(products.length).toBeGreaterThan(0);
  const customer=customers.items[0],product=products[0];
  const response=await page.request.post('/api/v1/sales-ui/quotations',{headers,data:{number:'UI-LIFECYCLE-'+Date.now(),customerId:customer.id,expectedCustomerVersion:customer.version,quotationDate:'2026-10-15',validUntil:'2099-12-31',vatRate:8.25,currency:'THB',terms:'Net 30',items:[{productRevisionId:product.id,description:product.productName,quantity:2,unit:product.unit,unitPrice:150,discountPercent:0}]}});
  expect(response.status()).toBe(200);const quote=await response.json();
  await page.goto('/sales/'+quote.id);const detail=page.getByRole('dialog',{name:quote.number,exact:true});await expect(detail).toBeVisible();
  const downloadPromise=page.waitForEvent('download',{timeout:45000});await detail.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true}).click();const download=await downloadPromise;
  const file=await download.path();expect(file).toBeTruthy();const artifacts=process.env['SALES_TEST_ARTIFACTS'];if(artifacts){mkdirSync(artifacts,{recursive:true});await download.saveAs(artifacts+'/sales-main-quotation.pdf');}
  await detail.getByRole('button',{name:'ส่งใบเสนอราคา',exact:true}).click();await expect(detail).not.toBeVisible();
  await page.reload();const sent=page.getByRole('dialog',{name:quote.number,exact:true});await expect(sent).toBeVisible();
  await sent.getByLabel('เลขที่ Customer PO',{exact:true}).fill('UI-TEST-PO');await sent.getByLabel('กำหนดส่งสินค้า',{exact:true}).fill('2027-01-31');
  const uploaded=page.waitForResponse(r=>r.url().endsWith('/sales-ui/files')&&r.request().method()==='POST');await sent.locator('input[type=file]').setInputFiles(file!);expect((await uploaded).status()).toBe(200);
  const accepted=page.waitForResponse(r=>r.url().includes('/quotation-revisions/')&&r.url().endsWith('/accept')&&r.request().method()==='POST');await sent.getByRole('button',{name:'Accepted และสร้าง Sales Order',exact:true}).click();expect((await accepted).status()).toBe(200);
  await expect(sent.getByRole('button',{name:'Accepted และสร้าง Sales Order',exact:true})).not.toBeVisible();
});
