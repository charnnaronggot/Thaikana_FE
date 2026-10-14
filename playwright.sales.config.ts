import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/sales-test', workers: 1, timeout: 60000,
  use: { baseURL: process.env['SALES_TEST_URL'] ?? 'https://localhost:4240', ignoreHTTPSErrors: true },
  reporter: [['list']],
});
