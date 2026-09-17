const path = require('path');
const express = require('express');
const compression = require('compression');
const { Encoder } = require('@colyseus/schema');
const { browserSdkBundle } = require('./browser-sdk');
const schemaVersion = require(path.join(path.dirname(require.resolve('@colyseus/schema')), '..', 'package.json')).version;
const { validateStartup } = require('./startup-config');
const { securityHeaders } = require('./security-headers');
const { metricsHttpHandler, readinessHttpHandler } = require('./metrics-registry');

function staticCacheControl(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  if (/\.(?:html|json)$/i.test(normalized)) return 'no-cache';
  if (/-[0-9a-f]{12}\.[^/]+$/i.test(normalized)) return 'public, max-age=31536000, immutable';
  if (/\.(?:png|jpe?g|webp|gif|svg|mp3|mp4|ogg|wav|woff2?)$/i.test(normalized)) return 'public, max-age=86400, stale-while-revalidate=604800';
  return 'public, max-age=3600, must-revalidate';
}

// The generated overworld plus filtered entity views can exceed Schema's
// default encoder allocation during a client's initial state sync.
Encoder.BUFFER_SIZE = 2 * 1024 * 1024;

async function prepareRuntime(env = process.env) {
  const config = await validateStartup(env);
  process.env.DATA_DIR = config.dataDir;
  return config;
}

function attachHttpRoutes(app, config, getGameServer = () => null) {
  const { getAuthService } = require('./auth');

  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders({ production: config.production }));
  app.use(compression({ threshold: 1024 }));
  app.get('/healthz', (_req, res) => res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime() * 100) / 100,
    storage: config.storage,
    authBackend: String(process.env.AUTH_BACKEND || 'file').toLowerCase(),
    schemaVersion,
    commit: process.env.GIT_COMMIT || process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || null,
    readyPath: '/readyz',
  }));
  app.get('/readyz', readinessHttpHandler());
  getAuthService().attach(app);

  if (process.env.BLOCKCRAFT_E2E === '1') {
    app.post('/__e2e/flush', async (_req, res) => {
      const { getActiveRooms } = require('./metrics-registry');
      const rooms = getActiveRooms();
      const results = await Promise.allSettled(rooms.map(room => typeof room.flush === 'function' ? room.flush() : null));
      const rejected = results.filter(result => result.status === 'rejected');
      res.status(rejected.length ? 500 : 200).json({ ok: rejected.length === 0, rooms: rooms.length, rejected: rejected.length });
    });
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

  const staticOptions = {
    etag: true,
    lastModified: true,
    setHeaders(res, file) {
      res.setHeader('Cache-Control', staticCacheControl(file));
    },
  };
  app.use('/shared', express.static(path.join(__dirname, '..', 'shared'), staticOptions));
  app.use(express.static(path.join(__dirname, '..', 'client'), staticOptions));

  // Serve the same schema-matched bundle used by Vercel, including in local tests.
  const colyseusBrowserSdk = browserSdkBundle();
  app.get('/colyseus.js', (_req, res) => res.type('application/javascript').send(colyseusBrowserSdk));
  app.get('/three.js', (_req, res) => res.sendFile(require.resolve('three/build/three.min.js')));

  app.use((err, _req, res, next) => {
    if (err instanceof URIError || err && err.status === 400 && /decode/i.test(String(err.message || ''))) {
      return res.status(400).type('text/plain').send('Bad request');
    }
    return next(err);
  });
}

module.exports = { prepareRuntime, attachHttpRoutes, staticCacheControl };
