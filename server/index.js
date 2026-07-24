const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { prepareRuntime, attachHttpRoutes } = require('./runtime');
const { prewarmOverworldRoom } = require('./room-prewarm');

async function main() {
  const config = await prepareRuntime();

  // Load stateful services only after configuration and storage preflight pass.
  const { GameRoom } = require('./rooms/GameRoom');
  const { DungeonRoom } = require('./rooms/DungeonRoom');

  const app = express();
  let gameServer;
  attachHttpRoutes(app, config, () => gameServer);

  const server = http.createServer(app);
  gameServer = new Server({
    transport: new WebSocketTransport({ server }),
    gracefullyShutdown: process.env.BLOCKCRAFT_E2E !== '1',
  });

  gameServer.define('blockcraft', GameRoom).filterBy(['shardId']);
  gameServer.define('dungeon', DungeonRoom).filterBy(['gateId']);

  const PORT = process.env.PORT || 2567;
  await gameServer.listen(PORT);
  await prewarmOverworldRoom(config);
  if (typeof process.send === 'function') process.send('ready');
  console.log('Blockcraft server running — open http://localhost:' + PORT);
}

main().catch(error => {
  console.error('[startup] ' + error.message);
  process.exitCode = 1;
});
