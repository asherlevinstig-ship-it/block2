// Read-only audit probes: real game methods, isolated in-memory state.
// Assertions intentionally describe observed defects, not desired behavior.
const assert = require('node:assert/strict');
const { GameRoom } = require('../../server/rooms/GameRoom');
const economy = require('../../server/rooms/economy.mixin');
const kc = require('../../server/rooms/knowledge-challenge.mixin');
const { I } = require('../../server/rooms/constants');
const W = require('../../server/world');
const out = [];
const client = () => ({ sessionId: 'audit', sent: [], send(type, payload) { this.sent.push({ type, payload }); } });
function chestRoom(prof, slots) {
  const room = Object.create(GameRoom.prototype);
  Object.assign(room, { dirtyPlayers: new Set(), profileFor: () => ({ token: 'audit_user', prof }),
    chestKeyForPlayer: () => 'overworld:1,2,3', canAccessChest: () => true,
    canWithdrawChest: () => true, rateLimited: () => false, ensureHomesteadChestCapacity() {},
    getChestState: () => slots, sendChest() {} });
  return room;
}
function challengeRoom() {
  const room = Object.create(kc), prof = { gold: 100 }, calls = { starts: 0, reviews: 0 };
  const store = {
    async resolvePlaySubject() { return { subjectId: 5 }; },
    async loadStudentAtoms() { return { atoms: [{ atomId: 1, difficulty: 1, state: {} }] }; },
    async startShift() { return { id: ++calls.starts }; },
    async loadConfusionPairs() { return []; },
    async recordAtomReview() { calls.reviews++; return { recorded: true }; },
    async recordShiftCase() {}, async logChallengeAttempt() {},
  };
  room.initKnowledgeChallengeState();
  Object.assign(room, { kcStore: () => store, kcAccountFor: () => ({ id: 'audit' }),
    profileFor: () => ({ token: 'audit_user', prof }), dirtyPlayers: new Set(),
    rateLimited: () => false, kcTrace() {}, kcSyncGold() {}, async kcServeNextCase() {} });
  return { room, prof, calls };
}
async function main() {
  {
    const prof = { inv: Array.from({ length: 36 }, () => ({ id: I.COAL, count: 64 })) };
    const slots = [{ id: I.DIAMOND, count: 5 }], c = client(), room = chestRoom(prof, slots);
    room.handleChestWithdraw(c, { slot: 0, count: 5 });
    assert.equal(slots[0], null);
    assert.equal(prof.inv.some(s => s && s.id === I.DIAMOND), false);
    assert.ok(c.sent.some(s => s.type === 'chestTx'));
    out.push({ bug: 'Chest withdrawal deletes items when inventory is full', lost: 5, successMessage: true });
  }
  {
    const original = { id: I.IRON_SWORD, count: 1, dur: 23, plus: 2, rarity: 'mythic', locked: true, forge: 'keen' };
    const prof = { inv: [{ ...original }], S: { lvl: 1 } }, slots = [null], c = client(), room = chestRoom(prof, slots);
    room.handleChestDeposit(c, { id: I.IRON_SWORD, count: 1 });
    assert.equal(slots[0], null);
    assert.deepEqual(prof.inv[0], original);
    assert.equal(c.sent[0].payload.reason, 'full');
    out.push({ bug: 'Gear deposit is rejected with misleading full-chest error', emptyChest: true, reason: c.sent[0].payload.reason, gearPreserved: true });
  }
  {
    const { room, prof, calls } = challengeRoom(), c = client();
    await Promise.all([room.handleKcStart(c, { shiftType: 'quick' }), room.handleKcStart(c, { shiftType: 'quick' })]);
    assert.equal(calls.starts, 2); assert.equal(prof.gold, 60); assert.equal(room.kcShifts.size, 1);
    out.push({ bug: 'Concurrent challenge starts debit twice and overwrite the first shift', starts: calls.starts, gold: prof.gold, active: room.kcShifts.size });
  }
  {
    const { room, calls } = challengeRoom(), c = client();
    await room.handleKcStart(c, { shiftType: 'quick' });
    const shift = room.kcShifts.get(c.sessionId);
    shift.pending = { questionId: 8, atomId: 1, correctIndex: 0, format: 'multiple_choice' };
    await Promise.all([room.handleKcAnswer(c, { questionId: 8, index: 0 }), room.handleKcAnswer(c, { questionId: 8, index: 0 })]);
    assert.equal(shift.totals.completedCases, 2); assert.equal(calls.reviews, 2);
    out.push({ bug: 'Concurrent answers count the same question twice', completed: shift.totals.completedCases, reviews: calls.reviews });
  }
  {
    const room = Object.create(GameRoom.prototype), c = client(), prof = { inv: [{ id: I.COAL, count: 1 }] };
    room.initPersistenceState(); room.tokens.set(c.sessionId, 'audit_user'); room.profiles.set('audit_user', prof);
    room.clients = []; room.completeFurnaces = () => {};
    room.store = { async savePlayer() { throw new Error('audit injected storage failure'); } };
    room.protectDurableInventoryMessages(c);
    await c.send('shopResult', { ok: true });
    assert.ok(c.sent.some(s => s.type === 'shopResult')); assert.ok(room.dirtyPlayers.has('audit_user'));
    out.push({ bug: 'Durable success is delivered even when its save fails', delivered: c.sent.map(s => s.type), unsaved: true });
  }
  {
    const room = Object.create(GameRoom.prototype), prof = { inv: [], gold: 100 };
    room.initPersistenceState(); room.clients = [];
    let release, snapshot;
    room.store = { savePlayer(_token, value) { snapshot = value; return new Promise(r => { release = r; }); } };
    const saving = room.savePlayerProfileNow('audit_user', prof);
    await new Promise(r => setImmediate(r));
    prof.gold = 200; room.dirtyPlayers.add('audit_user'); release(); await saving;
    assert.equal(snapshot.gold, 100); assert.equal(room.dirtyPlayers.has('audit_user'), false);
    out.push({ bug: 'In-flight immediate save clears newer non-inventory changes', savedGold: snapshot.gold, liveGold: prof.gold, dirty: false });
  }
  {
    const prof = { inv: Array.from({ length: 36 }, () => ({ id: I.COAL, count: 64 })) };
    const room = Object.create(GameRoom.prototype);
    Object.assign(room, { profileFor: () => ({ token: 'audit_user', prof }), dirtyPlayers: new Set(),
      grantHunterXp() {}, syncPlayerProfile() {}, sendTradeInventory() {}, progressRegionalContract() {} });
    const c = client(); room.awardGrant(c, { source: 'discovery', items: [{ id: I.DIAMOND, count: 3 }] });
    assert.deepEqual(c.sent.find(s => s.type === 'grant').payload.items, []);
    assert.equal(prof.lootRecovery, undefined);
    out.push({ bug: 'Full-bag non-gear rewards have no recovery path', delivered: 0, requested: 3 });
  }
  {
    const room = Object.create(GameRoom.prototype), c = client();
    const site = W.ancientCityDiscoverySpecs().find(s => s.type === 'ancient_vault');
    const prof = { inv: Array.from({ length: 36 }, () => ({ id: I.COAL, count: 64 })), claimedDiscoveries: [] };
    Object.assign(room, { state: { players: new Map([[c.sessionId, { x: site.x, y: site.y + 30, z: site.z, dgn: '', dim: 'overworld' }]]) },
      profileFor: () => ({ token: 'audit_user', prof }), clientToken: () => 'audit_user', dirtyPlayers: new Set(),
      markDiscovery() {}, recordTreasureProgress() {}, applyWeatherDiscoveryMilestones: () => [],
      grantHunterXp() {}, syncPlayerProfile() {}, sendTradeInventory() {}, progressRegionalContract() {} });
    room.handleDiscoveryInteract(c, { id: site.id });
    assert.ok(prof.claimedDiscoveries.includes(site.id));
    assert.deepEqual(c.sent.find(s => s.type === 'grant').payload.items, []);
    const advertised = c.sent.find(s => s.type === 'discoveryResult').payload.items;
    room.handleDiscoveryInteract(c, { id: site.id });
    assert.equal(c.sent.at(-1).payload.reason, 'claimed');
    out.push({ bug: 'Ancient vault can be claimed 30 blocks above; full bag permanently consumes claim', verticalDistance: 30,
      markedClaimed: true, advertisedRewardTypes: advertised.length, delivered: 0, retry: 'claimed' });
  }
  {
    const { room } = challengeRoom(), c = client();
    let nextCases = 0;
    room.kcServeNextCase = async () => { nextCases++; };
    room.kcShifts.set(c.sessionId, { id: 1, planned: 10, totals: { completedCases: 1 }, corrective: { correctIndex: 0 } });
    await room.handleKcCorrective(c, { index: 1 });
    assert.equal(nextCases, 1); assert.equal(room.kcShifts.get(c.sessionId).corrective, null);
    out.push({ bug: 'Incorrect corrective answer still advances to the next case', nextCases, correct: false });
  }
  {
    const room = Object.create(GameRoom.prototype), c = client(), prof = { inv: [], gold: 100 };
    room.initPersistenceState(); room.tokens.set(c.sessionId, 'audit_user'); room.profiles.set('audit_user', prof);
    room.persistedInventorySignatures.set('audit_user', room.inventoryPersistenceSignature(prof));
    let saves = 0;
    room.store = { async savePlayer() { saves++; } }; room.flush = async () => { saves++; };
    prof.gold = 200; room.dirtyPlayers.add('audit_user'); room.protectDurableInventoryMessages(c);
    await c.send('tradeResult', { ok: true });
    assert.equal(saves, 0); assert.equal(c.sent.length, 1);
    out.push({ bug: 'Gold-only trade success bypasses save-before-message barrier', saves, successDelivered: true });
  }
  console.log(JSON.stringify(out, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
