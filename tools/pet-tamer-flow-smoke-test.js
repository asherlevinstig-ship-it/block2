const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@colyseus/sdk');
const { JsonStore, defaultProfile, DRAGON_GROW_MS } = require('../server/store');
const W = require('../server/world');

const PORT = Number(process.env.PET_TAMER_SMOKE_PORT || 2631);
const BASE = 'http://127.0.0.1:' + PORT;
const ENDPOINT = 'ws://127.0.0.1:' + PORT;
const PASSWORD = 'pet tamer smoke password';
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
        const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/healthz', method: 'GET' }, res => {
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
  const account = res.body && res.body.account;
  const sessionToken = res.body && res.body.sessionToken;
  assert.ok(account && account.id, 'register did not return an account id for ' + username);
  assert.ok(sessionToken, 'register did not return a session token for ' + username);
  return { cookie, sessionToken, account };
}

async function seedProfile(store, accountId, label, patch = {}) {
  const profile = defaultProfile(label);
  profile.name = label;
  profile.nameSet = true;
  profile.S.lvl = patch.level || 2;
  profile.gold = patch.gold || 0;
  profile.pos = patch.pos || [W.TOWN.TC + 0.5, W.TOWN.G + 1, W.TOWN.TC + 0.5];
  profile.job = patch.job || '';
  profile.mountUnlocks = patch.mountUnlocks || [];
  profile.dragonNames = patch.dragonNames || {};
  profile.dragonGenders = patch.dragonGenders || {};
  profile.dragonPersonalities = patch.dragonPersonalities || {};
  profile.dragonHatchedAt = patch.dragonHatchedAt || {};
  profile.dragonRoleMastery = patch.dragonRoleMastery || {};
  await store.savePlayer(accountId, profile);
  return profile;
}

async function makeSession(label, suffix, patch, store) {
  const username = ('pt_' + label + '_' + suffix).toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24);
  const registered = await register(username, label);
  await seedProfile(store, registered.account.id, label, patch);
  const client = new Client(ENDPOINT, { headers: { Cookie: registered.cookie } });
  const room = await client.joinOrCreate('blockcraft', { name: label, authToken: registered.sessionToken });
  const seen = [];
  const waiters = [];

  function record(type, msg) {
    seen.push({ type, msg, at: Date.now() });
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(type, msg)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve({ type, msg });
    }
  }

  for (const type of [
    'profile',
    'petTamerServices', 'petTamerPing', 'petTamerPingResult',
    'dragonLoanPending', 'dragonLoanOffer', 'dragonLoanOfferBroadcast', 'dragonLoanResult',
    'dragonLoanReject', 'dragonLoanReturn', 'dragonTrainingUpdate', 'dragonTrainingComplete',
    'dragonTrainingLoanProgress', 'dragonTrainingReject',
  ]) room.onMessage(type, msg => record(type, msg));
  room.onMessage('*', () => {});

  function waitFor(predicate, labelText, timeout = 12000, includeExisting = true) {
    if (includeExisting) {
      const existing = seen.find(e => predicate(e.type, e.msg));
      if (existing) return Promise.resolve(existing);
    }
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve };
      waiters.push(waiter);
      setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        const recent = seen.slice(-12).map(e => ({
          type: e.type,
          ok: e.msg && e.msg.ok,
          reason: e.msg && e.msg.reason,
          services: e.msg && Array.isArray(e.msg.services) ? e.msg.services.length : undefined,
          progress: e.msg && e.msg.progress,
          need: e.msg && e.msg.need,
          hasLoanTraining: !!(e.msg && e.msg.loanTraining),
          loanRole: e.msg && e.msg.loan && e.msg.loan.role,
          loanType: e.msg && e.msg.loan && e.msg.loan.type,
        }));
        reject(new Error(label + ' timed out waiting for ' + labelText + '. Recent events: ' + JSON.stringify(recent)));
      }, timeout);
    });
  }

  return { label, username, account: registered.account, room, seen, waitFor };
}

