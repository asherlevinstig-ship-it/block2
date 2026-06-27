const { defineConfig } = require('@playwright/test');

const PORT = 2607;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  workers: 1,
  globalSetup: require.resolve('./e2e/global-setup.cjs'),
  use: { baseURL: `http://127.0.0.1:${PORT}`, headless: true },
});
