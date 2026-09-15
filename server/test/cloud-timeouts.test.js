const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('cloud startup configures matchmaking timeouts before Colyseus loads', () => {
  const root = path.join(__dirname, '..', '..');
  const launcher = fs.readFileSync(path.join(root, 'server', 'cloud-listen.js'), 'utf8');
  const coreImport = launcher.indexOf("require('@colyseus/tools')");
  assert.ok(coreImport > 0);
  assert.ok(launcher.indexOf('COLYSEUS_PRESENCE_SHORT_TIMEOUT') < coreImport);
  assert.ok(launcher.indexOf('COLYSEUS_MAX_CONCURRENT_CREATE_ROOM_WAIT_TIME') < coreImport);

  const ecosystem = require(path.join(root, 'ecosystem.config.js'));
  const env = ecosystem.apps[0].env;
  assert.equal(Number(env.COLYSEUS_PRESENCE_SHORT_TIMEOUT), 45000);
  assert.equal(Number(env.COLYSEUS_MAX_CONCURRENT_CREATE_ROOM_WAIT_TIME), 45);
});

test('browser join timeout covers a production cold world restore', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'client', 'js', 'network.mjs'), 'utf8');
  assert.match(source, /options\.joinTimeout \| 0 \|\| 45000/);
});
