const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const { Client } = require('@colyseus/sdk');
const { AuthService } = require('../server/auth');
const { issueDungeonAdmission } = require('../server/rooms/dungeon-admission');
const { JsonStore, defaultProfile } = require('../server/store');
const W = require('../server/world');

const DUNGEONS = Number(process.env.DUNGEON_LOAD_DUNGEONS || 3);
const PARTY_SIZE = Number(process.env.DUNGEON_LOAD_PARTY_SIZE || 8);
const CLIENTS = DUNGEONS * PARTY_SIZE;
const PORT = Number(process.env.DUNGEON_LOAD_PORT || 2619);
const DURATION_MS = Number(process.env.DUNGEON_LOAD_DURATION_MS || 8_000);
const SPREAD_MODE = process.env.DUNGEON_LOAD_SPREAD === '1';
const REQUIRE_FX_SKIPS = process.env.DUNGEON_LOAD_REQUIRE_FX_SKIPS === '1';
const STEP_MS = 100;
const endpoint = 'ws://127.0.0.1:' + PORT;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

assert.ok(DUNGEONS > 0, 'DUNGEON_LOAD_DUNGEONS must be positive');
assert.ok(PARTY_SIZE > 0 && PARTY_SIZE <= 8, 'DUNGEON_LOAD_PARTY_SIZE must be between 1 and 8');

async function seed(dataDir) {
  const auth = new AuthService(dataDir), store = new JsonStore(dataDir), accounts = [];
  for (let i = 0; i < CLIENTS; i++) {
    const account = await auth.register('dungeon_load_user_' + i, 'load test password ' + i, 'Raider' + i);
    const sid = await auth.issueSession(account);
    accounts.push({ cookie: 'bc_session=' + encodeURIComponent(sid), token: account.id, name: 'Raider' + i });
    const profile = defaultProfile('Raider' + i), x = 18 + (i % PARTY_SIZE) * 3, z = 18 + Math.floor(i / PARTY_SIZE) * 6;
    profile.pos = [x + 0.5, W.terrainHeight(x, z) + 2, z + 0.5];
    profile.inv[0] = { id: W.B.DIRT, count: 64 };
    await store.savePlayer(account.id, profile);
  }
  auth.stop();
  return accounts;
}

function shutdown() {
  return new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port: PORT, path: '/__e2e/shutdown', method: 'POST' }, response => {
      response.resume(); response.on('end', resolve);
    });
    request.on('error', resolve); request.end();
  });
}

async function waitFor(fn, label, timeout = 5000, step = 50) {
  const started = Date.now();
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error('timed out waiting for ' + label);
    await wait(step);
  }
}

function gateFor(index) {
  return {
    id: 'load-dungeon-' + index,
    seed: 1000 + index * 997,
    dungeonId: 'abandoned_mine',
    rank: index % 2,
    kind: 'public',
    x: 24.5 + index * 3,
    y: 60,
    z: 24.5 + index * 3,
  };
}

function roomGroups(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const entry = groups.get(session.room.roomId) || { gateId: session.gate.id, room: session.room, sessions: [] };
    entry.sessions.push(session);
    groups.set(session.room.roomId, entry);
  }
  return groups;
}

function firstMob(room) {
  if (!room.state.mobs) return null;
  for (const mob of room.state.mobs.values()) if (mob && mob.hp > 0) return mob;
  return null;
}

function nearestMob(room, player) {
  let best = null, bestDist = Infinity;
  if (!room.state.mobs || !player) return null;
  for (const mob of room.state.mobs.values()) {
    if (!mob || mob.hp <= 0) continue;
    const d = Math.hypot((mob.x || 0) - player.x, (mob.z || 0) - player.z);
    if (d < bestDist) { best = mob; bestDist = d; }
  }
  return best;
}

let requestSeq = 0;
async function e2e(session, action, payload = {}) {
  const requestId = action + '-' + (++requestSeq);
  session.room.send('e2eJourney', { ...payload, action, requestId });
  return waitFor(() => session.e2eResults.get(requestId), action + ' result', 3000);
}

