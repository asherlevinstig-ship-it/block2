const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createStore, JsonStore, FirebaseStore, FIRESTORE_FAST_RETRY_CONFIG,
  FIRESTORE_WORLD_EDIT_PACK_FORMAT, packWorldEditChunks,
  nextPacificQuotaResetDelay,
  getFirestoreUsageSnapshot, resetFirestoreUsageForTests, cleanShardId, sanitizeProfile,
} = require('../store');

test('Recall mastery preserves complete built-in and database question IDs',()=>{
  const builtIn='it_ns_hex_bin_003',db='db-recall-123456';
  const clean=sanitizeProfile({recallMastery:{lastQuestionId:builtIn,items:{[builtIn]:{attempts:1,lastAt:10},[db]:{attempts:1,lastAt:20}}}});
  assert.equal(clean.recallMastery.lastQuestionId,builtIn);
  assert.ok(clean.recallMastery.items[builtIn]);
  assert.ok(clean.recallMastery.items[db]);
});

test('Firestore quota exhaustion fails fast instead of occupying gameplay queues for ten minutes', () => {
  const service = FIRESTORE_FAST_RETRY_CONFIG.interfaces['google.firestore.v1.Firestore'];
  assert.equal(service.retry_codes.blockcraft_fast.includes('RESOURCE_EXHAUSTED'), false);
  assert.equal(service.retry_params.blockcraft_fast.total_timeout_millis, 8000);
  assert.equal(service.methods.GetDocument.retry_params_name, 'blockcraft_fast');
  assert.equal(service.methods.Commit.retry_params_name, 'blockcraft_fast');
  assert.equal(service.methods.BatchWrite.retry_params_name, 'blockcraft_fast');
});

test('Firestore world delta writes only the supplied chunk documents', async () => {
  resetFirestoreUsageForTests();
  const writes = [];
  let closed = false;
  const store = Object.create(FirebaseStore.prototype);
  store._worldDoc = () => ({ collection: () => ({ doc: id => ({ id }) }) });
  store._bulkWriter = () => ({
    set(ref, value) { writes.push({ ref, value }); },
    async close() { closed = true; },
  });

  await store.saveWorldEditChunks({
    '0_0': { '1,20,1': 2 },
    '1_0': {},
    '../invalid': { '20,20,1': 3 },
  });

  assert.deepEqual(writes.map(write => ({ id: write.ref.id, edits: write.value.edits })), [
    { id: '0_0', edits: { '1,20,1': 2 } },
    { id: '1_0', edits: {} },
  ]);
  assert.equal(closed, true);
  const usage = getFirestoreUsageSnapshot();
  assert.equal(usage.serverObservedEstimate, true);
  assert.equal(usage.daily.writes, 2, 'each valid chunk document counts as one write');
  assert.equal(usage.daily.byCategory.world.writes, 2);
  assert.equal(usage.daily.byOperation.saveWorldEditChunks.calls, 1);
});

test('Firestore usage separates profile reads writes deletes and failures', async () => {
  resetFirestoreUsageForTests();
  const document = {
    async get() { return { exists: true, data: () => ({ name: 'Counter' }) }; },
    async set() {},
    async delete() {},
  };
  const store = Object.create(FirebaseStore.prototype);
  store.db = { collection: () => ({ doc: () => document }) };

  await store.loadPlayer('counter');
  await store.savePlayer('counter', { name: 'Counter' });
  await store.deletePlayer('counter');
  await assert.rejects(() => store._trackUsage('failedProfileSave', 'profiles', { writes: 1 }, async () => {
    throw new Error('quota');
  }), /quota/);

  const usage = getFirestoreUsageSnapshot();
  assert.deepEqual({
    reads: usage.daily.reads,
    writes: usage.daily.writes,
    deletes: usage.daily.deletes,
    failedCalls: usage.daily.failedCalls,
  }, { reads: 1, writes: 1, deletes: 1, failedCalls: 1 });
  assert.equal(usage.daily.byCategory.profiles.calls, 4);
  assert.equal(usage.daily.byOperation.failedProfileSave.writes, 0, 'failed estimates are not presented as billed writes');
});

