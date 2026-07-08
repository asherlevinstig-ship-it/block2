const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateStartup, parseTrustProxy } = require('../startup-config');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bc-startup-'));
const productionEnv = overrides => ({ NODE_ENV: 'production', PUBLIC_URL: 'https://play.example.test', TRUST_PROXY: '1', DATA_DIR: tempDir(), STORE: 'json', ...overrides });

test('production accepts explicit HTTPS proxy and writable JSON storage', async () => {
  const config = await validateStartup(productionEnv());
  assert.equal(config.production, true);
  assert.equal(config.trustProxy, 1);
  assert.equal(config.storage, 'json');
});

test('production rejects unsafe HTTPS and proxy configuration', async () => {
  await assert.rejects(() => validateStartup(productionEnv({ PUBLIC_URL: 'http://play.example.test' })), /must use HTTPS/);
  await assert.rejects(() => validateStartup(productionEnv({ TRUST_PROXY: '' })), /TRUST_PROXY must declare/);
  await assert.rejects(() => validateStartup(productionEnv({ TRUST_PROXY: '0' })), /hop count must be/);
  await assert.rejects(() => validateStartup(productionEnv({ TRUST_PROXY: 'true' })), /trusts arbitrary/);
  assert.equal(parseTrustProxy('loopback, linklocal, uniquelocal'), 'loopback, linklocal, uniquelocal');
});

test('production rejects unsafe flags and unsupported storage', async () => {
  await assert.rejects(() => validateStartup(productionEnv({ DEV_CHEATS: '1' })), /must not be enabled/);
  await assert.rejects(() => validateStartup(productionEnv({ STORE: 'sqlite' })), /STORE must be/);
});

test('Firebase production validates credential secrets', async () => {
  await assert.rejects(() => validateStartup(productionEnv({ STORE: 'firebase' })), /requires FIREBASE_SERVICE_ACCOUNT/);
  await assert.rejects(() => validateStartup(productionEnv({ STORE: 'firebase', FIREBASE_SERVICE_ACCOUNT: '{}' })), /missing service-account field/);
});

test('startup rejects an unwritable data path', async () => {
  const file = path.join(tempDir(), 'not-a-directory');
  fs.writeFileSync(file, 'occupied');
  await assert.rejects(() => validateStartup({ DATA_DIR: file }), /DATA_DIR is not writable/);
});
