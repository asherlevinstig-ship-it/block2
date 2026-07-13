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

const CLIENTS = Number(process.env.SOAK_CLIENTS || 32);
const SHARD_CAP = Number(process.env.SOAK_SHARD_CAP || 8);
const DUNGEONS = Number(process.env.SOAK_DUNGEONS || 2);
const PARTY_SIZE = Number(process.env.SOAK_PARTY_SIZE || 8);
const DUNGEON_CLIENTS = DUNGEONS * PARTY_SIZE;
const PORT = Number(process.env.SOAK_PORT || 2620);
const DURATION_MS = Number(process.env.SOAK_DURATION_MS || 60_000);
const STEP_MS = 100;
const endpoint = 'ws://127.0.0.1:' + PORT;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

assert.ok(CLIENTS > 0, 'SOAK_CLIENTS must be positive');
assert.ok(SHARD_CAP > 0, 'SOAK_SHARD_CAP must be positive');
assert.ok(PARTY_SIZE > 0 && PARTY_SIZE <= 8, 'SOAK_PARTY_SIZE must be between 1 and 8');
assert.ok(DUNGEON_CLIENTS <= CLIENTS, 'SOAK_DUNGEONS * SOAK_PARTY_SIZE cannot exceed SOAK_CLIENTS');

function shardId(index) {
  return index === 0 ? 'main' : 'shard-' + (index + 1);
}

async function seed(dataDir) {
  const auth = new AuthService(dataDir), store = new JsonStore(dataDir), accounts = [];
  for (let i = 0; i < CLIENTS; i++) {
    const account = await auth.register('soak_user_' + i, 'load test password ' + i, 'Soak' + i);
    const sid = await auth.issueSession(account);
    accounts.push({ cookie: 'bc_session=' + encodeURIComponent(sid), token: account.id, name: 'Soak' + i });
    const profile = defaultProfile('Soak' + i), x = 18 + (i % SHARD_CAP) * 4, z = 18 + Math.floor(i / SHARD_CAP) * 7;
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

async function waitFor(fn, label, timeout = 6000, step = 50) {
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
    id: 'soak-dungeon-' + index,
    seed: 7000 + index * 131,
    dungeonId: 'abandoned_mine',
    rank: index % 2,
    kind: 'public',
    x: 28.5 + index * 4,
    y: 60,
    z: 28.5 + index * 4,
  };
}

function firstMob(room) {
  if (!room.state.mobs) return null;
  for (const mob of room.state.mobs.values()) if (mob && mob.hp > 0) return mob;
  return null;
}

function attachCounters(session, counters) {
  session.room.onMessage('*', () => {});
  for (const type of ['editReject', 'abilityReject', 'dungeonEditReject', 'commsReject']) {
    session.room.onMessage(type, () => counters.rejects++);
  }
  session.room.onLeave(() => {
    if (!session.switching) counters.unexpectedLeaves++;
  });
}

function activeRoomGroups(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    if (!session.room) continue;
    const entry = groups.get(session.room.roomId) || { room: session.room, sessions: [] };
    entry.sessions.push(session);
    groups.set(session.room.roomId, entry);
  }
  return groups;
}

function summarizeShards(sessions) {
  const groups = new Map();
  for (const session of sessions.filter(s => s.mode === 'overworld')) {
    const entry = groups.get(session.room.roomId) || { shardId: session.shardId, room: session.room, clients: 0 };
    entry.clients++;
    groups.set(session.room.roomId, entry);
  }
  return [...groups.values()].map(entry => ({
    shardId: entry.shardId,
    roomId: entry.room.roomId,
    clients: entry.clients,
    statePlayers: entry.room.state.players.size,
  })).sort((a, b) => a.shardId.localeCompare(b.shardId));
}

function summarizeDungeons(sessions) {
  const groups = new Map();
  for (const session of sessions.filter(s => s.mode === 'dungeon')) {
    const entry = groups.get(session.room.roomId) || { gateId: session.gate.id, room: session.room, clients: 0 };
    entry.clients++;
    groups.set(session.room.roomId, entry);
  }
  return [...groups.values()].map(entry => ({
    gateId: entry.gateId,
    roomId: entry.room.roomId,
    clients: entry.clients,
    statePlayers: entry.room.state.players.size,
    mobs: entry.room.state.mobs ? entry.room.state.mobs.size : 0,
  })).sort((a, b) => a.gateId.localeCompare(b.gateId));
}

