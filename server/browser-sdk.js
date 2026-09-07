const path = require('node:path');
const { buildSync } = require('esbuild');

const root = path.join(__dirname, '..');
const schemaVersion = require(path.join(path.dirname(require.resolve('@colyseus/schema')), '..', 'package.json')).version;
let bundle;

function browserSdkBundle() {
  if (bundle) return bundle;
  if (require('../package.json').dependencies['@colyseus/schema'] !== schemaVersion) {
    throw new Error('Installed Colyseus schema does not match the pinned server version');
  }
  bundle = buildSync({
    entryPoints: ['@colyseus/sdk'], absWorkingDir: root,
    bundle: true, minify: true, write: false,
    platform: 'browser', format: 'iife', globalName: 'Colyseus',
    banner: { js: '// Blockcraft Colyseus browser bundle - @colyseus/schema ' + schemaVersion },
    define: { 'process.env.NODE_ENV': '"production"' },
  }).outputFiles[0].text;
  return bundle;
}

module.exports = { browserSdkBundle, schemaVersion };
