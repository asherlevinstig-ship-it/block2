const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const client = path.join(root, 'client');
const html = fs.readFileSync(path.join(client, 'index.html'), 'utf8');
const splashMatch = /<img[^>]+src="([^"]*bggame-[0-9a-f]{12}\.webp)"/i.exec(html);
assert.ok(splashMatch, 'landing splash must use a fingerprinted WebP');
const splash = path.join(client, splashMatch[1].replace(/^\//, '').replace(/^assets[\\/]/, 'assets/'));
const splashBytes = fs.statSync(splash).size;
assert.ok(splashBytes <= 512 * 1024, `landing splash ${splashBytes} bytes exceeded 512 KB`);
assert.doesNotMatch(html, /<(?:audio|video)[^>]+preload="auto"/i, 'landing media must not preload automatically');
assert.equal(fs.existsSync(path.join(client, 'assets', 'bggame.png')), false, 'unoptimized splash PNG is still shipped');

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

const clientBytes = filesUnder(client).reduce((total, file) => total + fs.statSync(file).size, 0);
assert.ok(clientBytes <= 36 * 1024 * 1024, `client payload ${(clientBytes / 1024 / 1024).toFixed(2)} MB exceeded 36 MB`);
const headers = fs.readFileSync(path.join(client, '_headers'), 'utf8');
assert.match(headers, /\/assets\/bggame-0ded2d310665\.webp[\s\S]*Cache-Control: public, max-age=31536000, immutable/, 'fingerprinted splash must remain immutable on Cloudflare Workers');
assert.match(headers, /\/build-info\.json[\s\S]*Cache-Control: no-cache/, 'release identity must not be cached');
console.log(JSON.stringify({ splashKb: Math.round(splashBytes / 1024), clientMb: Math.round(clientBytes / 1024 / 1024 * 100) / 100 }));
