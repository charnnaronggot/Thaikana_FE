import { defineConfig } from 'vitest/config';
// Angular services use TypeScript (legacy) parameter-less decorators such as @Injectable; lower them so the logic can be unit-tested in node.
export default defineConfig({
  oxc: { decorator: { legacy: true } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
