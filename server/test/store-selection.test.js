const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, JsonStore } = require('../store');

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
