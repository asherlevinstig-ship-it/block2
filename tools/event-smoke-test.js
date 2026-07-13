const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@colyseus/sdk');

const PORT = Number(process.env.EVENT_SMOKE_PORT || 2627);
const BASE = 'http://127.0.0.1:' + PORT;
const ENDPOINT = 'ws://127.0.0.1:' + PORT;
const PASSWORD = 'event smoke password';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function requestJson(pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(pathname + ' failed: ' + res.statusCode + ' ' + data));
        }
        resolve({ body: data ? JSON.parse(data) : {}, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

function shutdown() {
  return new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/__e2e/shutdown', method: 'POST' }, res => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', resolve);
    req.end();
  });
}

async function waitForServer(timeout = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/', method: 'GET' }, res => {
          res.resume();
          res.on('end', resolve);
        });
        req.on('error', reject);
        req.end();
      });
      return;
    } catch (_) {
      await wait(100);
    }
  }
  throw new Error('server did not become reachable on ' + BASE);
}

async function register(username, displayName) {
  const res = await requestJson('/auth/register', { username, password: PASSWORD, displayName });
  const cookie = String((res.headers['set-cookie'] || [])[0] || '').split(';')[0];
  if (!/^bc_session=/.test(cookie)) throw new Error('register did not return a bc_session cookie for ' + username);
  return cookie;
}

async function makeUser(label, suffix) {
  const username = ('event_' + label + '_' + suffix).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
  const cookie = await register(username, label);
  const client = new Client(ENDPOINT, { headers: { Cookie: cookie } });
  const room = await client.joinOrCreate('blockcraft', { name: label });
  const seen = [];
  const waiters = [];

  function record(type, msg) {
    if (type.startsWith('event')) seen.push({ type, msg });
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(type, msg)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve({ type, msg });
    }
  }

  for (const type of ['eventStatus', 'eventJoined', 'eventLeft', 'eventReject', 'eventStarted', 'eventReady', 'eventGo', 'eventAfk', 'eventCancelled', 'eventTeleport']) {
    room.onMessage(type, msg => record(type, msg));
  }
  room.onMessage('*', () => {});

  function waitFor(predicate, labelText, timeout = 15000) {
    const existing = seen.find(e => predicate(e.type, e.msg));
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve };
      waiters.push(waiter);
      setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        const recent = seen.slice(-8).map(e => ({
          type: e.type,
          phase: e.msg && e.msg.phase,
          reason: e.msg && e.msg.reason,
          joined: e.msg && e.msg.joined,
          ready: e.msg && e.msg.ready,
          readyCount: e.msg && e.msg.readyCount,
          queueSize: e.msg && e.msg.queueSize,
        }));
        reject(new Error(label + ' timed out waiting for ' + labelText + '. Recent events: ' + JSON.stringify(recent)));
      }, timeout);
    });
  }

  return { label, username, room, seen, waitFor };
}

