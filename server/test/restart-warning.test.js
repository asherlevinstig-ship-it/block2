const test = require('node:test');
const assert = require('node:assert/strict');
const { restartWarningDelay, warnForRestart } = require('../restart-warning');

test('restart warning delay defaults, clamps, and stays instant in test runs', () => {
  assert.equal(restartWarningDelay({}), 8000);
  assert.equal(restartWarningDelay({ BLOCKCRAFT_RESTART_WARNING_MS: '12000' }), 12000);
  assert.equal(restartWarningDelay({ BLOCKCRAFT_RESTART_WARNING_MS: '99999' }), 15000);
  assert.equal(restartWarningDelay({ BLOCKCRAFT_RESTART_WARNING_MS: '-4' }), 0);
  assert.equal(restartWarningDelay({ NODE_ENV: 'test', BLOCKCRAFT_RESTART_WARNING_MS: '8000' }), 0);
  assert.equal(restartWarningDelay({ BLOCKCRAFT_E2E: '1', BLOCKCRAFT_RESTART_WARNING_MS: '8000' }), 0);
});

test('active rooms warn players, lock matchmaking, flush progress, and honor the countdown', async () => {
  const events = [];
  const makeRoom = name => ({
    clients: [{}],
    broadcast(type, payload) { events.push([name, 'broadcast', type, payload]); },
    async lock() { events.push([name, 'lock']); },
    async flush() { events.push([name, 'flush']); },
  });
  const emptyRoom = {
    clients: [],
    broadcast() { events.push(['empty', 'broadcast']); },
    async lock() { events.push(['empty', 'lock']); },
    async flush() { events.push(['empty', 'flush']); },
  };
  let waited = -1;
  const result = await warnForRestart([makeRoom('world'), makeRoom('dungeon'), emptyRoom], {
    delayMs: 8000,
    now: () => 1000,
    wait: async milliseconds => { waited = milliseconds; },
  });

  assert.deepEqual(result, { rooms: 2, failures: 0, delayMs: 8000 });
  assert.equal(waited, 8000);
  assert.equal(events.filter(event => event[1] === 'broadcast').length, 2);
  assert.equal(events.filter(event => event[1] === 'lock').length, 3);
  assert.equal(events.filter(event => event[1] === 'flush').length, 3);
  const warning = events.find(event => event[1] === 'broadcast');
  assert.equal(warning[2], 'serverRestartWarning');
  assert.equal(warning[3].restartAt, 9000);
  assert.match(warning[3].detail, /progress is being saved/i);
});
