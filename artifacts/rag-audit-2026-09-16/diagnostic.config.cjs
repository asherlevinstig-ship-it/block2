const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'late-rank-diagnostic.spec.cjs',
  outputDir: './diagnostic-results',
  reporter: 'list', workers: 1, retries: 0,
  expect: { timeout: 15000 },
  globalSetup: require.resolve('../../e2e/global-setup.cjs'),
  use: { baseURL: 'http://127.0.0.1:2607', headless: true, viewport: { width: 800, height: 600 } },
});
