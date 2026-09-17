const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PLAYERS = Math.max(1, Math.min(64, Number(process.env.SIM_PLAYERS || 6) | 0));
const CYCLES = Math.max(1, Math.min(120, Number(process.env.SIM_CYCLES || 4) | 0));
const PORT = Math.max(1024, Math.min(65535, Number(process.env.SIM_PORT || 2637) | 0));
const VIRTUAL_CYCLE_SECONDS = 30;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-firestore-cost-'));
process.env.DATA_DIR = dataDir;
process.env.PORT = String(PORT);
process.env.NODE_ENV = 'test';
process.env.STORE = 'json';
process.env.AUTH_BACKEND = 'file';
process.env.BLOCKCRAFT_E2E = '1';
process.env.BLOCKCRAFT_METRICS = '1';
process.env.BLOCKCRAFT_FIRESTORE_COST_SIM = '1';
process.env.BLOCKCRAFT_SHARD_MAX_CLIENTS = String(PLAYERS);

const writeSimulationReport = console.log.bind(console);
if (process.env.SIM_VERBOSE !== '1') console.log = (...args) => {
  if (String(args[0] || '').startsWith('\nOffline Firestore cost simulation')) writeSimulationReport(...args);
};

const { Client } = require('@colyseus/sdk');
const { AuthService } = require('../server/auth');
const { CountingStore, DEFAULT_PRICES_USD_PER_MILLION, estimateFirestoreCost,
  getCountingUsageSnapshot, resetCountingUsage, scaleUsage, subtractUsage, sumUsage } = require('../server/counting-store');
const { defaultProfile } = require('../server/store');
const W = require('../server/world');
const { I } = require('../server/rooms/constants');

const endpoint = 'ws://127.0.0.1:' + PORT;

function requestJson(method, requestPath, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: PORT, path: requestPath, method, timeout: timeoutMs }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let parsed = null;
        try { parsed = body ? JSON.parse(body) : null; } catch (_) {}
        if (response.statusCode >= 400) return reject(new Error(method + ' ' + requestPath + ' returned ' + response.statusCode));
        resolve(parsed);
      });
    });
    request.on('timeout', () => request.destroy(new Error(method + ' ' + requestPath + ' timed out')));
    request.on('error', reject);
    request.end();
  });
}

async function waitForServer() {
  let lastError = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { return await requestJson('GET', '/healthz', 1000); }
    catch (error) { lastError = error; await wait(100); }
  }
  throw lastError || new Error('local server did not start');
}

async function waitForPrewarmedRoom() {
  let last = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      last = await requestJson('GET', '/readyz', 1000);
      if (last && last.ok && last.totals && last.totals.rooms >= 1) return last;
    } catch (_) {}
    await wait(100);
  }
  throw new Error('local overworld did not finish prewarming: ' + JSON.stringify(last));
}

async function seedAccounts() {
  const auth = new AuthService(dataDir);
  const store = new CountingStore(dataDir, { shardId: 'main' });
  const accounts = [];
  for (let i = 0; i < PLAYERS; i++) {
    const account = await auth.register('cost_sim_' + i, 'offline simulation password ' + i, 'CostSim' + i);
    const sid = await auth.issueSession(account);
    const x = 32 + (i % 3) * 10, z = 32 + Math.floor(i / 3) * 10;
    const profile = defaultProfile('CostSim' + i);
    profile.nameSet = true;
    profile.pos = [x + 0.5, W.terrainHeight(x, z) + 2, z + 0.5];
    profile.gold = 500;
    profile.vitals.hunger = 55;
    profile.vitalsSavedAt = Date.now();
    profile.inv[0] = { id: I.IRON_PICK, count: 1, dur: 251 };
    profile.inv[1] = { id: W.B.LOG, count: Math.min(64, CYCLES + 8) };
    profile.inv[2] = { id: I.BREAD, count: 8 };
    profile.inv[3] = { id: I.WHEAT, count: 8 };
    profile.inv[4] = { id: I.COOKED_MEAT, count: 4 };
    profile.inv[5] = { id: W.B.CHEST, count: 1 };
    profile.inv[6] = { id: W.B.FURNACE, count: 1 };
    profile.inv[7] = { id: I.COAL, count: 8 };
    profile.inv[9] = { id: W.B.DIRT, count: 32 };
    await store.savePlayer(account.id, profile);
    accounts.push({ account, cookie: 'bc_session=' + encodeURIComponent(sid) });
  }
  auth.stop();
  return accounts;
}

