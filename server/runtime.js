const path = require('path');
const express = require('express');
const { Encoder } = require('@colyseus/schema');
const { validateStartup } = require('./startup-config');
const { securityHeaders } = require('./security-headers');
const { metricsHttpHandler } = require('./metrics-registry');

Encoder.BUFFER_SIZE = 256 * 1024;

async function prepareRuntime(env = process.env) {
  const config = await validateStartup(env);
  process.env.DATA_DIR = config.dataDir;
  return config;
}

function attachHttpRoutes(app, config, getGameServer = () => null) {
  const { getAuthService } = require('./auth');

  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders({ production: config.production }));
  getAuthService().attach(app);

  if (process.env.BLOCKCRAFT_E2E === '1') {
    app.post('/__e2e/shutdown', (_req, res) => {
      res.status(202).json({ ok: true });
      const gameServer = getGameServer();
      if (gameServer) setTimeout(() => gameServer.gracefullyShutdown(true), 25);
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
}

module.exports = { prepareRuntime, attachHttpRoutes };
