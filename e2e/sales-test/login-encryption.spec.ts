import { expect, test } from '@playwright/test';

test('Login encrypts credentials, rejects replay, and preserves refresh', async ({page}) => {
  const username=process.env['SALES_TEST_USERNAME'],password=process.env['SALES_TEST_PASSWORD'];
  if(!username||!password)throw new Error('Provide private Sales test credentials.');
  await page.goto('/login');
  await page.getByLabel('USERNAME',{exact:true}).fill(username);
  await page.getByLabel('PASSWORD',{exact:true}).fill(password);
  const loggedIn=page.waitForResponse(r=>r.url().endsWith('/auth/login/encrypted'));
  await page.locator('.login-submit').click();
  const response=await loggedIn;
  expect(response.status()).toBe(200);
  const payload=response.request().postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(['challengeId','ciphertext','encryptedKey','iv']);
  expect(JSON.stringify(payload)).not.toContain(password);
  expect(JSON.stringify(payload)).not.toContain(username);
  await expect(page).toHaveURL(/\/sales$/);
  const replay=await page.request.post('/api/v1/auth/login/encrypted',{data:payload});
  expect(replay.status()).toBe(400);
  expect((await replay.json()).code).toBe('login_encryption_invalid');
  await page.reload();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page).toHaveURL(/\/sales$/);
});
