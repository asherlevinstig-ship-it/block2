const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

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

copyDir(path.join(root, 'client'), dist);
copyDir(path.join(root, 'shared'), path.join(dist, 'shared'));
copyFile(require.resolve('three/build/three.min.js'), path.join(dist, 'three.js'));
copyFile(path.join(path.dirname(require.resolve('@colyseus/sdk/package.json')), 'dist', 'colyseus.js'), path.join(dist, 'colyseus.js'));

console.log('Built static client in dist/');
