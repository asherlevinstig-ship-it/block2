const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { GameRoom } = require('./rooms/GameRoom');
const { getAuthService } = require('./auth');

const app = express();
app.set('trust proxy', 1);
getAuthService().attach(app);
let gameServer;

if (process.env.BLOCKCRAFT_E2E === '1') {
  app.post('/__e2e/shutdown', (_req, res) => {
    res.status(202).json({ ok: true });
    setTimeout(() => gameServer.gracefullyShutdown(true), 25);
  });
}

// runtime-neutral rules consumed by both the Node server and browser client
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

// the game client
app.use(express.static(path.join(__dirname, '..', 'client')));

// serve the colyseus.js browser SDK (no CDN needed). The npm package's
// dist/colyseus.js is a Node bundle that references Buffer/ws at init and breaks
// in browsers, so we serve a prebuilt standalone browser IIFE vendored under
// client/vendor (regenerate with: npx esbuild colyseus.js --bundle --format=iife
// --global-name=Colyseus --platform=browser --outfile=client/vendor/colyseus.browser.js).
const colyseusBrowserSdk = path.join(__dirname, '..', 'client', 'vendor', 'colyseus.browser.js');
app.get('/colyseus.js', (req, res) => res.sendFile(colyseusBrowserSdk));
app.get('/three.js', (req, res) => res.sendFile(require.resolve('three/build/three.min.js')));

const server = http.createServer(app);
gameServer = new Server({
  transport: new WebSocketTransport({ server }),
  gracefullyShutdown: process.env.BLOCKCRAFT_E2E !== '1',
});

gameServer.define('blockcraft', GameRoom);

const PORT = process.env.PORT || 2567;
server.listen(PORT, () =>
  console.log('Blockcraft server running — open http://localhost:' + PORT));
