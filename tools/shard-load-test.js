const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const { Client } = require('@colyseus/sdk');
const { AuthService } = require('../server/auth');
const { JsonStore, defaultProfile } = require('../server/store');
const W = require('../server/world');

const CLIENTS = Number(process.env.SHARD_LOAD_CLIENTS || 10);
const SHARD_CAP = Number(process.env.SHARD_LOAD_CAP || 4);
const PORT = Number(process.env.SHARD_LOAD_PORT || 2618);
const DURATION_MS = Number(process.env.SHARD_LOAD_DURATION_MS || 8_000);
const MOB_PRESSURE = process.env.SHARD_LOAD_MOB_PRESSURE === '1';
const MIN_MOBS = Number(process.env.SHARD_LOAD_MIN_MOBS || (MOB_PRESSURE ? 8 : 0));
const STEP_MS = 100;
const endpoint = 'ws://127.0.0.1:' + PORT;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let expectedShardProbeRejects = 0;
const originalConsoleError = console.error;
console.error = (...args) => {
  const text = args.map(arg => String(arg && arg.stack || arg && arg.message || arg)).join(' ');
  if (/Blockcraft overworld shard ".+" is already active/.test(text)) {
    expectedShardProbeRejects++;
    return;
  }
  originalConsoleError(...args);
};

function shardId(index) {
  return index === 0 ? 'main' : 'shard-' + (index + 1);
}

function mobPressureAnchors() {
  const landmarks = W.regionalLandmarkSpecs()
    .filter(s => s && (s.type === 'bandit_camp' || s.type === 'hunter_camp') && s.x > 32 && s.z > 32 && s.x < W.WX - 32 && s.z < W.WX - 32);
  const anchors = landmarks.length ? landmarks : [
    { x: 250, z: 250 },
    { x: 750, z: 250 },
    { x: 250, z: 750 },
    { x: 750, z: 750 },
  ];
  return anchors.slice(0, Math.max(1, Math.ceil(CLIENTS / Math.min(4, Math.max(1, SHARD_CAP)))));
}

async function seed(dataDir) {
  const auth = new AuthService(dataDir), store = new JsonStore(dataDir), cookies = [];
  const anchors = MOB_PRESSURE ? mobPressureAnchors() : [];
  for (let i = 0; i < CLIENTS; i++) {
    const account = await auth.register('shard_load_user_' + i, 'load test password ' + i, 'Shard' + i);
    const sid = await auth.issueSession(account);
    cookies.push('bc_session=' + encodeURIComponent(sid));
    const profile = defaultProfile();
    let x = 20 + (i % SHARD_CAP) * 5, z = 20 + Math.floor(i / SHARD_CAP) * 7;
    if (MOB_PRESSURE) {
      const anchor = anchors[i % anchors.length];
      const slot = Math.floor(i / anchors.length);
      x = Math.max(24, Math.min(W.WX - 24, Math.round(anchor.x + (slot % 2 ? 10 : -10))));
      z = Math.max(24, Math.min(W.WX - 24, Math.round(anchor.z + (slot > 1 ? 10 : -10))));
      profile.S.lvl = 21;
    }
    profile.name = 'Shard' + i;
    profile.pos = [x + 0.5, W.terrainHeight(x, z) + 2, z + 0.5];
    profile.inv[0] = { id: W.B.DIRT, count: 64 };
    await store.savePlayer(account.id, profile);
  }
  auth.stop();
  return cookies;
}

function stateMobs(room) {
  return room && room.state && room.state.mobs && typeof room.state.mobs.values === 'function'
    ? room.state.mobs
    : null;
}

function firstMob(room, me) {
  const mobs = stateMobs(room);
  if (!mobs) return null;
  let best = null, bd = Infinity;
  mobs.forEach((mob, id) => {
    if (!mob || mob.hp <= 0 || mob.dgn) return;
    const d = me ? Math.hypot((mob.x || 0) - me.x, (mob.z || 0) - me.z) : 0;
    if (d < bd) { bd = d; best = { id, mob }; }
  });
  return best;
}

function roomMobReports(rooms) {
  return [...rooms.values()].map(entry => {
    let mobs = 0, hostiles = 0, animals = 0;
    const state = stateMobs(entry.rooms[0]);
    if (state) state.forEach(mob => {
      if (!mob || mob.dgn) return;
      mobs++;
      if (['rabbit', 'deer', 'boar', 'desert_fox', 'snow_hare'].includes(String(mob.kind || ''))) animals++;
      else hostiles++;
    });
    return { shardId: entry.shardId, roomId: entry.rooms[0].roomId, mobs, hostiles, animals };
  }).sort((a, b) => a.shardId.localeCompare(b.shardId));
}

function shutdown() {
  return new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port: PORT, path: '/__e2e/shutdown', method: 'POST' }, response => {
      response.resume(); response.on('end', resolve);
    });
    request.on('error', resolve); request.end();
  });
}

