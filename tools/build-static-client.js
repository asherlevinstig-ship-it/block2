const fs = require('fs');
const path = require('path');
const { browserSdkBundle } = require('../server/browser-sdk');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function assertColyseusSchemaCompatibility() {
  const schemaPackagePath = path.join(path.dirname(require.resolve('@colyseus/schema')), '..', 'package.json');
  const serverVersion = JSON.parse(fs.readFileSync(schemaPackagePath, 'utf8')).version;
  const declaredVersion = require(path.join(root, 'package.json')).dependencies['@colyseus/schema'];
  if (declaredVersion !== serverVersion) {
    throw new Error('Colyseus schema mismatch: package.json pins '+declaredVersion+' but npm resolved '+serverVersion);
  }
  return serverVersion;
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  fs.cpSync(from, to, {
    recursive: true,
    filter: source => !/[\\/]node_modules[\\/]/.test(source),
  });
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const schemaVersion = assertColyseusSchemaCompatibility();

copyDir(path.join(root, 'client'), dist);
copyDir(path.join(root, 'shared'), path.join(dist, 'shared'));
copyFile(require.resolve('three/build/three.min.js'), path.join(dist, 'three.js'));
// The SDK's prebuilt UMD file embeds an older schema decoder. Bundle from the
// installed modules so browser and server execute the same StateView fixes.
fs.writeFileSync(path.join(dist, 'colyseus.js'), browserSdkBundle());
fs.writeFileSync(path.join(dist, 'build-info.json'), JSON.stringify({
  schemaVersion,
  commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null,
}));

console.log('Built static client in dist/');
