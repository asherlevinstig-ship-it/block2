const fs = require('fs');
const path = require('path');
const { buildSync } = require('esbuild');

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
buildSync({
  entryPoints: ['@colyseus/sdk'],
  absWorkingDir: root,
  outfile: path.join(dist, 'colyseus.js'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'Colyseus',
  banner: { js: '// Blockcraft Colyseus browser bundle - @colyseus/schema '+schemaVersion },
  define: { 'process.env.NODE_ENV': '"production"' },
});

console.log('Built static client in dist/');