function attachCounters(room, counters) {
  room.onMessage('*', () => {});
  for (const type of [
    'editReject', 'craftReject', 'inventorySortReject', 'foodReject', 'chestReject',
    'furnaceReject', 'abilityReject', 'commsReject',
  ]) {
    room.onMessage(type, message => {
      counters.rejects++;
      counters.rejectsByType[type] = (counters.rejectsByType[type] || 0) + 1;
      if (message && message.reason) counters.rejectReasons[message.reason] = (counters.rejectReasons[message.reason] || 0) + 1;
    });
  }
  room.onMessage('craftResult', () => counters.crafts++);
  room.onMessage('grant', message => {
    if (message && message.source === 'mine') counters.mines++;
  });
  room.onMessage('inventorySortResult', message => {
    if (message && message.ok) counters.inventorySorts++;
  });
  room.onMessage('foodResult', () => counters.foodUses++);
  room.onMessage('chestTx', () => counters.chestTransactions++);
  room.onMessage('furnaceStarted', () => counters.furnaceStarts++);
}

function runGameplayCycle(rooms, cycle, counters) {
  for (let index = 0; index < rooms.length; index++) {
    const room = rooms[index];
    const player = room.state.players.get(room.sessionId);
    if (!player) continue;
    const x = Math.floor(player.x) + cycle % 3;
    const z = Math.floor(player.z);
    const y = Math.max(2, Math.floor(player.y - 2));
    room.send('move', { x: x + 0.5, y: player.y, z: z + 0.5, yaw: cycle * 0.25 });
    room.send('edit', { x, y, z, id: W.B.AIR, slot: 0 });
    room.send('inventorySort', {});
    room.send('useFood', { slot: 2 });
    const mob = room.state.mobs && room.state.mobs.values().next().value;
    room.send('attack', { id: mob ? mob.id : 'offline-cost-probe' });
    room.send('craft', {
      requestId: 'cost-' + cycle + '-' + index,
      w: 2,
      cells: [{ id: W.B.LOG, count: 1 }, 0, 0, 0],
    });
    room.send('profileRequest', { reason: 'offline-cost-simulation' });
    counters.messages += 7;
    if (cycle === 0) {
      const stationY = Math.floor(player.y);
      const chest = { x: Math.floor(player.x) + 1, y: stationY, z: Math.floor(player.z) + 2 };
      const furnace = { x: Math.floor(player.x) + 2, y: stationY, z: Math.floor(player.z) + 2 };
      room.send('edit', { ...chest, id: W.B.CHEST, slot: 5 });
      room.send('edit', { ...furnace, id: W.B.FURNACE, slot: 6 });
      room.send('chestOpen', chest);
      room.send('chestDeposit', { ...chest, id: W.B.DIRT, count: 2 });
      room.send('chestWithdraw', { ...chest, slot: 0, count: 1 });
      room.send('furnaceOpen', furnace);
      room.send('furnaceSmelt', { ...furnace, input: W.B.LOG, fuel: I.COAL });
      counters.messages += 7;
    }
  }
}

function roundedUsage(value) {
  const out = {};
  for (const key of ['reads', 'writes', 'deletes', 'bytesRead', 'bytesWritten', 'calls']) {
    out[key] = Math.round((Number(value && value[key]) || 0) * 100) / 100;
  }
  return out;
}

function projectScenario(name, config, phases, prices) {
  const sessionsPerObservedGroup = config.sessionsPerDay / PLAYERS;
  const virtualObservedMinutes = CYCLES * VIRTUAL_CYCLE_SECONDS / 60;
  const activityScale = sessionsPerObservedGroup * config.sessionMinutes / virtualObservedMinutes;
  const lifecycleScale = sessionsPerObservedGroup * (1 + config.reconnectRate);
  const daily = sumUsage(
    scaleUsage(phases.startup, config.restartsPerDay),
    scaleUsage(phases.join, lifecycleScale),
    scaleUsage(phases.activity, activityScale),
    scaleUsage(phases.departure, lifecycleScale),
  );
  const cost = estimateFirestoreCost(daily, prices, 30);
  return {
    name,
    assumptions: config,
    daily: roundedUsage(daily),
    weekly: roundedUsage(scaleUsage(daily, 7)),
    monthly: roundedUsage(scaleUsage(daily, 30)),
    quotaPercent: {
      reads: Math.round(daily.reads / cost.freeDailyQuota.reads * 10000) / 100,
      writes: Math.round(daily.writes / cost.freeDailyQuota.writes * 10000) / 100,
      deletes: Math.round(daily.deletes / cost.freeDailyQuota.deletes * 10000) / 100,
    },
    estimatedCostUsd: {
      daily: Math.round(cost.dailyUsd * 1000000) / 1000000,
      monthly: Math.round(cost.monthlyUsd * 10000) / 10000,
      chargeableDaily: roundedUsage(cost.chargeableDaily),
    },
  };
}

