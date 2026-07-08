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

const CLIENTS = 16;
const PORT = Number(process.env.LOAD_PORT || 2617);
const DURATION_MS = Number(process.env.LOAD_DURATION_MS || 15_000);
const STEP_MS = 100;
const endpoint = 'ws://127.0.0.1:' + PORT;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function seed(dataDir) {
  const auth = new AuthService(dataDir), store = new JsonStore(dataDir), cookies = [];
  for (let i = 0; i < CLIENTS; i++) {
    const account = await auth.register('load_user_' + i, 'load test password ' + i, 'Load' + i);
    const sid = await auth.issueSession(account);
    cookies.push('bc_session=' + encodeURIComponent(sid));
    const profile = defaultProfile(), x = 16 + (i % 8) * 4, z = 16 + Math.floor(i / 8) * 8;
    profile.name = 'Load' + i;
    profile.pos = [x + 0.5, W.terrainHeight(x, z) + 2, z + 0.5];
    profile.inv[0] = { id: W.B.DIRT, count: 64 };
    await store.savePlayer(account.id, profile);
  }
  auth.stop();
  return cookies;
}

function shutdown() {
  return new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port: PORT, path: '/__e2e/shutdown', method: 'POST' }, response => {
      response.resume(); response.on('end', resolve);
    });
    request.on('error', resolve); request.end();
  });
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-load-'));
  const cookies = await seed(dataDir);
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  require('../server/index.js');
  await wait(500);

  const rooms = [];
  let rejects = 0, messages = 0;
  for (let i = 0; i < CLIENTS; i++) {
    const room = await new Client(endpoint, { headers: { Cookie: cookies[i] } }).joinOrCreate('blockcraft', { name: 'Load' + i });
    room.onMessage('*', () => {});
    for (const type of ['editReject', 'abilityReject', 'commsReject']) room.onMessage(type, () => rejects++);
    rooms.push(room);
  }
  await wait(750);
  assert.equal(rooms[0].state.players.size, CLIENTS, 'room did not reach full capacity');

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  const memoryStart = process.memoryUsage().heapUsed, started = performance.now();
  let tick = 0;
  while (performance.now() - started < DURATION_MS) {
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i], me = room.state.players.get(room.sessionId);
      if (!me) continue;
      const angle = tick * 0.08 + i * Math.PI * 2 / CLIENTS;
      room.send('move', { x: me.x + Math.cos(angle) * 0.65, y: me.y, z: me.z + Math.sin(angle) * 0.65, yaw: angle }); messages++;
      if (tick % 2 === 0) {
        const mob = room.state.mobs && room.state.mobs.values().next().value;
        room.send('attack', { id: mob ? mob.id : 'missing-load-target' }); messages++;
      }
      if (tick % 5 === 0) {
        const x = 16 + (i % 8) * 4, z = 16 + Math.floor(i / 8) * 8;
        room.send('edit', { x, y: 55 + (tick / 5 % 3 | 0), z, id: W.B.DIRT, slot: 0 }); messages++;
      }
      if (tick % 50 === 0) { room.send('save', { name: 'Load' + i }); messages++; }
    }
    tick++;
    await wait(STEP_MS);
  }
  await wait(1_000);
  loop.disable();

  const elapsed = performance.now() - started;
  const report = {
    clients: rooms[0].state.players.size,
    durationMs: Math.round(elapsed), messages,
    messagesPerSecond: Math.round(messages / (elapsed / 1000)),
    rejectedMessages: rejects,
    eventLoopMeanMs: Math.round(loop.mean / 1e4) / 100,
    eventLoopP99Ms: Math.round(loop.percentile(99) / 1e4) / 100,
    eventLoopMaxMs: Math.round(loop.max / 1e4) / 100,
    heapGrowthMb: Math.round((process.memoryUsage().heapUsed - memoryStart) / 1024 / 1024 * 100) / 100,
  };
  console.log('\n16-player load test\n' + JSON.stringify(report, null, 2));
  assert.equal(report.clients, CLIENTS, 'clients disconnected during load');
  assert.ok(report.messagesPerSecond >= 200, 'throughput fell below 200 messages/sec');
  assert.ok(report.eventLoopP99Ms < Number(process.env.LOAD_MAX_P99_MS || 250), 'event-loop p99 exceeded threshold');
  assert.ok(report.heapGrowthMb < Number(process.env.LOAD_MAX_HEAP_MB || 128), 'heap growth exceeded threshold');

  await Promise.all(rooms.map(room => room.leave().catch(() => {})));
  await shutdown();
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
