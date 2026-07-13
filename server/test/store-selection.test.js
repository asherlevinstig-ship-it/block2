const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, JsonStore, cleanShardId } = require('../store');

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
