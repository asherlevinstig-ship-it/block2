// State-cluster guard.
//
// onCreate's room state used to be ~70 fields initialized in one block with no
// boundaries. They're now grouped into init*State() methods, each owning a named
// cluster (see combat/dungeon/events/dragons mixins and GameRoom.initPersistenceState).
//
// This test pins each cluster's exact field set. Adding, removing, or moving a
// field in a cluster fails here until the manifest below is updated — so growing
// the room's shared state becomes a deliberate, reviewed act instead of a silent
// one. (It guards the cluster contracts, not the full room surface; a field added
// directly in onCreate outside every cluster is covered structurally by the
// integration boot, not here.)

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// Mock colyseus so requiring GameRoom only needs its prototype (mixins applied at
// load), matching authority.test.js. We never instantiate Room or run onCreate.
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'colyseus') return { Room: class {} };
  if (request === '@colyseus/schema') return { Schema: class {}, MapSchema: class extends Map {}, defineTypes() {} };
  return originalLoad(request, parent, isMain);
};

const { GameRoom } = require('../rooms/GameRoom');

// Pure field-setter clusters: calling the method on a bare object must produce
// exactly these own keys.
const CLUSTERS = {
  initCombatState: [
    'sArrows', 'sFireballs', 'sMeteors', 'dragonBreathCd', 'blackholeCd', 'legendaryCd',
    'dragonAbilityCd', 'phoenixUsed', 'abilityState', 'abilityBuffs', 'pvel',
  ],
  initDungeonState: ['dungeonLobbies', 'dungeonPingAt', 'gateSeq', 'gateTtls', 'gateLootedChests', 'gateTimer', 'gateTtl'],
  initPersistenceState: [
    'profiles', 'tokens', 'dirtyWorld', 'dirtyWorldProgress', 'dirtyLandClaims', 'dirtyChests',
    'dirtyFurnaces', 'dirtyIncubations', 'dirtyGates', 'dirtyTeams', 'dirtyGuilds', 'dirtyNests',
    'dirtyPlayers', 'lastSaveMsg',
  ],
  initDragonState: ['dragonIncubations', 'nestDragons'],
};

for (const [method, expected] of Object.entries(CLUSTERS)) {
  test(`${method} initializes exactly its field cluster`, () => {
    const room = Object.create(GameRoom.prototype);
    room[method]();
    assert.deepEqual(Object.keys(room).sort(), [...expected].sort());
  });
}

// initEventsState seeds serverEvent via two mixin helpers; stub them so the test
// pins the field cluster, not the event-selection logic.
test('initEventsState initializes exactly its field cluster', () => {
  const room = Object.create(GameRoom.prototype);
  const stubs = ['createIdleEvent', 'pickNextServerEvent'];
  room.createIdleEvent = () => ({});
  room.pickNextServerEvent = () => ({ kind: 'parkour' });
  room.initEventsState();
  const fields = Object.keys(room).filter(k => !stubs.includes(k));
  assert.deepEqual(fields.sort(), [
    'eventSeq', 'skyshipEpoch', 'dayEpoch', 'sleepingPlayers', 'serverEvent',
    'eventInstances', 'activeEventInstanceId', 'eventCourseBlocks', 'eventTransientEditKeys',
    'weatherUntil', 'nextLightningAt',
  ].sort());
});