async function joinFirstAvailable(cookie, name) {
  const client = new Client(endpoint, { headers: { Cookie: cookie } });
  let lastError = null;
  for (let i = 0; i < Math.ceil(CLIENTS / SHARD_CAP) + 3; i++) {
    const id = shardId(i);
    try {
      const room = await client.joinOrCreate('blockcraft', { name, shardId: id });
      return { room, shardId: id };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('no shard accepted ' + name);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-shard-load-'));
  const cookies = await seed(dataDir);
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  process.env.BLOCKCRAFT_SHARD_MAX_CLIENTS = String(SHARD_CAP);
  require('../server/index.js');
  await wait(750);

  const sessions = [];
  let messages = 0, rejects = 0;
  for (let i = 0; i < CLIENTS; i++) {
    const session = await joinFirstAvailable(cookies[i], 'Shard' + i);
    session.room.onMessage('*', () => {});
    for (const type of ['editReject', 'abilityReject', 'commsReject']) session.room.onMessage(type, () => rejects++);
    sessions.push(session);
  }
  await wait(1_000);

  const rooms = new Map();
  for (const session of sessions) {
    const entry = rooms.get(session.room.roomId) || { shardId: session.shardId, rooms: [], clients: 0 };
    entry.rooms.push(session.room);
    entry.clients++;
    rooms.set(session.room.roomId, entry);
  }
  const distribution = [...rooms.values()].map(entry => ({
    shardId: entry.shardId,
    roomId: entry.rooms[0].roomId,
    clients: entry.clients,
    statePlayers: entry.rooms[0].state.players.size,
  })).sort((a, b) => a.shardId.localeCompare(b.shardId));

  assert.equal(sessions.length, CLIENTS, 'not every client connected');
  assert.ok(distribution.length >= Math.ceil(CLIENTS / SHARD_CAP), 'clients did not overflow into enough shards');
  for (const shard of distribution) {
    assert.ok(shard.clients <= SHARD_CAP, 'shard ' + shard.shardId + ' exceeded cap');
    assert.equal(shard.clients, shard.statePlayers, 'shard ' + shard.shardId + ' state player count drifted');
  }

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const memoryStart = process.memoryUsage().heapUsed, started = performance.now();
  let tick = 0;
  while (performance.now() - started < DURATION_MS) {
    for (let i = 0; i < sessions.length; i++) {
      const room = sessions[i].room, me = room.state.players.get(room.sessionId);
      if (!me) continue;
      const angle = tick * 0.09 + i * Math.PI * 2 / CLIENTS;
      room.send('move', { x: me.x + Math.cos(angle) * 0.55, y: me.y, z: me.z + Math.sin(angle) * 0.55, yaw: angle }); messages++;
      if (tick % 3 === 0) { room.send('attack', { id: (MOB_PRESSURE && firstMob(room, me) || {}).id || 'missing-shard-load-target' }); messages++; }
      if (tick % 20 === 0) { room.send('save', { name: 'Shard' + i }); messages++; }
    }
    tick++;
    await wait(STEP_MS);
  }
  await wait(750);
  loop.disable();

  const elapsed = performance.now() - started;
  const report = {
    clients: sessions.length,
    shardCap: SHARD_CAP,
    mobPressure: MOB_PRESSURE,
    shards: distribution,
    mobReports: roomMobReports(rooms),
    durationMs: Math.round(elapsed),
    messages,
    messagesPerSecond: Math.round(messages / (elapsed / 1000)),
    rejectedMessages: rejects,
    expectedShardProbeRejects,
    eventLoopMeanMs: Math.round(loop.mean / 1e4) / 100,
    eventLoopP99Ms: Math.round(loop.percentile(99) / 1e4) / 100,
    eventLoopMaxMs: Math.round(loop.max / 1e4) / 100,
    heapGrowthMb: Math.round((process.memoryUsage().heapUsed - memoryStart) / 1024 / 1024 * 100) / 100,
  };
  console.log('\nMulti-shard load test\n' + JSON.stringify(report, null, 2));
  assert.ok(report.messagesPerSecond >= CLIENTS * 10, 'throughput fell below expected movement rate');
  if (MIN_MOBS > 0) assert.ok(report.mobReports.reduce((n, shard) => Math.max(n, shard.mobs), 0) >= MIN_MOBS, 'mob pressure did not create enough overworld mobs');
  assert.ok(report.eventLoopP99Ms < Number(process.env.SHARD_LOAD_MAX_P99_MS || 250), 'event-loop p99 exceeded threshold');
  assert.ok(report.heapGrowthMb < Number(process.env.SHARD_LOAD_MAX_HEAP_MB || 128), 'heap growth exceeded threshold');

  await Promise.all(sessions.map(session => session.room.leave().catch(() => {})));
  await shutdown();
}

main().catch(async error => {
  originalConsoleError(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
