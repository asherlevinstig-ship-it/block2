const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { AuthService } = require('../auth');

async function fixture({ production = false, trustProxy = 1, clientOrigin = '' } = {}) {
  const previousEnv = process.env.NODE_ENV;
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  process.env.NODE_ENV = production ? 'production' : 'test';
  if (clientOrigin) process.env.CLIENT_ORIGIN = clientOrigin; else delete process.env.CLIENT_ORIGIN;
  const auth = new AuthService(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-http-')));
  const app = express();
  app.set('trust proxy', trustProxy);
  auth.attach(app);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {
    auth,
    request(route, options = {}) { return fetch(base + route, options); },
    async close() {
      await new Promise(resolve => server.close(resolve));
      auth.stop();
      if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
      if (previousClientOrigin === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = previousClientOrigin;
    },
  };
}

const jsonPost = (body, headers = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const sessionCookie = response => response.headers.get('set-cookie').split(';', 1)[0];

test('HTTPS proxy headers produce secure cookies and plaintext production auth is rejected', { concurrency: false }, async () => {
  const f = await fixture({ production: true });
  try {
    const rejected = await f.request('/auth/register', jsonPost({ username: 'proxy_user', password: 'long enough password' }));
    assert.equal(rejected.status, 426);
    const accepted = await f.request('/auth/register', jsonPost(
      { username: 'proxy_user', password: 'long enough password' },
      { 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.8' },
    ));
    assert.equal(accepted.status, 200);
    assert.match(accepted.headers.get('set-cookie'), /; Secure/);
    assert.match(accepted.headers.get('set-cookie'), /HttpOnly/);
    assert.match(accepted.headers.get('set-cookie'), /SameSite=Strict/);
  } finally { await f.close(); }
});

test('session cookies authenticate, logout revokes them, and expiry is enforced', { concurrency: false }, async () => {
  const f = await fixture();
  try {
    const registered = await f.request('/auth/register', jsonPost({ username: 'cookie_user', password: 'long enough password' }));
    const cookie = sessionCookie(registered);
    assert.equal((await f.request('/auth/me', { headers: { cookie } })).status, 200);
    const logout = await f.request('/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal((await f.request('/auth/me', { headers: { cookie } })).status, 401);

    const login = await f.request('/auth/login', jsonPost({ username: 'cookie_user', password: 'long enough password' }));
    const expiringCookie = sessionCookie(login);
    for (const session of f.auth.sessions.values()) session.expiresAt = Date.now() - 1;
    assert.equal((await f.request('/auth/me', { headers: { cookie: expiringCookie } })).status, 401);
  } finally { await f.close(); }
});

test('configured client origins receive credentialed CORS and cross-site cookies', { concurrency: false }, async () => {
  const origin = 'https://blockcraft-client.vercel.app';
  const f = await fixture({ production: true, clientOrigin: origin });
  try {
    const preflight = await f.request('/auth/login', {
      method: 'OPTIONS',
      headers: { origin, 'x-forwarded-proto': 'https' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');

    const accepted = await f.request('/auth/register', jsonPost(
      { username: 'vercel_user', password: 'long enough password' },
      { origin, 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.9' },
    ));
    assert.equal(accepted.status, 200);
    assert.equal(accepted.headers.get('access-control-allow-origin'), origin);
    assert.equal(accepted.headers.get('access-control-allow-credentials'), 'true');
    assert.match(accepted.headers.get('set-cookie'), /SameSite=None/);
    assert.match(accepted.headers.get('set-cookie'), /; Secure/);
  } finally { await f.close(); }
});

test('rotating forwarded IP addresses cannot bypass the per-account auth limit', { concurrency: false }, async () => {
  const f = await fixture();
  try {
    const statuses = [];
    for (let i = 0; i < 13; i++) {
      const response = await f.request('/auth/login', jsonPost(
        { username: 'target_account', password: 'wrong password' },
        { 'x-forwarded-for': '198.51.100.' + (i + 1) },
      ));
      statuses.push(response.status);
    }
    assert.equal(statuses.slice(0, 12).every(status => status === 401), true);
    assert.equal(statuses[12], 429);
  } finally { await f.close(); }
});
