const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const browserSdkPath = path.join(path.dirname(require.resolve('@colyseus/sdk/package.json')), 'dist', 'colyseus.js');

function assertColyseusSchemaCompatibility() {
  const browserSdk = fs.readFileSync(browserSdkPath, 'utf8');
  const bundled = browserSdk.match(/@colyseus\/schema\s+([0-9]+\.[0-9]+\.[0-9]+)/);
  const schemaPackagePath = path.join(path.dirname(require.resolve('@colyseus/schema')), '..', 'package.json');
  const serverVersion = JSON.parse(fs.readFileSync(schemaPackagePath, 'utf8')).version;
  if (!bundled || bundled[1] !== serverVersion) {
    throw new Error('Colyseus schema mismatch: browser bundle uses '+(bundled ? bundled[1] : 'unknown')+' but server uses '+serverVersion);
  }
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
assertColyseusSchemaCompatibility();

copyDir(path.join(root, 'client'), dist);
copyDir(path.join(root, 'shared'), path.join(dist, 'shared'));
copyFile(require.resolve('three/build/three.min.js'), path.join(dist, 'three.js'));
copyFile(browserSdkPath, path.join(dist, 'colyseus.js'));

console.log('Built static client in dist/');
