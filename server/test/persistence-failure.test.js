const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Reuse the authority harness stubs before loading GameRoom.
const Module = require('module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === '@colyseus/core') return { Room: class {}, matchMaker: { state: 1, MatchMakerState: { SHUTTING_DOWN: 2 } }, CloseCode: { CONSENTED: 4000 } };
  if (request === '@colyseus/schema') return { Schema: class {}, MapSchema: class extends Map {}, defineTypes() {} };
  return originalLoad(request, parent, isMain);
};

const { JsonStore } = require('../store');
const { GameRoom } = require('../rooms/GameRoom');
Module._load = originalLoad;

const tempStore = () => new JsonStore(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-persist-')));

test('a disk write error rejects the save and the serialized queue recovers', async () => {
  const store = tempStore();
  const originalWrite = store._writeNow.bind(store);
  let fail = true;
  store._writeNow = async (...args) => {
    if (fail) { fail = false; throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); }
    return originalWrite(...args);
  };
  await assert.rejects(() => store.savePlayer('u_disk_error', { name: 'First' }), /disk full/);
  await store.savePlayer('u_disk_error', { name: 'Recovered' });
  assert.equal((await store.loadPlayer('u_disk_error')).name, 'Recovered');
});

test('corrupt profile files fail loudly instead of being replaced with defaults', async () => {
  const store = tempStore();
  const file = store._pfile('u_corrupt_profile');
  fs.writeFileSync(file, '{ definitely not json');
  await assert.rejects(() => store.loadPlayer('u_corrupt_profile'), /corrupt profile file/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{ definitely not json');
});

test('an interrupted atomic rename preserves the previous durable file', async () => {
  const store = tempStore();
  await store.savePlayer('u_atomic', { name: 'Durable' });
  const originalWrite = store._writeNow.bind(store);
  store._writeNow = async (file, value) => {
    await fs.promises.writeFile(file + '.tmp', JSON.stringify(value));
    throw Object.assign(new Error('simulated interruption before rename'), { code: 'EIO' });
  };
  await assert.rejects(() => store.savePlayer('u_atomic', { name: 'Interrupted' }), /simulated interruption/);
  assert.equal((await store.loadPlayer('u_atomic')).name, 'Durable');
  store._writeNow = originalWrite;
  await store.savePlayer('u_atomic', { name: 'Later' });
  assert.equal((await store.loadPlayer('u_atomic')).name, 'Later');
});

test('transient atomic rename errors are retried before failing the save', async () => {
  const store = tempStore();
  const originalRename = store._renameFile.bind(store);
  const delays = [];
  let attempts = 0;
  store._sleep = async ms => { delays.push(ms); };
  store._renameFile = async (...args) => {
    attempts++;
    if (attempts === 1) throw Object.assign(new Error('temporary rename lock'), { code: 'EPERM' });
    return originalRename(...args);
  };

  await store.savePlayer('u_retry_rename', { name: 'Retried' });
  assert.equal((await store.loadPlayer('u_retry_rename')).name, 'Retried');
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [10]);
});

test('concurrent JsonStore instances serialize writes to the same player file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-persist-shared-'));
  const first = new JsonStore(dir), second = new JsonStore(dir);
  const originalRename = first._renameFile.bind(first);
  first._renameFile = async (...args) => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return originalRename(...args);
  };

  await Promise.all([
    first.savePlayer('u_shared_queue', { name: 'First' }),
    second.savePlayer('u_shared_queue', { name: 'Second' }),
  ]);
  const saved = await first.loadPlayer('u_shared_queue');
  assert.ok(['First', 'Second'].includes(saved.name));
  assert.equal(fs.readdirSync(path.join(dir, 'players')).filter(name => name.includes('.tmp')).length, 0);
});

test('non-transient atomic rename errors still fail without retrying', async () => {
  const store = tempStore();
  let attempts = 0;
  store._sleep = async () => { throw new Error('sleep should not be called'); };
  store._renameFile = async () => {
    attempts++;
    throw Object.assign(new Error('permanent rename failure'), { code: 'EIO' });
  };

  await assert.rejects(() => store.savePlayer('u_no_retry_rename', { name: 'Nope' }), /permanent rename failure/);
  assert.equal(attempts, 1);
});

test('concurrent room flushes execute serially and persist every dirty profile', async () => {
  const room = Object.create(GameRoom.prototype);
  room.completeFurnaces = () => {};
  for (const flag of ['dirtyWorld','dirtyWorldProgress','dirtyLandClaims','dirtyChests','dirtyFurnaces','dirtyIncubations','dirtyNests','dirtyGates','dirtyTeams','dirtyGuilds']) room[flag] = false;
  room.dirtyPlayers = new Set(['one']);
  room.profiles = new Map([['one', { name: 'One' }], ['two', { name: 'Two' }]]);
  let active = 0, maxActive = 0;
  const saved = [];
  room.store = {
    async savePlayer(token) {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      saved.push(token); active--;
    },
  };
  const first = room.flush();
  room.dirtyPlayers.add('two');
  const second = room.flush();
  await Promise.all([first, second]);
  assert.equal(maxActive, 1);
  assert.deepEqual(saved.sort(), ['one', 'two']);
  assert.equal(room.dirtyPlayers.size, 0);
});
