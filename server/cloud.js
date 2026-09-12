const { defineRoom, defineServer } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { GameRoom } = require('./rooms/GameRoom');
const { DungeonRoom } = require('./rooms/DungeonRoom');
const { prepareRuntime, attachHttpRoutes } = require('./runtime');
const { getActiveRooms } = require('./metrics-registry');
const { restartWarningDelay, warnForRestart } = require('./restart-warning');
const runtime = prepareRuntime();

const server = defineServer({
  rooms: {
    blockcraft: defineRoom(GameRoom).filterBy(['shardId']),
    dungeon: defineRoom(DungeonRoom).filterBy(['gateId']),
  },
  transport: new WebSocketTransport(),
  express: async app => {
    attachHttpRoutes(app, await runtime);
  },
});

server.onBeforeShutdown(async () => {
  const result = await warnForRestart(getActiveRooms(), { delayMs: restartWarningDelay() });
  console.log(`[shutdown] warned ${result.rooms} active room(s), flushed progress, and completed the ${result.delayMs}ms restart countdown`);
});

module.exports = { server };