async function main() {
  const accounts = await seedAccounts();
  resetCountingUsage();
  require('../server/index.js');
  await waitForServer();
  await waitForPrewarmedRoom();
  const startupSnapshot = getCountingUsageSnapshot();

  const counters = {
    messages: 0, rejects: 0, rejectsByType: {}, rejectReasons: {}, crafts: 0, mines: 0,
    inventorySorts: 0, foodUses: 0, chestTransactions: 0, furnaceStarts: 0,
  };
  const rooms = [];
  for (const entry of accounts) {
    const room = await new Client(endpoint, { headers: { Cookie: entry.cookie } })
      .joinOrCreate('blockcraft', { name: entry.account.displayName, shardId: 'main' });
    attachCounters(room, counters);
    rooms.push(room);
  }
  await wait(300);
  const joinedSnapshot = getCountingUsageSnapshot();

  for (let cycle = 0; cycle < CYCLES; cycle++) {
    runGameplayCycle(rooms, cycle, counters);
    // Stay below the strictest gameplay message bucket while compressing each
    // virtual 30-second persistence window into roughly half a second.
    await wait(550);
    await requestJson('POST', '/__e2e/flush');
  }
  await wait(250);
  const activitySnapshot = getCountingUsageSnapshot();

  await Promise.all(rooms.map(room => room.leave().catch(() => {})));
  await wait(250);
  const departureSnapshot = getCountingUsageSnapshot();
  await requestJson('POST', '/__e2e/shutdown').catch(() => null);

  const phases = {
    startup: roundedUsage(startupSnapshot),
    join: subtractUsage(joinedSnapshot, startupSnapshot),
    activity: subtractUsage(activitySnapshot, joinedSnapshot),
    departure: subtractUsage(departureSnapshot, activitySnapshot),
  };
  for (const key of Object.keys(phases)) phases[key] = roundedUsage(phases[key]);

  const prices = {
    reads: Number(process.env.SIM_PRICE_READS || DEFAULT_PRICES_USD_PER_MILLION.reads),
    writes: Number(process.env.SIM_PRICE_WRITES || DEFAULT_PRICES_USD_PER_MILLION.writes),
    deletes: Number(process.env.SIM_PRICE_DELETES || DEFAULT_PRICES_USD_PER_MILLION.deletes),
  };
  const scenarios = [
    projectScenario('Pilot day', { sessionsPerDay: 30, sessionMinutes: 30, restartsPerDay: 1, reconnectRate: 0.05 }, phases, prices),
    projectScenario('Typical school day', { sessionsPerDay: 150, sessionMinutes: 45, restartsPerDay: 2, reconnectRate: 0.10 }, phases, prices),
    projectScenario('Heavy school day', { sessionsPerDay: 500, sessionMinutes: 60, restartsPerDay: 4, reconnectRate: 0.15 }, phases, prices),
    projectScenario('Stress projection', { sessionsPerDay: 1000, sessionMinutes: 60, restartsPerDay: 6, reconnectRate: 0.20 }, phases, prices),
  ];

  const report = {
    offline: true,
    externalConnections: 0,
    generatedAt: new Date().toISOString(),
    benchmark: {
      players: PLAYERS,
      cycles: CYCLES,
      virtualCycleSeconds: VIRTUAL_CYCLE_SECONDS,
      virtualMinutes: CYCLES * VIRTUAL_CYCLE_SECONDS / 60,
      actions: counters,
    },
    observedFirestoreEquivalent: {
      phases,
      total: roundedUsage(departureSnapshot),
      byOperation: departureSnapshot.byOperation,
    },
    pricesUsdPerMillion: prices,
    scenarios,
    limitations: [
      'Operation prices default to published us-central1 Standard Edition examples; override SIM_PRICE_* for the Firebase database location.',
      'Storage, index storage, backup, PITR, and network egress charges are not included.',
      'Counts are generated by the real local Colyseus handlers and persistence cadence, but gameplay randomness can change the exact action mix.',
    ],
  };

  writeSimulationReport('\nOffline Firestore cost simulation\n' + JSON.stringify(report, null, 2));
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await requestJson('POST', '/__e2e/shutdown').catch(() => null);
  process.exitCode = 1;
});