test('Firestore daily observations roll over at midnight Pacific', async () => {
  const startedAt = Date.now();
  resetFirestoreUsageForTests(startedAt);
  const store = Object.create(FirebaseStore.prototype);
  await store._trackUsage('savePlayer', 'profiles', { writes: 1 }, async () => {});

  const nextDay = getFirestoreUsageSnapshot(startedAt + 36 * 60 * 60 * 1000);
  assert.equal(nextDay.daily.writes, 0);
  assert.equal(nextDay.process.writes, 1);
});

test('Firestore regional packing bounds a 1000-block world to at most 64 startup reads', () => {
  const chunks = {};
  for (let cx = 0; cx < 63; cx++) for (let cz = 0; cz < 63; cz++) {
    chunks[cx + '_' + cz] = { [cx * 16 + ',20,' + cz * 16]: 3 };
  }
  const packs = packWorldEditChunks(chunks);
  assert.equal(Object.keys(packs).length, 64);
  assert.deepEqual(packs['0_0']['0_0'], { '0,20,0': 3 });
  assert.deepEqual(packs['7_7']['62_62'], { '992,20,992': 3 });
});

test('Firestore packed world saves overwrite complete dirty regional packs', async () => {
  resetFirestoreUsageForTests();
  const writes = [];
  const store = Object.create(FirebaseStore.prototype);
  store.worldEditStorageFormat = FIRESTORE_WORLD_EDIT_PACK_FORMAT;
  store.worldEditPackGeneration = 'generation-1';
  store.worldEditPacks = {
    '0_0': {
      '0_0': { '1,20,1': 3, '2,20,2': 4 },
      '1_0': { '20,20,1': 5 },
    },
  };
  store._worldDoc = () => ({ collection: () => ({ doc: id => ({ id }) }) });
  store.db = { batch: () => ({
    set(ref, value) { writes.push({ ref, value }); },
    async commit() {},
  }) };

  await store.saveWorldEditChunks({ '0_0': { '1,20,1': 6 } });

  assert.equal(writes.length, 1);
  assert.equal(writes[0].ref.id, 'generation-1__0_0');
  assert.deepEqual(writes[0].value.chunks, {
    '0_0': { '1,20,1': 6 },
    '1_0': { '20,20,1': 5 },
  });
  assert.equal(getFirestoreUsageSnapshot().daily.writes, 1);
});

test('Firestore maintenance work has an application-level timeout', async () => {
  const store = Object.create(FirebaseStore.prototype);
  const started = Date.now();
  await assert.rejects(
    () => store._boundedFirestore(() => new Promise(() => {}), 'test write', 20),
    /test write timed out after 20ms/,
  );
  assert.ok(Date.now() - started < 500, 'timeout should release the caller promptly');
});

test('Firestore migration retry waits until the next Pacific quota day', () => {
  const beforeMidnightPacific = Date.parse('2026-09-15T06:58:00Z');
  const delay = nextPacificQuotaResetDelay(beforeMidnightPacific);
  assert.ok(delay >= 4 * 60 * 1000 && delay <= 9 * 60 * 1000);
});

class BrokenFirebaseStore {
  constructor() { throw new Error('invalid credentials'); }
}

class FakeJsonStore {
  constructor(dir) { this.dir = dir; }
}

test('production fails closed when requested Firebase storage cannot initialize', () => {
  assert.throws(
    () => createStore({
      env: { STORE: 'firebase', NODE_ENV: 'production', DATA_DIR: 'should-not-be-used' },
      FirebaseStoreClass: BrokenFirebaseStore,
      JsonStoreClass: FakeJsonStore,
    }),
    /Firebase storage was requested but could not initialize: invalid credentials/,
  );
});

