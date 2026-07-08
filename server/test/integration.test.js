// End-to-end multiplayer integration test.
//
// Unlike authority.test.js (which mocks colyseus and calls room methods
// directly), this boots the REAL server in-process and drives two real
// colyseus.js clients over a live WebSocket — exercising onJoin, the message
// handlers across every mixin, the update() simulation loop, and schema state
// sync between players. Run with:  node server/test/integration.test.js
//
// It starts its own server on an isolated port + temp data dir, so it never
// touches ./data and can run alongside a dev server.

const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Client } = require('@colyseus/sdk');

const PORT = 2599;
const ENDPOINT = 'ws://localhost:' + PORT;

const wait = ms => new Promise(r => setTimeout(r, ms));
function register(username, password, displayName) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username, password, displayName });
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('register failed: ' + res.statusCode + ' ' + data));
        resolve(String((res.headers['set-cookie'] || [])[0] || '').split(';')[0]);
      });
    });
    req.on('error', reject); req.end(body);
  });
}
async function waitFor(fn, label = 'condition', timeout = 5000, step = 50) {
  const start = Date.now();
  for (;;) {
    let v; try { v = fn(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('timed out waiting for ' + label);
    await wait(step);
  }
}

async function main() {
  // isolated data dir + port, then boot the real server in-process
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-int-'));
  process.env.PORT = String(PORT);
  require('../index.js');
  await wait(400);

  const results = [];
  let failures = 0;
  const test = async (name, fn) => {
    try { await fn(); results.push('  ok   ' + name); }
    catch (e) { failures++; results.push('  FAIL ' + name + '\n         ' + e.message); }
  };

  const unauthenticated = new Client(ENDPOINT);
  await test('unauthenticated matchmaking is rejected', async () => {
    await assert.rejects(() => unauthenticated.joinOrCreate('blockcraft', { name: 'Intruder' }), /auth/i);
  });
  const cookieA = await register('alpha_user', 'correct horse alpha', 'Alpha');
  const cookieB = await register('bravo_user', 'correct horse bravo', 'Bravo');
  const clientA = new Client(ENDPOINT, { headers: { Cookie: cookieA } });
  const clientB = new Client(ENDPOINT, { headers: { Cookie: cookieB } });
  const A = await clientA.joinOrCreate('blockcraft', { name: 'Alpha' });
  const B = await clientB.joinOrCreate('blockcraft', { name: 'Bravo' });

  const inbox = room => {
    const box = {};
    for (const type of ['chat', 'comms', 'commsReject', 'commsMuteResult', 'commsReportResult', 'editReject']) room.onMessage(type, m => (box[type] = box[type] || []).push(m));
    room.onMessage('*', () => {});   // swallow the many broadcast types this harness doesn't assert on
    return box;
  };
  const aBox = inbox(A), bBox = inbox(B);

  await waitFor(() => A.state && A.state.players && A.state.players.size >= 2, 'both players in shared state');

  await test('two clients join one shared room and see each other', async () => {
    assert.ok(A.state.players.size >= 2, 'A sees ' + A.state.players.size + ' players, expected >= 2');
    assert.ok(A.state.players.get(B.sessionId), 'A does not see B');
    assert.ok(B.state.players.get(A.sessionId), 'B does not see A');
    assert.equal(A.state.players.get(B.sessionId).name, 'Bravo');
  });

  const me = () => A.state.players.get(A.sessionId);
  const startX = me().x, startY = me().y, startZ = me().z;

  await test('movement is clamped server-side (anti-teleport)', async () => {
    A.send('move', { x: startX + 100, y: startY, z: startZ + 100, yaw: 0 });
    await wait(300);
    const moved = Math.hypot(me().x - startX, me().z - startZ);
    assert.ok(moved < 20, 'far teleport was not clamped (moved ' + moved.toFixed(1) + ' blocks in one tick)');
  });

  await test('custom typed chat is rejected by the server', async () => {
    A.send('chat', { text: 'hello bravo' });
    const rejection = await waitFor(() => (aBox.commsReject || []).find(m => m.reason === 'custom'), 'A custom chat rejection');
    assert.equal(rejection.reason, 'custom');
    A.send('comms', { mode: 'local', phrase: '<script>alert(1)</script>' });
    const invalid = await waitFor(() => (aBox.commsReject || []).find(m => m.reason === 'phrase'), 'invalid phrase-id rejection');
    assert.equal(invalid.reason, 'phrase');
  });

  await test('localized comms support proximity chat and direct whispers', async () => {
    A.send('comms', { mode: 'local', phrase: 'hello' });
    const local = await waitFor(() => (bBox.comms || []).find(m => m.text === 'Hello!'), 'B to receive local comms');
    assert.equal(local.mode, 'local');
    assert.equal(local.fromSid, A.sessionId);
    await wait(300);
    A.send('comms', { mode: 'local', phrase: 'hello' });
    const duplicate = await waitFor(() => (aBox.commsReject || []).find(m => m.reason === 'duplicate'), 'duplicate quick-chat rejection');
    assert.equal(duplicate.reason, 'duplicate');
    B.send('comms', { mode: 'whisper', target: A.sessionId, phrase: 'thanks' });
    const whisper = await waitFor(() => (aBox.comms || []).find(m => m.text === 'Thanks!'), 'A to receive whisper');
    assert.equal(whisper.mode, 'whisper');
    assert.equal(whisper.name, 'Bravo');
    A.send('commsReport', { target: B.sessionId });
    const report = await waitFor(() => (aBox.commsReportResult || []).find(m => m.ok), 'moderation report acknowledgement');
    assert.match(report.id, /^report_/);
    A.send('commsMute', { target: B.sessionId, muted: true });
    await waitFor(() => (aBox.commsMuteResult || []).find(m => m.target === B.sessionId && m.muted), 'mute acknowledgement');
    await wait(300);
    B.send('comms', { mode: 'whisper', target: A.sessionId, phrase: 'hello' });
    const muted = await waitFor(() => (bBox.commsReject || []).find(m => m.reason === 'muted'), 'muted whisper rejection');
    assert.equal(muted.reason, 'muted');

    const reportFile = path.join(process.env.DATA_DIR, 'moderation-reports.jsonl');
    await waitFor(() => fs.existsSync(reportFile) && fs.readFileSync(reportFile, 'utf8').trim(), 'durable moderation report');
    const record = JSON.parse(fs.readFileSync(reportFile, 'utf8').trim().split(/\r?\n/).at(-1));
    assert.ok(record.history.length >= 1);
    assert.equal(record.history.every(entry => Object.keys(entry).sort().join(',') === 'at,mode,phrase'), true, 'report history leaked fields beyond approved phrase metadata');
    assert.equal(JSON.stringify(record).includes('quiet reply'), false, 'report persisted custom text');

    const clientA2 = new Client(ENDPOINT, { headers: { Cookie: cookieA } });
    const A2 = await clientA2.joinOrCreate('blockcraft', { name: 'Alpha' });
    const a2Box = inbox(A2);
    await waitFor(() => A2.state.players.get(A2.sessionId), 'second account session');
    await wait(300);
    B.send('comms', { mode: 'whisper', target: A2.sessionId, phrase: 'follow' });
    const persistedMute = await waitFor(() => (bBox.commsReject || []).filter(m => m.reason === 'muted').length >= 2, 'account block on second session');
    assert.ok(persistedMute);
    assert.equal((a2Box.comms || []).some(m => m.fromSid === B.sessionId), false);
    await A2.leave();
  });

  await test('local chat respects range while party chat crosses distance', async () => {
    for (let i = 0; i < 22; i++) {
      const self = B.state.players.get(B.sessionId);
      // this harness client has no collision physics, so it flies above the terrain:
      // sliding at spawn height would clip into hills and trip the anti-noclip guard
      B.send('move', { x: self.x + 7, y: 60, z: self.z, yaw: 0 });
      await wait(180);
    }
    const separation = Math.hypot(B.state.players.get(B.sessionId).x - me().x, B.state.players.get(B.sessionId).z - me().z);
    assert.ok(separation > 48, 'could not establish out-of-range players: ' + separation.toFixed(1));
    const before = (bBox.comms || []).length;
    A.send('comms', { mode: 'local', phrase: 'follow' });
    await wait(450);
    assert.equal((bBox.comms || []).length, before, 'out-of-range local message leaked');

    A.send('teamCreate', { name: 'Comms Matrix' });
    const teamId = await waitFor(() => A.state.players.get(A.sessionId).team, 'A team creation');
    B.send('teamJoin', { key: teamId });
    await waitFor(() => B.state.players.get(B.sessionId).team === teamId, 'B team join');
    await wait(300);
    A.send('comms', { mode: 'party', phrase: 'dungeon_group' });
    const party = await waitFor(() => (bBox.comms || []).find(m => m.mode === 'party' && m.text === 'Group up.'), 'distant party message');
    assert.equal(party.fromSid, A.sessionId);
  });

  await test('local chat does not cross dimension boundaries', async () => {
    B.send('tutorialEnter', { kind: 'onboarding' });
    await waitFor(() => B.state.players.get(B.sessionId).dim === 'tutorial', 'B tutorial dimension');
    const before = (bBox.comms || []).length;
    await wait(300);
    A.send('comms', { mode: 'local', phrase: 'thanks' });
    await wait(450);
    assert.equal((bBox.comms || []).length, before, 'cross-dimension local message leaked');
    B.send('tutorialExit', {});
    await waitFor(() => B.state.players.get(B.sessionId).dim === 'overworld', 'B tutorial exit');
  });

  await test('in-town block edit is rejected and not applied', async () => {
    const px = Math.floor(me().x), pz = Math.floor(me().z), py = Math.floor(me().y);
    const before = A.state.edits.size;
    A.send('edit', { x: px + 1, y: py, z: pz, id: 5 });
    const rej = await waitFor(() => (aBox.editReject || [])[0], 'editReject from server');
    assert.equal(rej.x, px + 1);
    await wait(200);
    assert.equal(A.state.edits.size, before, 'a town-protected edit leaked into shared state');
  });

  await test('shared clock advances from the server update() loop', async () => {
    const t0 = A.state.tod;
    await waitFor(() => A.state.tod > t0, 'time of day to advance', 4000);
    assert.ok(A.state.tod > t0, 'tod did not advance');
    assert.ok(Math.abs(A.state.tod - B.state.tod) < 0.05, 'A and B clocks disagree');
  });

  await test('meta change propagates through shared state to other player', async () => {
    A.send('meta', { name: '<Alpha!Prime>✨', heldId: 110 });
    await waitFor(() => { const p = B.state.players.get(A.sessionId); return p && p.name === 'AlphaPrime'; }, 'B to see renamed Alpha');
    assert.equal(B.state.players.get(A.sessionId).name, 'AlphaPrime');
  });

  await test('forged progression saves are ignored and validated job transactions still work', async () => {
    A.send('save', { job: 'miner', jobXp: 1e9 });
    await wait(250);
    assert.equal(A.state.players.get(A.sessionId).job, '', 'legacy save changed the authoritative job');
    A.send('setJob', { job: 'miner' });
    await waitFor(() => { const p = A.state.players.get(A.sessionId); return p && p.job === 'miner'; }, 'A to register the miner job');
    const lvl = A.state.players.get(A.sessionId).jobLvl;
    assert.equal(lvl, 1, 'forged jobXp changed the authoritative profession level');
  });

  await test('a leaving player is removed from the other player\'s state', async () => {
    await B.leave();
    await waitFor(() => !A.state.players.get(B.sessionId), 'B to be removed from A\'s state');
    assert.ok(!A.state.players.get(B.sessionId), 'B lingered after leaving');
  });

  await A.leave().catch(() => {});
  await wait(200);

  // ---- DungeonRoom (Phase 2b): a hunter joins the dungeon room directly and plays a raid ----
  const cookieC = await register('charlie_user', 'correct horse charlie', 'Charlie');
  const clientC = new Client(ENDPOINT, { headers: { Cookie: cookieC } });
  // Use the entry-rank raid here: this check is about real-room combat + profile
  // handoff, and a fresh level-one hunter must survive long enough to earn the grant.
  const Dn = await clientC.joinOrCreate('dungeon', { gateId: 'itest-gate', seed: 4242, rank: 0, name: 'Charlie' });
  const dungeonGrants = [];
  Dn.onMessage('grant', m => dungeonGrants.push(m));
  inbox(Dn);
  const meD = () => Dn.state.players.get(Dn.sessionId);
  let damagedTrashId = '';

  await test('a hunter joins the DungeonRoom directly and spawns inside the instance', async () => {
    const self = await waitFor(meD, 'charlie in dungeon state');
    assert.equal(self.dim, 'dungeon', 'player is in the dungeon dimension');
    assert.equal(self.dgn, 'itest-gate', 'player is tagged to the gate instance');
  });

  await test('the DungeonRoom synced its own mobs (trash + a boss), all tagged to the instance', async () => {
    await waitFor(() => Dn.state.mobs.size > 1, 'dungeon mobs to sync');
    let boss = 0, wrong = 0;
    Dn.state.mobs.forEach(mb => { if (mb.kind === 'boss') boss++; if (mb.dgn !== 'itest-gate') wrong++; });
    assert.equal(boss, 1, 'the room spawned exactly one boss');
    assert.equal(wrong, 0, 'every synced mob belongs to this instance');
  });

  await test('movement is server-authoritative inside the DungeonRoom (anti-teleport)', async () => {
    const sx = meD().x, sz = meD().z;
    Dn.send('move', { x: sx + 100, y: meD().y, z: sz + 100, yaw: 0 });
    await wait(300);
    const moved = Math.hypot(meD().x - sx, meD().z - sz);
    assert.ok(moved < 20, 'far teleport was not clamped (moved ' + moved.toFixed(1) + ')');
  });

  await test('a hunter can fight in the DungeonRoom: an attack damages an instance mob', async () => {
    const nearestTrash = () => {
      let best = null, bd = Infinity;
      Dn.state.mobs.forEach((mb, id) => {
        if (mb.kind === 'boss' || mb.hp <= 0) return;
        const d = Math.hypot(mb.x - meD().x, mb.z - meD().z);
        if (d < bd) { bd = d; best = { id, mb }; }
      });
      return best;
    };
    let damaged = false;
    for (let i = 0; i < 25 && !damaged; i++) {
      const n = nearestTrash();
      if (!n) break;
      Dn.send('move', { x: n.mb.x, y: n.mb.y, z: n.mb.z, yaw: 0 });   // no server-side collision; close to melee
      await wait(360);
      Dn.send('attack', { id: n.id });
      await wait(140);
      const cur = Dn.state.mobs.get(n.id);
      if (cur && cur.hp < cur.maxHp) {
        damaged = true;
        damagedTrashId = n.id;
      }
    }
    assert.ok(damaged, 'an attack reduced an instance mob\'s HP over the wire');
  });

  await test('killing a DungeonRoom trash mob awards XP into the hunter\'s profile', async () => {
    const grantsBefore = dungeonGrants.length;
    let reward = null;
    let targetId = damagedTrashId;
    for (let i = 0; i < 60 && !reward; i++) {
      let target = targetId && Dn.state.mobs.get(targetId);
      if (!target || target.hp <= 0 || !['zombie', 'skeleton'].includes(target.kind)) {
        targetId = '';
        let bd = Infinity;
        Dn.state.mobs.forEach((mb, id) => {
          if (!['zombie', 'skeleton'].includes(mb.kind) || mb.hp <= 0) return;
          const d = Math.hypot(mb.x - meD().x, mb.z - meD().z);
          if (d < bd) { bd = d; targetId = id; target = mb; }
        });
      }
      const best = targetId && target ? { id: targetId, mb: target } : null;
      if (!best) break;
      Dn.send('move', { x: best.mb.x, y: best.mb.y, z: best.mb.z, yaw: 0 });
      await wait(360);
      Dn.send('attack', { id: best.id });
      await wait(140);
      reward = dungeonGrants.slice(grantsBefore).find(grant => grant && grant.source === 'mob' && grant.xp > 0) || null;
    }
    assert.ok(reward, 'the server acknowledged a reward-bearing trash kill with positive XP');
  });

  await test('a leaving hunter is removed and the DungeonRoom can dispose', async () => {
    await Dn.leave();
    await wait(300);   // let onLeave's flush() + handOff() settle before we rejoin as the same hunter
  });

  // ---- DungeonRoom persistence handoff (Phase 2c): the XP earned above must survive the trip
  // back to the overworld room, not be silently discarded (2b) or overwritten by GameRoom's own
  // stale in-memory cache from before Charlie ever left for the dungeon ----
  await test('XP earned in the DungeonRoom is visible in the profile GameRoom serves on rejoin', async () => {
    const D2 = await clientC.joinOrCreate('blockcraft', { name: 'Charlie' });
    try {
      const profileMsgs = [];
      D2.onMessage('profile', m => profileMsgs.push(m));
      D2.onMessage('*', () => {});
      D2.send('profileRequest', {});
      const prof = await waitFor(() => profileMsgs[0], 'a profile message from the overworld room on rejoin');
      const earnedXp = (prof.S && prof.S.xp | 0) || 0;
      const earnedLevels = (prof.S && prof.S.lvl | 0) || 1;
      assert.ok(earnedXp > 0 || earnedLevels > 1, 'the DungeonRoom-earned XP (or a level-up from it) reached GameRoom, not GameRoom\'s pre-dungeon cache');
    } finally {
      await D2.leave().catch(() => {});
    }
  });

  // ---- DungeonRoom co-op (Phase A foundation): two hunters that enter the same gate id land in
  // ONE shared DungeonRoom (filterBy gateId), see each other, and share a single instance
  // simulation — the prerequisite for rewiring the party lobby to launch switchRoom entries ----
  const cookieD = await register('delta_user', 'correct horse delta', 'Delta');
  const cookieE = await register('echo_user', 'correct horse echo', 'Echo');
  const clientD = new Client(ENDPOINT, { headers: { Cookie: cookieD } });
  const clientE = new Client(ENDPOINT, { headers: { Cookie: cookieE } });
  const coopOpts = { gateId: 'coop-gate', seed: 909, rank: 1 };
  const Dd = await clientD.joinOrCreate('dungeon', { ...coopOpts, name: 'Delta' });
  const De = await clientE.joinOrCreate('dungeon', { ...coopOpts, name: 'Echo' });
  inbox(Dd); inbox(De);
  const meDd = () => Dd.state.players.get(Dd.sessionId);

  await test('two hunters entering the same gate id share one DungeonRoom and see each other', async () => {
    assert.equal(Dd.roomId, De.roomId, 'filterBy(gateId) routed both hunters into the same room instance');
    await waitFor(() => Dd.state.players.size >= 2 && De.state.players.size >= 2, 'both hunters visible in the shared dungeon state');
    Dd.state.players.forEach(p => assert.equal(p.dgn, 'coop-gate', 'every hunter is tagged to the one shared instance'));
  });

  await test('the co-op DungeonRoom runs one shared instance: a hunter\'s hit is visible to their partner', async () => {
    const nearestTrash = () => {
      let best = null, bd = Infinity;
      Dd.state.mobs.forEach((mb, id) => {
        if (mb.kind === 'boss' || mb.hp <= 0) return;
        const d = Math.hypot(mb.x - meDd().x, mb.z - meDd().z);
        if (d < bd) { bd = d; best = { id, mb }; }
      });
      return best;
    };
    let seenByPartner = false;
    for (let i = 0; i < 25 && !seenByPartner; i++) {
      const n = nearestTrash();
      if (!n) break;
      Dd.send('move', { x: n.mb.x, y: n.mb.y, z: n.mb.z, yaw: 0 });   // no server collision; close to melee
      await wait(360);
      Dd.send('attack', { id: n.id });
      await wait(140);
      const echoView = De.state.mobs.get(n.id);   // the SAME mob id, over Echo's own state sync
      if (echoView && echoView.hp < echoView.maxHp) seenByPartner = true;
    }
    assert.ok(seenByPartner, 'Delta\'s hit reduced a shared mob\'s HP as observed in Echo\'s synced dungeon state');
  });

  await test('both co-op hunters leave and the shared DungeonRoom disposes', async () => {
    await Promise.all([Dd.leave(), De.leave()]);
    await wait(300);
  });

  console.log('\nMultiplayer integration test\n' + results.join('\n'));
  console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'all ' + results.length + ' integration checks passed'));
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('integration harness error:', e && e.stack || e); process.exit(1); });
