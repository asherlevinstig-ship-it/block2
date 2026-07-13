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
      sessions.push({ room, gate, account });
    }
  }

  await waitFor(() => {
    const groups = roomGroups(sessions);
    if (groups.size !== DUNGEONS) return false;
    for (const group of groups.values()) if (group.room.state.players.size !== group.sessions.length) return false;
    return groups;
  }, 'all dungeon parties to sync');

  const groups = roomGroups(sessions);
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
      room.send('move', { x: me.x + Math.cos(angle) * 0.6, y: me.y, z: me.z + Math.sin(angle) * 0.6, yaw: angle }); messages++;
      if (tick % 2 === 0) {
        const mob = firstMob(room);
        room.send('attack', { id: mob ? mob.id : 'missing-dungeon-load-target' }); messages++;
      }
      if (tick % 10 === 0) {
        const mob = firstMob(room);
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

  await Promise.all(sessions.map(session => session.room.leave().catch(() => {})));
  await shutdown();
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
