const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@colyseus/sdk');
const { chromium } = require('@playwright/test');
const { AuthService } = require('../server/auth');
const { JsonStore, defaultProfile } = require('../server/store');
const W = require('../server/world');

const PORT = Number(process.env.CLIENT_PERF_PORT || 2641);
const REMOTE_CLIENTS = Number(process.env.CLIENT_PERF_REMOTES || 15);
const DURATION_MS = Number(process.env.CLIENT_PERF_DURATION_MS || 12_000);
const WARMUP_MS = Number(process.env.CLIENT_PERF_WARMUP_MS || 4_000);
const SAMPLE_INTERVAL_MS = Number(process.env.CLIENT_PERF_SAMPLE_INTERVAL_MS || 750);
const MIN_VISIBLE_REMOTES = Number(process.env.CLIENT_PERF_MIN_VISIBLE_REMOTES || Math.min(REMOTE_CLIENTS, 12));
const MIN_FPS = Number(process.env.CLIENT_PERF_MIN_FPS || 30);
const MAX_UPDATE_MS = Number(process.env.CLIENT_PERF_MAX_UPDATE_MS || 12);
const MAX_RENDER_MS = Number(process.env.CLIENT_PERF_MAX_RENDER_MS || 12);
const PASSWORD = 'PerfTest12345!';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function cookieHeader(sid) {
  return 'bc_session=' + encodeURIComponent(sid);
}

function shutdown(port) {
  return new Promise(resolve => {
    const request = http.request({ host: '127.0.0.1', port, path: '/__e2e/shutdown', method: 'POST', timeout: 2_000 }, response => {
      response.resume();
      response.on('end', resolve);
    });
    request.on('error', resolve);
    request.on('timeout', () => {
      request.destroy();
      resolve();
    });
    request.end();
  });
}

function serverReady(port) {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 750 }, response => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(child, port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('server exited during startup with code ' + child.exitCode);
    if (await serverReady(port)) return;
    await wait(250);
  }
  throw new Error('server did not become ready on port ' + port);
}

async function seed(dataDir, totalClients) {
  const auth = new AuthService(dataDir);
  const store = new JsonStore(dataDir);
  const run = Date.now().toString(36).slice(-6);
  const accounts = [];
  const baseX = 96, baseZ = 96;
  try {
    for (let i = 0; i < totalClients; i++) {
      const name = i === 0 ? 'BrowserPerf' : 'Remote' + i;
      const account = await auth.register('cp' + run + '_' + i, PASSWORD, name);
      const sid = await auth.issueSession(account);
      const profile = defaultProfile();
      const offsetX = (i % 4) * 4;
      const offsetZ = Math.floor(i / 4) * 4;
      profile.name = name;
      profile.nameSet = true;
      profile.pos = [baseX + offsetX + 0.5, W.terrainHeight(baseX + offsetX, baseZ + offsetZ) + 2, baseZ + offsetZ + 0.5];
      profile.inv[0] = { id: W.B.DIRT, count: 64 };
      await store.savePlayer(account.id, profile);
      accounts.push({ account, sid, name });
    }
  } finally {
    auth.stop();
  }
  return accounts;
}

async function joinRemoteClients(accounts) {
  const sessions = [];
  for (let i = 1; i < accounts.length; i++) {
    const client = new Client('ws://127.0.0.1:' + PORT, { headers: { Cookie: cookieHeader(accounts[i].sid) } });
    const room = await client.joinOrCreate('blockcraft', { name: accounts[i].name, shardId: 'main' });
    room.onMessage('*', () => {});
    await waitForRoomPlayer(room);
    sessions.push(room);
  }
  return sessions;
}

async function waitForRoomPlayer(room) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (room && room.state && room.state.players && room.state.players.get(room.sessionId)) return;
    await wait(50);
  }
  throw new Error('remote client state did not include its player entry');
}

function parseHud(text) {
  const fps = Number((/(\d+) fps/.exec(text) || [])[1] || 0);
  const frameMs = Number((/fps\s+([\d.]+) ms/.exec(text) || [])[1] || 0);
  const updateMs = Number((/update ([\d.]+) ms/.exec(text) || [])[1] || 0);
  const renderMs = Number((/render ([\d.]+) ms/.exec(text) || [])[1] || 0);
  const draws = Number((/(\d+) draws/.exec(text) || [])[1] || 0);
  const triangles = Number((/draws\s+(\d+) tris/.exec(text) || [])[1] || 0);
  const remotes = Number((/remotes: (\d+)/.exec(text) || [])[1] || 0);
  const particles = Number((/particles: (\d+)/.exec(text) || [])[1] || 0);
  return { fps, frameMs, updateMs, renderMs, draws, triangles, remotes, particles, text };
}

