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
        inboundMessages: 10,
        outboundMessages: 20,
        outboundBytes: type === 'dungeon' ? 8000 : 4000,
        outboundBytesByKind: type === 'dungeon' ? { statePatch: 6000, message: 2000 } : { statePatch: 3000, message: 1000 },
        inboundMessagesPerSecond: 5,
        outboundMessagesPerSecond: 7,
        outboundBytesPerSecond: type === 'dungeon' ? 2000 : 1000,
        outboundBytesPerSecondByKind: type === 'dungeon' ? { statePatch: 1500, message: 500 } : { statePatch: 750, message: 250 },
        outboundBytesPerClientPerSecond: type === 'dungeon' ? 250 : 125,
        outboundPeakClientBytesPerSecond: type === 'dungeon' ? 400 : 175,
        disconnects: type === 'dungeon' ? 1 : 0,
        unexpectedDisconnects: 0,
        dungeonMobs: type === 'dungeon' ? mobs : 0,
        visibleMobLinks: type === 'dungeon' ? 40 : 0,
        avgVisibleMobsPerClient: type === 'dungeon' ? 5 : 0,
        hiddenMobLinksAvoided: type === 'dungeon' ? 120 : 0,
        bossVisibleLinks: type === 'dungeon' ? 8 : 0,
        bossMobs: type === 'dungeon' ? 1 : 0,
        dungeonPlayers: type === 'dungeon' ? players : 0,
        visiblePlayerLinks: type === 'dungeon' ? 36 : 0,
        avgVisiblePlayersPerClient: type === 'dungeon' ? 4.5 : 0,
        hiddenPlayerLinksAvoided: type === 'dungeon' ? 28 : 0,
        selfPlayerLinks: type === 'dungeon' ? 8 : 0,
        downedPlayerLinks: type === 'dungeon' ? 7 : 0,
        interestViewAdds: type === 'dungeon' ? 42 : 0,
        interestViewRemoves: type === 'dungeon' ? 2 : 0,
        interestViewAddsPerSecond: type === 'dungeon' ? 4 : 0,
        interestViewRemovesPerSecond: type === 'dungeon' ? 1 : 0,
        dungeonFxSent: type === 'dungeon' ? 12 : 0,
        dungeonFxSkipped: type === 'dungeon' ? 20 : 0,
        dungeonFxFilteredEvents: type === 'dungeon' ? 3 : 0,
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
  assert.equal(snapshot.totals.inboundMessages, 30);
  assert.equal(snapshot.totals.outboundMessages, 60);
  assert.equal(snapshot.totals.outboundBytes, 16000);
  assert.equal(snapshot.totals.outboundBytesPerSecond, 4000);
  assert.deepEqual(snapshot.totals.outboundBytesByKind, { statePatch: 12000, message: 4000 });
  assert.deepEqual(snapshot.totals.outboundBytesPerSecondByKind, { statePatch: 3000, message: 1000 });
  assert.equal(snapshot.totals.outboundBytesPerClientPerSecond, 181.82);
  assert.equal(snapshot.totals.outboundPeakClientBytesPerSecond, 400);
  assert.equal(snapshot.totals.disconnects, 1);
  assert.equal(snapshot.totals.visibleMobLinks, 40);
  assert.equal(snapshot.totals.hiddenMobLinksAvoided, 120);
  assert.equal(snapshot.totals.dungeonClients, 8);
  assert.equal(snapshot.totals.avgVisibleMobsPerDungeonClient, 5);
  assert.equal(snapshot.totals.dungeonPlayers, 8);
  assert.equal(snapshot.totals.visiblePlayerLinks, 36);
  assert.equal(snapshot.totals.hiddenPlayerLinksAvoided, 28);
  assert.equal(snapshot.totals.avgVisiblePlayersPerDungeonClient, 4.5);
  assert.equal(snapshot.totals.dungeonFxSent, 12);
  assert.equal(snapshot.totals.dungeonFxSkipped, 20);
  assert.equal(snapshot.totals.persistenceFailures, 1);
  assert.deepEqual(snapshot.shards.map(s => [s.shardId, s.clients, s.inboundMessagesPerSecond, s.outboundBytesPerSecond, s.outboundBytesPerSecondByKind.statePatch]), [['main', 8, 5, 1000, 750], ['shard-2', 6, 5, 1000, 750]]);
  assert.deepEqual(snapshot.dungeons.map(d => [d.gateId, d.clients, d.maxClients, d.disconnects, d.visibleMobLinks, d.hiddenMobLinksAvoided, d.visiblePlayerLinks, d.hiddenPlayerLinksAvoided, d.dungeonFxSkipped, d.outboundBytesPerSecond, d.outboundBytesPerSecondByKind.statePatch]), [['gate-a', 8, 8, 1, 40, 120, 36, 28, 20, 2000, 1500]]);

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
