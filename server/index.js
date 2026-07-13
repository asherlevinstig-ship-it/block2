const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('@colyseus/core');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { Encoder } = require('@colyseus/schema');
const { validateStartup } = require('./startup-config');
const { securityHeaders } = require('./security-headers');
const { metricsHttpHandler } = require('./metrics-registry');

Encoder.BUFFER_SIZE = 256 * 1024;

async function main() {
  const config = await validateStartup();
  process.env.DATA_DIR = config.dataDir;

  // Load stateful services only after configuration and storage preflight pass.
  const { GameRoom } = require('./rooms/GameRoom');
  const { DungeonRoom } = require('./rooms/DungeonRoom');
  const { getAuthService } = require('./auth');

  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders({ production: config.production }));
  getAuthService().attach(app);
  let gameServer;

  if (process.env.BLOCKCRAFT_E2E === '1') {
    app.post('/__e2e/shutdown', (_req, res) => {
      res.status(202).json({ ok: true });
      setTimeout(() => gameServer.gracefullyShutdown(true), 25);
    });
  }
  if (process.env.BLOCKCRAFT_METRICS === '1') {
    app.get('/__metrics', metricsHttpHandler({
      token: process.env.BLOCKCRAFT_METRICS_TOKEN || '',
      production: config.production,
      allowMissingToken: process.env.BLOCKCRAFT_E2E === '1',
    }));
  }

  app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
  app.use(express.static(path.join(__dirname, '..', 'client')));

  const colyseusBrowserSdk = path.join(path.dirname(require.resolve('@colyseus/sdk/package.json')), 'dist', 'colyseus.js');
  app.get('/colyseus.js', (_req, res) => res.sendFile(colyseusBrowserSdk));
  app.get('/three.js', (_req, res) => res.sendFile(require.resolve('three/build/three.min.js')));

  const server = http.createServer(app);
  gameServer = new Server({
    transport: new WebSocketTransport({ server }),
    gracefullyShutdown: process.env.BLOCKCRAFT_E2E !== '1',
  });

  gameServer.define('blockcraft', GameRoom).filterBy(['shardId']);
  gameServer.define('dungeon', DungeonRoom).filterBy(['gateId']);

  const PORT = process.env.PORT || 2567;
  await gameServer.listen(PORT);
  console.log('Blockcraft server running — open http://localhost:' + PORT);
}

main().catch(error => {
  console.error('[startup] ' + error.message);
  process.exitCode = 1;
});