async function walkFollowDrill(session, start) {
  session.room.send('startDragonTraining', { type: 'ember', role: 'follow' });
  await session.waitFor((type, msg) => type === 'dragonTrainingUpdate' && msg && msg.started, 'follow training start', 8000, false);
  for (let i = 1; i <= 70; i++) {
    session.room.send('move', { x: start.x + i * 0.85, y: start.y, z: start.z + (i % 2 ? 0.2 : -0.2), yaw: 0 });
    await wait(110);
  }
  return session.waitFor((type, msg) => type === 'dragonTrainingComplete' && msg && msg.type === 'ember' && msg.role === 'follow', 'borrowed dragon training completion', 20000);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-pet-tamer-smoke-'));
  process.env.DATA_DIR = dataDir;
  process.env.PORT = String(PORT);
  process.env.BLOCKCRAFT_E2E = '1';
  process.env.BLOCKCRAFT_BETA_TEST = '1';
  process.env.STORE = 'json';
  process.env.AUTH_BACKEND = 'file';
  require('../server/index.js');
  await waitForServer();

  const store = new JsonStore(dataDir);
  const suffix = Date.now().toString(36);
  const ownerPos = { x: W.TOWN.TC + 0.5, y: W.TOWN.G + 1, z: W.TOWN.TC + 0.5 };
  const tamerPos = { x: W.TOWN.TC + 1.5, y: W.TOWN.G + 1, z: W.TOWN.TC + 0.5 };
  const oldHatch = Date.now() - DRAGON_GROW_MS - 1000;
  const owner = await makeSession('Owner', suffix, {
    gold: 10,
    pos: [ownerPos.x, ownerPos.y, ownerPos.z],
    mountUnlocks: ['dragon:ember'],
    dragonNames: { ember: 'Cinder' },
    dragonGenders: { ember: 'female' },
    dragonPersonalities: { ember: 'bold' },
    dragonHatchedAt: { ember: oldHatch },
    dragonRoleMastery: { ember: { follow: 0, guard: 0, stay: 0, rest: 0 } },
  }, store);
  const tamer = await makeSession('Tamer', suffix, {
    gold: 100,
    job: 'pet_tamer',
    pos: [tamerPos.x, tamerPos.y, tamerPos.z],
  }, store);

  owner.room.send('move', { ...ownerPos, yaw: 0 });
  tamer.room.send('move', { ...tamerPos, yaw: 0 });
  await wait(500);

  tamer.room.send('petTamerService', { action: 'advertise', price: 35, note: 'Smoke tested dragon care' });
  const tamerServices = await tamer.waitFor((type, msg) => type === 'petTamerServices' && msg && msg.advertised && msg.services && msg.services.some(row => row.sid === tamer.room.sessionId), 'tamer advertises services');

  owner.room.send('petTamerService', { action: 'list' });
  const ownerList = await owner.waitFor((type, msg) => type === 'petTamerServices' && msg && msg.services && msg.services.some(row => row.sid === tamer.room.sessionId && row.price === 35), 'owner sees advertised tamer', 8000, false);

  owner.room.send('petTamerService', { action: 'ping', targetSid: tamer.room.sessionId });
  const pingResult = await owner.waitFor((type, msg) => type === 'petTamerPingResult' && msg && msg.ok && msg.targetSid === tamer.room.sessionId, 'owner ping result', 8000, false);
  const ping = await tamer.waitFor((type, msg) => type === 'petTamerPing' && msg && msg.fromSid === owner.room.sessionId, 'tamer receives owner ping', 8000, false);

  owner.room.send('dragonLoanOffer', { targetSid: tamer.room.sessionId, targetName: 'Tamer', type: 'ember', gold: 35 });
  const offer = await tamer.waitFor((type, msg) => type === 'dragonLoanOffer' && msg && msg.type === 'ember' && msg.feeGold === 35, 'tamer receives dragon loan offer', 8000, false);
  await owner.waitFor((type, msg) => type === 'dragonLoanPending' && msg && msg.id === offer.msg.id, 'owner sees pending dragon loan', 8000);

  tamer.room.send('dragonLoanAccept', { loanId: offer.msg.id });
  const ownerAccepted = await owner.waitFor((type, msg) => type === 'dragonLoanResult' && msg && msg.ok && msg.loan && msg.loan.role === 'owner', 'owner sees accepted loan', 8000, false);
  const tamerAccepted = await tamer.waitFor((type, msg) => type === 'dragonLoanResult' && msg && msg.ok && msg.loan && msg.loan.role === 'tamer', 'tamer sees accepted loan', 8000, false);

  const training = await walkFollowDrill(tamer, tamerPos);
  const ownerProgress = await owner.waitFor((type, msg) => type === 'dragonTrainingLoanProgress' && msg && msg.loanTraining && msg.loanTraining.loan && msg.loanTraining.loan.trainingDrills >= 1, 'owner sees dragon training progress', 8000);

  owner.room.send('dragonLoanReturn', { loanId: ownerAccepted.msg.loan.id });
  const ownerReturn = await owner.waitFor((type, msg) => type === 'dragonLoanReturn' && msg && msg.loan && msg.loan.status === 'returned', 'owner sees dragon return', 8000);
  const tamerReturn = await tamer.waitFor((type, msg) => type === 'dragonLoanReturn' && msg && msg.loan && msg.loan.status === 'returned', 'tamer sees dragon return', 8000);

  owner.room.send('profileRequest', {});
  tamer.room.send('profileRequest', {});
  const ownerProfile = await owner.waitFor((type, msg) => type === 'profile' && msg && Array.isArray(msg.mountUnlocks) && msg.mountUnlocks.includes('dragon:ember') && msg.dragonRoleMastery && msg.dragonRoleMastery.ember && msg.dragonRoleMastery.ember.follow > 0, 'owner profile has trained returned dragon', 8000, false);
  const tamerProfile = await tamer.waitFor((type, msg) => type === 'profile' && msg && Array.isArray(msg.mountUnlocks) && !msg.mountUnlocks.includes('dragon:ember'), 'tamer profile no longer has borrowed dragon', 8000, false);

  const summary = {
    users: [owner.username, tamer.username],
    service: {
      tamerAdvertised: tamerServices.msg.services.find(row => row.sid === tamer.room.sessionId),
      ownerSawServices: ownerList.msg.services.length,
      ping: { targetName: pingResult.msg.targetName, fromName: ping.msg.fromName },
    },
    loan: {
      id: ownerAccepted.msg.loan.id,
      type: ownerAccepted.msg.loan.type,
      feeGold: ownerAccepted.msg.loan.feeGold,
    },
    training: {
      role: training.msg.role,
      drills: ownerProgress.msg.loanTraining.loan.trainingDrills,
      xp: ownerProgress.msg.loanTraining.loan.trainingXp,
      ownerFollowMastery: ownerProfile.msg.dragonRoleMastery.ember.follow,
    },
    returned: {
      ownerStatus: ownerReturn.msg.loan.status,
      tamerStatus: tamerReturn.msg.loan.status,
      ownerHasDragon: ownerProfile.msg.mountUnlocks.includes('dragon:ember'),
      tamerHasDragon: tamerProfile.msg.mountUnlocks.includes('dragon:ember'),
    },
  };

  assert.equal(summary.service.ownerSawServices >= 1, true, 'owner did not see Pet Tamer service listing');
  assert.equal(summary.loan.feeGold, 35, 'loan fee mismatch');
  assert.equal(summary.training.drills >= 1, true, 'training did not record a completed drill');
  assert.equal(summary.training.ownerFollowMastery > 0, true, 'owner dragon mastery did not improve');
  assert.equal(summary.returned.ownerHasDragon, true, 'owner did not regain dragon after return');
  assert.equal(summary.returned.tamerHasDragon, false, 'tamer kept borrowed dragon after return');

  await Promise.all([owner.room.leave().catch(() => {}), tamer.room.leave().catch(() => {})]);
  await shutdown();
  console.log('\nPet Tamer multiplayer smoke test passed\n' + JSON.stringify(summary, null, 2));
}

main().catch(async error => {
  console.error(error.stack || error.message);
  await shutdown();
  process.exitCode = 1;
});