function percentile(values, p) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1))];
}

function summarize(samples) {
  const bestRemote = Math.max(...samples.map(sample => sample.remotes));
  return {
    samples: samples.length,
    visibleRemotesMax: bestRemote,
    fpsMin: Math.min(...samples.map(sample => sample.fps)),
    fpsP50: percentile(samples.map(sample => sample.fps), 0.5),
    frameMsP95: percentile(samples.map(sample => sample.frameMs), 0.95),
    updateMsP95: percentile(samples.map(sample => sample.updateMs), 0.95),
    updateMsMax: Math.max(...samples.map(sample => sample.updateMs)),
    renderMsP95: percentile(samples.map(sample => sample.renderMs), 0.95),
    renderMsMax: Math.max(...samples.map(sample => sample.renderMs)),
    drawsMax: Math.max(...samples.map(sample => sample.draws)),
    trianglesMax: Math.max(...samples.map(sample => sample.triangles)),
    particlesMax: Math.max(...samples.map(sample => sample.particles)),
  };
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-client-perf-'));
  const accounts = await seed(dataDir, REMOTE_CLIENTS + 1);
  const server = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: dataDir,
      AUTH_SECRET: 'client-perf-only-secret',
      BLOCKCRAFT_E2E: '1',
      BLOCKCRAFT_SHARD_MAX_CLIENTS: String(REMOTE_CLIENTS + 1),
    },
  });

  let browser;
  let sessions = [];
  try {
    await waitForServer(server, PORT);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addCookies([{ name: 'bc_session', value: accounts[0].sid, url: 'http://127.0.0.1:' + PORT + '/' }]);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + PORT + '/?e2e=1', { waitUntil: 'domcontentloaded' });
    await page.locator('#playbtn').click();
    await page.waitForFunction(() => window.__BLOCKCRAFT_E2E__ && window.__BLOCKCRAFT_E2E__.status().connected === true, null, { timeout: 15_000 });
    await page.keyboard.press('F3');

    sessions = await joinRemoteClients(accounts);
    const warmupStarted = Date.now();
    let warmupTick = 0;
    while (Date.now() - warmupStarted < WARMUP_MS) {
      driveRemoteClients(sessions, warmupTick++);
      await wait(100);
    }
    const started = Date.now();
    let tick = 0;
    const samples = [];
    while (Date.now() - started < DURATION_MS) {
      driveRemoteClients(sessions, tick);
      const text = await page.locator('#perfhud').textContent({ timeout: 5_000 });
      samples.push(parseHud(text || ''));
      tick++;
      await wait(SAMPLE_INTERVAL_MS);
    }
    const report = summarize(samples);
    console.log('\nClient overworld perf test\n' + JSON.stringify(report, null, 2));
    console.log('\nLast HUD sample\n' + (samples.at(-1) && samples.at(-1).text || ''));
    assert.ok(report.visibleRemotesMax >= MIN_VISIBLE_REMOTES, 'visible remotes ' + report.visibleRemotesMax + ' below expected ' + MIN_VISIBLE_REMOTES);
    assert.ok(report.fpsMin >= MIN_FPS, 'minimum fps ' + report.fpsMin + ' below budget ' + MIN_FPS);
    assert.ok(report.updateMsP95 <= MAX_UPDATE_MS, 'update p95 ' + report.updateMsP95 + 'ms exceeded budget ' + MAX_UPDATE_MS + 'ms');
    assert.ok(report.renderMsP95 <= MAX_RENDER_MS, 'render p95 ' + report.renderMsP95 + 'ms exceeded budget ' + MAX_RENDER_MS + 'ms');
  } finally {
    await Promise.allSettled(sessions.map(room => room.leave()));
    if (browser) await browser.close();
    await shutdown(PORT);
    if (server.exitCode === null) {
      server.kill();
      await new Promise(resolve => server.once('exit', resolve));
    }
  }
}

function driveRemoteClients(sessions, tick) {
  for (let i = 0; i < sessions.length; i++) {
    const room = sessions[i];
    const me = room.state && room.state.players && room.state.players.get(room.sessionId);
    if (!me) continue;
    const angle = tick * 0.08 + i * Math.PI * 2 / Math.max(1, sessions.length);
    room.send('move', { x: me.x + Math.cos(angle) * 0.35, y: me.y, z: me.z + Math.sin(angle) * 0.35, yaw: angle });
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