async function main() {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-event-smoke-'));
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  process.env.BLOCKCRAFT_BETA_TEST = '1';
  require('../server/index.js');
  await waitForServer();

  const suffix = Date.now().toString(36);
  const alpha = await makeUser('Alpha', suffix);
  const bravo = await makeUser('Bravo', suffix);
  await wait(750);

  alpha.room.send('eventDebugStart', {});
  const aQueue = await alpha.waitFor((type, msg) => type === 'eventJoined' && msg && msg.phase === 'queue' && msg.joined, 'Alpha auto-join queue');
  await bravo.waitFor((type, msg) => type === 'eventStatus' && msg && msg.phase === 'queue', 'Bravo sees open queue');

  bravo.room.send('eventJoin', {});
  const bJoined = await bravo.waitFor((type, msg) => type === 'eventJoined' && msg && msg.joined && msg.queueSize >= 2, 'Bravo joins queue');
  const aSawTwo = await alpha.waitFor((type, msg) => type === 'eventStatus' && msg && msg.phase === 'queue' && msg.queueSize >= 2, 'Alpha sees two queued');

  const aStarted = await alpha.waitFor((type, msg) => type === 'eventStarted' && msg && msg.phase === 'starting', 'Alpha enters staging');
  const bStarted = await bravo.waitFor((type, msg) => type === 'eventStarted' && msg && msg.phase === 'starting', 'Bravo enters staging');

  alpha.room.send('eventReady', {});
  const aReady = await alpha.waitFor((type, msg) => type === 'eventReady' && msg && msg.ready, 'Alpha ready acknowledgement');
  const bMixed = await bravo.waitFor((type, msg) => type === 'eventStatus' && msg && msg.phase === 'starting'
    && Array.isArray(msg.stagingRoster)
    && msg.stagingRoster.some(row => row.name === 'Alpha' && row.ready)
    && msg.stagingRoster.some(row => row.name === 'Bravo' && !row.ready), 'Bravo sees mixed ready roster');

  bravo.room.send('eventReady', {});
  const bReady = await bravo.waitFor((type, msg) => type === 'eventReady' && msg && msg.ready, 'Bravo ready acknowledgement');
  const aAllReady = await alpha.waitFor((type, msg) => type === 'eventStatus' && msg && msg.phase === 'starting' && msg.readyCount >= 2 && msg.goAt, 'all-ready countdown');
  const aGo = await alpha.waitFor((type, msg) => type === 'eventGo' && msg && msg.phase === 'active', 'Alpha event GO');
  const bGo = await bravo.waitFor((type, msg) => type === 'eventGo' && msg && msg.phase === 'active', 'Bravo event GO');

  const summary = {
    users: [alpha.username, bravo.username],
    event: { kind: aGo.msg.kind, name: aGo.msg.name },
    queue: {
      alphaAutoJoined: { phase: aQueue.msg.phase, joined: aQueue.msg.joined, queueSize: aQueue.msg.queueSize },
      bravoJoined: { joined: bJoined.msg.joined, queueSize: bJoined.msg.queueSize },
      alphaSawTwo: { queueSize: aSawTwo.msg.queueSize, capacity: aSawTwo.msg.queueCapacity },
    },
    staging: {
      alphaStarted: { phase: aStarted.msg.phase, participantCount: aStarted.msg.participantCount, roster: aStarted.msg.stagingRoster.map(row => ({ name: row.name, ready: row.ready })) },
      bravoStarted: { phase: bStarted.msg.phase, participantCount: bStarted.msg.participantCount, roster: bStarted.msg.stagingRoster.map(row => ({ name: row.name, ready: row.ready })) },
      alphaReady: { ready: aReady.msg.ready, readyCount: aReady.msg.readyCount, roster: aReady.msg.stagingRoster.map(row => ({ name: row.name, ready: row.ready })) },
      mixedRosterForBravo: bMixed.msg.stagingRoster.map(row => ({ name: row.name, ready: row.ready })),
      bravoReady: { ready: bReady.msg.ready, readyCount: bReady.msg.readyCount },
      allReady: { readyCount: aAllReady.msg.readyCount, participantCount: aAllReady.msg.participantCount, hasGoAt: !!aAllReady.msg.goAt },
    },
    go: {
      alpha: { phase: aGo.msg.phase, participating: aGo.msg.participating, kind: aGo.msg.kind },
      bravo: { phase: bGo.msg.phase, participating: bGo.msg.participating, kind: bGo.msg.kind },
    },
  };

  assert.equal(summary.queue.bravoJoined.queueSize >= 2, true, 'queue did not reach two players');
  assert.equal(summary.staging.mixedRosterForBravo.some(row => row.name === 'Alpha' && row.ready), true, 'Bravo did not see Alpha ready');
  assert.equal(summary.staging.mixedRosterForBravo.some(row => row.name === 'Bravo' && !row.ready), true, 'Bravo did not see itself waiting');
  assert.equal(summary.staging.allReady.readyCount, 2, 'all-ready count did not reach two');
  assert.equal(summary.staging.allReady.hasGoAt, true, 'all-ready countdown did not arm goAt');
  assert.equal(summary.go.alpha.phase, 'active', 'Alpha did not receive GO');
  assert.equal(summary.go.bravo.phase, 'active', 'Bravo did not receive GO');

  await Promise.all([alpha.room.leave().catch(() => {}), bravo.room.leave().catch(() => {})]);
  await shutdown();
  console.log('\nTwo-user event smoke test passed\n' + JSON.stringify(summary, null, 2));
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