async function switchRoom(session, roomName, options, counters) {
  session.switching = true;
  if (session.room) await session.room.leave().catch(() => {});
  session.room = await session.client.joinOrCreate(roomName, { name: session.account.name, ...options });
  session.switching = false;
  attachCounters(session, counters);
  return session.room;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-online-soak-'));
  const accounts = await seed(dataDir);
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  process.env.BLOCKCRAFT_SHARD_MAX_CLIENTS = String(SHARD_CAP);
  require('../server/index.js');
  await wait(750);

  const counters = { messages: 0, rejects: 0, unexpectedLeaves: 0, transitions: 0 };
  const sessions = [];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const client = new Client(endpoint, { headers: { Cookie: account.cookie } });
    const shard = shardId(Math.floor(i / SHARD_CAP));
    const room = await client.joinOrCreate('blockcraft', { name: account.name, shardId: shard });
    const session = { account, client, room, shardId: shard, originalShardId: shard, mode: 'overworld', switching: false };
    attachCounters(session, counters);
    sessions.push(session);
  }

  await waitFor(() => {
    const shards = summarizeShards(sessions);
    return shards.length >= Math.ceil(CLIENTS / SHARD_CAP) && shards.every(shard => shard.clients === shard.statePlayers);
  }, 'initial overworld shards to sync');

  const dungeonSessions = sessions.slice(0, DUNGEON_CLIENTS);
  for (let d = 0; d < DUNGEONS; d++) {
    const party = dungeonSessions.slice(d * PARTY_SIZE, (d + 1) * PARTY_SIZE);
    const gate = gateFor(d);
    const ticket = issueDungeonAdmission(gate, party.map(session => session.account.token));
    for (const session of party) {
      await switchRoom(session, 'dungeon', { gateId: gate.id, ticket }, counters);
      session.mode = 'dungeon';
      session.gate = gate;
      counters.transitions++;
    }
  }

  await waitFor(() => {
    const dungeons = summarizeDungeons(sessions);
    if (dungeons.length !== DUNGEONS) return false;
    return dungeons.every(dungeon => dungeon.clients === PARTY_SIZE && dungeon.statePlayers === PARTY_SIZE && dungeon.mobs > 0);
  }, 'dungeon parties to sync');

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const memoryStart = process.memoryUsage().heapUsed, started = performance.now();
  let tick = 0;
  while (performance.now() - started < DURATION_MS) {
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i], room = session.room, me = room && room.state.players.get(room.sessionId);
      if (!me) continue;
      const angle = tick * 0.08 + i * Math.PI * 2 / CLIENTS;
      room.send('move', { x: me.x + Math.cos(angle) * 0.55, y: me.y, z: me.z + Math.sin(angle) * 0.55, yaw: angle }); counters.messages++;
      if (session.mode === 'dungeon') {
        if (tick % 2 === 0) {
          const mob = firstMob(room);
          room.send('attack', { id: mob ? mob.id : 'missing-soak-target' }); counters.messages++;
        }
        if (tick % 12 === 0) {
          const mob = firstMob(room);
          room.send('ability', { slot: 0, id: mob ? mob.id : 'missing-soak-target' }); counters.messages++;
        }
      } else {
        if (tick % 4 === 0) { room.send('attack', { id: 'missing-soak-overworld-target' }); counters.messages++; }
        if (tick % 25 === 0) { room.send('save', { name: session.account.name }); counters.messages++; }
      }
    }
    tick++;
    await wait(STEP_MS);
  }

  for (const session of dungeonSessions) {
    await switchRoom(session, 'blockcraft', { shardId: session.originalShardId }, counters);
    session.mode = 'overworld';
    session.shardId = session.originalShardId;
    session.gate = null;
    counters.transitions++;
  }

  await waitFor(() => {
    const shards = summarizeShards(sessions);
    if (shards.length < Math.ceil(CLIENTS / SHARD_CAP)) return false;
    return shards.every(shard => shard.clients <= SHARD_CAP && shard.clients === shard.statePlayers);
  }, 'returned overworld shards to sync');
  await wait(750);
  loop.disable();

  const finalShards = summarizeShards(sessions);
  const elapsed = performance.now() - started;
  const report = {
    clients: sessions.length,
    shardCap: SHARD_CAP,
    dungeons: DUNGEONS,
    partySize: PARTY_SIZE,
    transitions: counters.transitions,
    finalShards,
    durationMs: Math.round(elapsed),
    messages: counters.messages,
    messagesPerSecond: Math.round(counters.messages / (elapsed / 1000)),
    rejectedMessages: counters.rejects,
    unexpectedLeaves: counters.unexpectedLeaves,
    eventLoopMeanMs: Math.round(loop.mean / 1e4) / 100,
    eventLoopP99Ms: Math.round(loop.percentile(99) / 1e4) / 100,
    eventLoopMaxMs: Math.round(loop.max / 1e4) / 100,
    heapGrowthMb: Math.round((process.memoryUsage().heapUsed - memoryStart) / 1024 / 1024 * 100) / 100,
  };
  console.log('\nMixed online soak test\n' + JSON.stringify(report, null, 2));

  assert.equal(counters.unexpectedLeaves, 0, 'clients disconnected unexpectedly');
  assert.equal(sessions.filter(s => s.mode === 'overworld').length, CLIENTS, 'not every client returned to overworld');
  for (const session of sessions) assert.equal(session.shardId, session.originalShardId, session.account.name + ' returned to the wrong shard');
  for (const shard of finalShards) {
    assert.ok(shard.clients <= SHARD_CAP, 'shard ' + shard.shardId + ' exceeded cap');
    assert.equal(shard.clients, shard.statePlayers, 'shard ' + shard.shardId + ' state player count drifted');
  }
  assert.ok(report.messagesPerSecond >= CLIENTS * 8, 'throughput fell below expected mixed-session rate');
  assert.ok(report.eventLoopP99Ms < Number(process.env.SOAK_MAX_P99_MS || 250), 'event-loop p99 exceeded threshold');
  assert.ok(report.heapGrowthMb < Number(process.env.SOAK_MAX_HEAP_MB || 192), 'heap growth exceeded threshold');

  await Promise.all(sessions.map(session => session.room && session.room.leave().catch(() => {})));
  await shutdown();
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