async function spreadDungeonParties(groups) {
  const reports = [];
  for (const group of groups.values()) {
    const positioned = await Promise.all(group.sessions.map((session, index) =>
      e2e(session, 'positionDungeonLoadProbe', { index, total: group.sessions.length })));
    for (let i = 0; i < positioned.length; i++) {
      assert.equal(positioned[i].ok, true, 'spread positioning failed for ' + group.gateId);
      group.sessions[i].spreadBase = { x: positioned[i].x, y: positioned[i].y, z: positioned[i].z };
    }
    const near = positioned.slice(0, Math.ceil(positioned.length / 2));
    const far = positioned.slice(Math.ceil(positioned.length / 2));
    let minCrossDistance = Infinity;
    for (const a of near) for (const b of far) minCrossDistance = Math.min(minCrossDistance, Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0)));
    reports.push({ gateId: group.gateId, separation: positioned[0] ? positioned[0].separation : 0, minCrossDistance: Math.round(minCrossDistance * 100) / 100 });
  }
  await wait(500);
  return reports;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-dungeon-load-'));
  const accounts = await seed(dataDir);
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  require('../server/index.js');
  await wait(750);

  const sessions = [];
  let messages = 0, rejects = 0;
  for (let d = 0; d < DUNGEONS; d++) {
    const party = accounts.slice(d * PARTY_SIZE, (d + 1) * PARTY_SIZE);
    const gate = gateFor(d);
    const ticket = issueDungeonAdmission(gate, party.map(account => account.token));
    for (const account of party) {
      const client = new Client(endpoint, { headers: { Cookie: account.cookie } });
      const room = await client.joinOrCreate('dungeon', { gateId: gate.id, ticket, name: account.name });
      room.onMessage('*', () => {});
      for (const type of ['abilityReject', 'dungeonEditReject', 'commsReject']) room.onMessage(type, () => rejects++);
      const e2eResults = new Map();
      room.onMessage('e2eJourneyResult', message => {
        if (message && message.requestId) e2eResults.set(String(message.requestId), message);
      });
      sessions.push({ room, gate, account, e2eResults });
    }
  }

  await waitFor(() => {
    const groups = roomGroups(sessions);
    if (groups.size !== DUNGEONS) return false;
    for (const group of groups.values()) if (group.room.state.players.size !== group.sessions.length) return false;
    return groups;
  }, 'all dungeon parties to sync');

  const groups = roomGroups(sessions);
  const spreadReports = SPREAD_MODE ? await spreadDungeonParties(groups) : [];
  const distribution = [...groups.values()].map(group => ({
    gateId: group.gateId,
    roomId: group.room.roomId,
    clients: group.sessions.length,
    statePlayers: group.room.state.players.size,
    mobs: group.room.state.mobs ? group.room.state.mobs.size : 0,
  })).sort((a, b) => a.gateId.localeCompare(b.gateId));

  assert.equal(sessions.length, CLIENTS, 'not every dungeon client connected');
  assert.equal(distribution.length, DUNGEONS, 'clients did not spread across the expected dungeon rooms');
  for (const dungeon of distribution) {
    assert.equal(dungeon.clients, PARTY_SIZE, 'dungeon ' + dungeon.gateId + ' did not fill its party');
    assert.ok(dungeon.clients <= 8, 'dungeon ' + dungeon.gateId + ' exceeded the 8-player cap');
    assert.equal(dungeon.clients, dungeon.statePlayers, 'dungeon ' + dungeon.gateId + ' state player count drifted');
    assert.ok(dungeon.mobs > 0, 'dungeon ' + dungeon.gateId + ' spawned no mobs');
  }

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const memoryStart = process.memoryUsage().heapUsed, started = performance.now();
  let tick = 0;
  while (performance.now() - started < DURATION_MS) {
    for (let i = 0; i < sessions.length; i++) {
      const room = sessions[i].room, me = room.state.players.get(room.sessionId);
      if (!me) continue;
      const angle = tick * 0.11 + i * Math.PI * 2 / Math.max(1, CLIENTS);
      const base = sessions[i].spreadBase || me;
      const radius = SPREAD_MODE ? 0.55 : 0.6;
      room.send('move', { x: base.x + Math.cos(angle) * radius, y: base.y || me.y, z: base.z + Math.sin(angle) * radius, yaw: angle }); messages++;
      if (SPREAD_MODE && tick % 5 === 0 && i % PARTY_SIZE < Math.ceil(PARTY_SIZE / 2)) {
        room.send('e2eJourney', { action: 'emitDungeonLoadFx', requestId: 'fx-' + tick + '-' + i }); messages++;
      }
      if (tick % 2 === 0) {
        const mob = SPREAD_MODE ? nearestMob(room, me) : firstMob(room);
        room.send('attack', { id: mob ? mob.id : 'missing-dungeon-load-target' }); messages++;
      }
      if (tick % 10 === 0) {
        const mob = SPREAD_MODE ? nearestMob(room, me) : firstMob(room);
        room.send('ability', { slot: 0, id: mob ? mob.id : 'missing-dungeon-load-target' }); messages++;
      }
    }
    tick++;
    await wait(STEP_MS);
  }
  await wait(750);
  loop.disable();

  const elapsed = performance.now() - started;
  const report = {
    clients: sessions.length,
    dungeons: DUNGEONS,
    partySize: PARTY_SIZE,
    spreadMode: SPREAD_MODE,
    spreadReports,
    rooms: distribution,
    durationMs: Math.round(elapsed),
    messages,
    messagesPerSecond: Math.round(messages / (elapsed / 1000)),
    rejectedMessages: rejects,
    eventLoopMeanMs: Math.round(loop.mean / 1e4) / 100,
    eventLoopP99Ms: Math.round(loop.percentile(99) / 1e4) / 100,
    eventLoopMaxMs: Math.round(loop.max / 1e4) / 100,
    heapGrowthMb: Math.round((process.memoryUsage().heapUsed - memoryStart) / 1024 / 1024 * 100) / 100,
  };
  console.log('\nMulti-dungeon load test\n' + JSON.stringify(report, null, 2));

  for (const group of roomGroups(sessions).values()) {
    assert.equal(group.room.state.players.size, group.sessions.length, 'clients disconnected from ' + group.gateId);
  }
  assert.ok(report.messagesPerSecond >= CLIENTS * 8, 'throughput fell below expected dungeon traffic rate');
  assert.ok(report.eventLoopP99Ms < Number(process.env.DUNGEON_LOAD_MAX_P99_MS || 250), 'event-loop p99 exceeded threshold');
  assert.ok(report.heapGrowthMb < Number(process.env.DUNGEON_LOAD_MAX_HEAP_MB || 128), 'heap growth exceeded threshold');
  if (REQUIRE_FX_SKIPS) {
    const metrics = await new Promise(resolve => {
      const request = http.get({ host: '127.0.0.1', port: PORT, path: '/__metrics', timeout: 750 }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => {
          try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); }
          catch (_) { resolve(null); }
        });
      });
      request.on('error', () => resolve(null));
      request.on('timeout', () => { request.destroy(); resolve(null); });
    });
    assert.ok(metrics && metrics.totals && metrics.totals.dungeonFxSkipped > 0, 'spread dungeon load did not skip any positioned FX fanout');
  }

  await Promise.all(sessions.map(session => session.room.leave().catch(() => {})));
  await shutdown();
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
