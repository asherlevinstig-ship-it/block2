const test = require('node:test');
const assert = require('node:assert/strict');
const { staticCacheControl } = require('../runtime');

test('static cache policy protects documents and caches fingerprinted assets', () => {
  assert.equal(staticCacheControl('client/index.html'), 'no-cache');
  assert.equal(staticCacheControl('dist/build-info.json'), 'no-cache');
  assert.equal(staticCacheControl('client/assets/bggame-0ded2d310665.webp'), 'public, max-age=31536000, immutable');
  assert.equal(staticCacheControl('client/audio/menu.mp3'), 'public, max-age=86400, stale-while-revalidate=604800');
  assert.equal(staticCacheControl('client/js/boot.mjs'), 'public, max-age=3600, must-revalidate');
});
