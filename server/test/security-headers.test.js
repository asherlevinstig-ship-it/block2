const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeaders, contentSecurityPolicy } = require('../security-headers');

function collect(production) {
  const headers = new Map();
  let continued = false;
  securityHeaders({ production })({}, { setHeader: (name, value) => headers.set(name, value) }, () => { continued = true; });
  return { headers, continued };
}

test('security middleware blocks framing and MIME sniffing with a restrictive CSP', () => {
  const { headers, continued } = collect(false);
  const csp = headers.get('Content-Security-Policy');
  assert.equal(continued, true);
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});

test('production headers enable HSTS and upgrade insecure resources', () => {
  const { headers } = collect(true);
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
  assert.match(headers.get('Content-Security-Policy'), /upgrade-insecure-requests/);
  assert.equal(contentSecurityPolicy(false).includes('upgrade-insecure-requests'), false);
});