test('development may fall back to JSON when requested Firebase storage cannot initialize', () => {
  const originalWarn = console.warn;
  let warning = '';
  console.warn = message => { warning = message; };
  try {
    const store = createStore({
      env: { STORE: 'firebase', NODE_ENV: 'development', DATA_DIR: 'dev-data' },
      FirebaseStoreClass: BrokenFirebaseStore,
      JsonStoreClass: FakeJsonStore,
    });
    assert.equal(store.dir, 'dev-data');
    assert.match(warning, /falling back to JSON outside production/);
  } finally {
    console.warn = originalWarn;
  }
});

test('JSON remains the default storage backend', () => {
  const store = createStore({ env: { DATA_DIR: 'local-data' }, JsonStoreClass: FakeJsonStore });
  assert.equal(store.dir, 'local-data');
});

test('disabled profession objectives migrate to live progression steps', () => {
  assert.equal(sanitizeProfile({ progressionFocus: 'first_profession_contract' }).progressionFocus, 'e_rank_climb');
  assert.equal(sanitizeProfile({ progressionFocus: 'first_promotion_job', S: { lvl: 11 } }).progressionFocus, 'first_d_gate');
  assert.equal(sanitizeProfile({ progressionFocus: 'first_promotion_contract', S: { lvl: 11 } }).progressionFocus, 'first_d_gate');
  assert.equal(sanitizeProfile({ progressionFocus: 'next_adventurer_contract', abilitySpec: 'nightstalker', S: { lvl: 21, path: 'verdant' } }).progressionFocus, 'b_rank_pressure');
  assert.equal(sanitizeProfile({ progressionFocus: 'e_rank_climb', S: { lvl: 11 } }).progressionFocus, 'first_d_gate');
  assert.equal(sanitizeProfile({ progressionFocus: 'a_rank_climb', highestGateRankCleared: 4, S: { lvl: 41 } }).progressionFocus, 's_rank_climb');
  assert.equal(sanitizeProfile({ progressionFocus: 's_rank_climb', highestGateRankCleared: 5, S: { lvl: 51 } }).progressionFocus, 's_rank_complete');
});

test('concurrent world updates serialize the full read-modify-write transaction', async () => {
  const store = new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-store-')));
  await Promise.all([
    store.saveWorldEdits({ '1,2,3': 4 }),
    store.saveWorldProgress({ highestGateRankCleared: 2, roadSafety: 75 }),
    store.saveLandClaims({ '10,11': { owner: 'u_1234567890abcdef1234567890abcdef', name: 'Hunter', price: 5, boughtAt: 1 } }),
  ]);
  assert.deepEqual(await store.loadWorldEdits(), { '1,2,3': 4 });
  assert.equal((await store.loadWorldProgress()).highestGateRankCleared, 2);
  assert.equal((await store.loadLandClaims())['10,11'].price, 5);
});

test('JSON world persistence is isolated by shard while main keeps legacy paths', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-store-shards-'));
  const main = new JsonStore(dir, { shardId: 'main' });
  const shard2 = new JsonStore(dir, { shardId: 'shard-2' });

  await main.saveWorldEdits({ '1,2,3': 4 });
  await shard2.saveWorldEdits({ '5,6,7': 8 });
  await main.saveChests({ 'overworld:1,2,3': { slots: [{ id: 1, count: 2 }] } });
  await shard2.saveChests({ 'overworld:5,6,7': { slots: [{ id: 2, count: 3 }] } });

  assert.deepEqual(await main.loadWorldEdits(), { '1,2,3': 4 });
  assert.deepEqual(await shard2.loadWorldEdits(), { '5,6,7': 8 });
  assert.equal(fs.existsSync(path.join(dir, 'world.json')), true, 'main shard keeps the legacy world file');
  assert.equal(fs.existsSync(path.join(dir, 'shards', 'shard-2', 'world.json')), true, 'secondary shard writes under shards/');
  assert.equal((await main.loadChests())['overworld:5,6,7'], undefined);
  assert.equal((await shard2.loadChests())['overworld:1,2,3'], undefined);
});

test('shard ids are constrained to storage-safe names', () => {
  assert.equal(cleanShardId('Shard-2'), 'shard-2');
  assert.equal(cleanShardId('../bad'), 'main');
  assert.equal(cleanShardId(''), 'main');
});
