const test = require('node:test');
const assert = require('node:assert/strict');
const { registerRoom, unregisterRoom, metricsSnapshot, metricsHttpHandler, _activeRooms } = require('../metrics-registry');

function fakeRoom({ roomId = 'room-a', type = 'overworld', shardId = 'main', gateId = '', clients = 0, players = 0, mobs = 0 } = {}) {
  return {
    roomId,
    shardId,
    maxClients: type === 'dungeon' ? 8 : 16,
    instance: gateId ? { id: gateId } : null,
    metricsSnapshot() {
      return {
        players,
        connectedClients: clients,
        owPlayers: type === 'overworld' ? players : 0,
        dgnPlayers: type === 'dungeon' ? players : 0,
        instances: type === 'dungeon' ? 1 : 0,
        mobs,
        owMobs: type === 'overworld' ? mobs : 0,
        dgnMobs: type === 'dungeon' ? mobs : 0,
        tickAvgMs: 3,
        tickMaxMs: 9,
        tickOverBudget: 1,
        persistenceOperations: 2,
        persistenceFailures: type === 'dungeon' ? 1 : 0,
        rejectedMessages: 4,
      };
    },
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('metrics registry aggregates overworld shards and dungeon rooms', () => {
  _activeRooms.clear();
  const main = fakeRoom({ roomId: 'ow-main', shardId: 'main', clients: 8, players: 8, mobs: 12 });
  const shard2 = fakeRoom({ roomId: 'ow-2', shardId: 'shard-2', clients: 6, players: 6, mobs: 9 });
  const dungeon = fakeRoom({ roomId: 'dgn-1', type: 'dungeon', gateId: 'gate-a', clients: 8, players: 8, mobs: 20 });
  registerRoom(main, 'overworld', { shardId: 'main' });
  registerRoom(shard2, 'overworld', { shardId: 'shard-2' });
  registerRoom(dungeon, 'dungeon', { gateId: 'gate-a' });

  const snapshot = metricsSnapshot();
  assert.equal(snapshot.totals.rooms, 3);
  assert.equal(snapshot.totals.clients, 22);
  assert.equal(snapshot.totals.players, 22);
  assert.equal(snapshot.totals.persistenceFailures, 1);
  assert.deepEqual(snapshot.shards.map(s => [s.shardId, s.clients]), [['main', 8], ['shard-2', 6]]);
  assert.deepEqual(snapshot.dungeons.map(d => [d.gateId, d.clients, d.maxClients]), [['gate-a', 8, 8]]);

  unregisterRoom(main);
  unregisterRoom(shard2);
  unregisterRoom(dungeon);
});

test('metrics endpoint requires configured tokens and production token setup', () => {
  const missingToken = mockResponse();
  metricsHttpHandler()({ headers: {} }, missingToken);
  assert.equal(missingToken.statusCode, 403);

  const e2eOpen = mockResponse();
  metricsHttpHandler({ allowMissingToken: true })({ headers: {} }, e2eOpen);
  assert.equal(e2eOpen.statusCode, 200);

  const unauthorized = mockResponse();
  metricsHttpHandler({ token: 'secret' })({ headers: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);

  const authorized = mockResponse();
  metricsHttpHandler({ token: 'secret' })({ headers: { authorization: 'Bearer secret' } }, authorized);
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.headers['Cache-Control'], 'no-store');
  assert.ok(authorized.body && authorized.body.totals);

  const unsafeProduction = mockResponse();
  metricsHttpHandler({ production: true })({ headers: {} }, unsafeProduction);
  assert.equal(unsafeProduction.statusCode, 403);
});
