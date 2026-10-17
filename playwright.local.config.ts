import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e/local-workspace',
  workers: 1,
  timeout: 180000,
  expect: { timeout: 15000 },
  use: { baseURL: process.env['LOCAL_TEST_URL'] ?? 'http://localhost:4240' },
  reporter: [['list']],
  outputDir: 'test-results/local-workspace',
});
