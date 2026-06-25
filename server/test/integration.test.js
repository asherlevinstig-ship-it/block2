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
const { Client } = require('colyseus.js');

const PORT = 2599;
const ENDPOINT = 'ws://localhost:' + PORT;

const wait = ms => new Promise(r => setTimeout(r, ms));
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

  const clientA = new Client(ENDPOINT);
  const clientB = new Client(ENDPOINT);
  const A = await clientA.joinOrCreate('blockcraft', { name: 'Alpha', token: 'tAAAAAAAAAAAAAAAA' });
  const B = await clientB.joinOrCreate('blockcraft', { name: 'Bravo', token: 'tBBBBBBBBBBBBBBBB' });

  const inbox = room => {
    const box = {};
    for (const type of ['chat', 'editReject']) room.onMessage(type, m => (box[type] = box[type] || []).push(m));
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

  await test('chat relays from one player to the other', async () => {
    A.send('chat', { text: 'hello bravo' });
    const got = await waitFor(() => (bBox.chat || []).find(m => m.text === 'hello bravo'), 'B to receive chat');
    assert.equal(got.name, 'Alpha');
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

  await test('a forged jobXp save is rate-capped (no instant max profession)', async () => {
    A.send('save', { job: 'miner', jobXp: 1e9 });
    await waitFor(() => { const p = A.state.players.get(A.sessionId); return p && p.job === 'miner'; }, 'A to register the miner job');
    await wait(200);
    const lvl = A.state.players.get(A.sessionId).jobLvl;
    assert.ok(lvl > 0 && lvl < 10, 'forged jobXp produced job level ' + lvl + ' (rate cap failed if near 99)');
  });

  await test('a leaving player is removed from the other player\'s state', async () => {
    await B.leave();
    await waitFor(() => !A.state.players.get(B.sessionId), 'B to be removed from A\'s state');
    assert.ok(!A.state.players.get(B.sessionId), 'B lingered after leaving');
  });

  await A.leave().catch(() => {});
  await wait(200);

  console.log('\nMultiplayer integration test\n' + results.join('\n'));
  console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'all ' + results.length + ' integration checks passed'));
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('integration harness error:', e && e.stack || e); process.exit(1); });
