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
const { GameRoom, claimGlobalWorld, releaseGlobalWorld } = require('../rooms/GameRoom');
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

test('an immediate save cannot clear newer whole-profile mutations', async () => {
  for (const [label, mutate, expected] of [
    ['gold', prof => { prof.gold = 200; }, prof => prof.gold === 200],
    ['xp', prof => { prof.xp = 900; }, prof => prof.xp === 900],
    ['quest', prof => { prof.quests = { gate: 'complete' }; }, prof => prof.quests.gate === 'complete'],
    ['position', prof => { prof.pos = [10, 20, 30]; }, prof => prof.pos[0] === 10],
  ]) {
    const room = Object.create(GameRoom.prototype);
    room.initPersistenceState();
    room.clients = [];
    const token = 'revision_' + label;
    const prof = { gold: 100, xp: 1, quests: {}, pos: [0, 0, 0], inv: [] };
    room.profiles.set(token, prof);
    room.dirtyPlayers.add(token);
    let finishFirst;
    let firstSnapshot;
    room.store = {
      savePlayer(_token, snapshot) {
        if (!firstSnapshot) {
          firstSnapshot = JSON.parse(JSON.stringify(snapshot));
          return new Promise(resolve => { finishFirst = resolve; });
        }
        firstSnapshot = JSON.parse(JSON.stringify(snapshot));
        return Promise.resolve();
      },
    };

    const first = room.savePlayerProfileNow(token, prof);
    await new Promise(resolve => setImmediate(resolve));
    mutate(prof);
    room.dirtyPlayers.add(token);
    finishFirst();
    assert.equal(await first, true);
    assert.equal(room.dirtyPlayers.has(token), true, label + ' mutation remains dirty after the stale save');
    assert.equal(expected(firstSnapshot), false, label + ' was not present in the stale snapshot');

    await room.flushDirtyPlayers();
    assert.equal(expected(firstSnapshot), true, label + ' is written by the follow-up flush');
    assert.equal(room.dirtyPlayers.has(token), false);
  }
});

test('JSON transaction journal rolls forward an interrupted chest/player transfer', async () => {
  const store = tempStore();
  await store.savePlayer('journal_a', { name: 'A', gold: 10, inv: [{ id: 1, count: 2 }] });
  await store.savePlayer('journal_b', { name: 'B', gold: 20, inv: [] });
  await store.saveChests({ 'overworld:1,2,3': { slots: [{ id: 2, count: 3 }] } });

  const originalWrite = store._writeNow.bind(store);
  let interrupted = false;
  store._writeNow = async (file, value) => {
    if (!interrupted && file.endsWith(path.join('players', 'journal_b.json'))) {
      interrupted = true;
      throw new Error('simulated crash between transaction records');
    }
    return originalWrite(file, value);
  };

  await assert.rejects(() => store.commitTransaction({
    id: 'transfer_1',
    players: {
      journal_a: { name: 'A', gold: 5, inv: [{ id: 1, count: 1 }] },
      journal_b: { name: 'B', gold: 25, inv: [{ id: 1, count: 1 }] },
    },
    chests: { 'overworld:1,2,3': { slots: [{ id: 2, count: 2 }] } },
  }), /simulated crash/);

  const restarted = new JsonStore(store.dir);
  assert.equal(await restarted.recoverTransactions(), true);
  assert.equal((await restarted.loadPlayer('journal_a')).gold, 5);
  assert.equal((await restarted.loadPlayer('journal_b')).gold, 25);
  assert.equal((await restarted.loadChests())['overworld:1,2,3'].slots[0].count, 2);
  assert.equal(await restarted.recoverTransactions(), false, 'completed journal is not replayed twice');
});

test('failed overworld creation disposes without flushing partial persistence state', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'rooms', 'GameRoom.js'), 'utf8');
  assert.match(source, /this\.createFailed\s*=\s*true;[\s\S]*this\._events\.emit\('dispose'\)/,
    'a rejected room creation must trigger immediate core cleanup');
  assert.ok(source.indexOf('registerRoom(this') < source.indexOf('this.startTownMapBackfill();'),
    'the full-player migration must not start until room creation has succeeded');

  const room = Object.create(GameRoom.prototype);
  room.roomId = 'failed-room';
  room.shardId = 'failed-shard';
  room.clients = [];
  room.state = null;
  room.createFailed = true;
  let flushed = false;
  room.flush = async () => { flushed = true; };

  claimGlobalWorld(room, room.shardId);
  await room.onDispose();

  assert.equal(flushed, false, 'a half-built room must not write incomplete state');
  const successor = {};
  assert.doesNotThrow(() => claimGlobalWorld(successor, room.shardId), 'disposing the failed room releases its shard lease');
  releaseGlobalWorld(successor);
});
