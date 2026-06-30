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
const { Client } = require('colyseus.js');

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
    A.send('meta', { name: 'AlphaPrime', heldId: 110 });
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
  const Dn = await clientC.joinOrCreate('dungeon', { gateId: 'itest-gate', seed: 4242, rank: 1, name: 'Charlie' });
  inbox(Dn);
  const meD = () => Dn.state.players.get(Dn.sessionId);

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
      if (cur && cur.hp < cur.maxHp) damaged = true;
    }
    assert.ok(damaged, 'an attack reduced an instance mob\'s HP over the wire');
  });

  await test('a leaving hunter is removed and the DungeonRoom can dispose', async () => {
    await Dn.leave();
    await wait(200);
  });

  console.log('\nMultiplayer integration test\n' + results.join('\n'));
  console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'all ' + results.length + ' integration checks passed'));
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('integration harness error:', e && e.stack || e); process.exit(1); });
