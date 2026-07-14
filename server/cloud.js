const { defineRoom, defineServer } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { GameRoom } = require('./rooms/GameRoom');
const { DungeonRoom } = require('./rooms/DungeonRoom');
const { prepareRuntime, attachHttpRoutes } = require('./runtime');

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
  beforeListen: async () => {
    await runtime;
  },
});

module.exports = { server };
