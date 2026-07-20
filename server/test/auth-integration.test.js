const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { AuthService } = require('../auth');

async function fixture({ production = false, trustProxy = 1, clientOrigin = '', profileStore, authOptions = {}, env = {} } = {}) {
  const previousEnv = process.env.NODE_ENV;
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  const previousAdminResetToken = process.env.ADMIN_RESET_TOKEN;
  process.env.NODE_ENV = production ? 'production' : 'test';
  if (clientOrigin) process.env.CLIENT_ORIGIN = clientOrigin; else delete process.env.CLIENT_ORIGIN;
  if (Object.prototype.hasOwnProperty.call(env, 'ADMIN_RESET_TOKEN')) process.env.ADMIN_RESET_TOKEN = env.ADMIN_RESET_TOKEN;
  else delete process.env.ADMIN_RESET_TOKEN;
  const options = { ...authOptions };
  if (profileStore) options.profileStore = profileStore;
  const auth = new AuthService(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-http-')), options);
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
      if (previousAdminResetToken === undefined) delete process.env.ADMIN_RESET_TOKEN; else process.env.ADMIN_RESET_TOKEN = previousAdminResetToken;
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

test('auth responses include the saved hunter-name setup state', { concurrency: false }, async () => {
  const profileStore = {
    async loadPlayer(id) {
      return id ? { name: 'Mara', nameSet: true, S: { lvl: 1, str: 1, agi: 1, vit: 1, int: 1 } } : null;
    },
  };
  const f = await fixture({ profileStore });
  try {
    const registered = await f.request('/auth/register', jsonPost({ username: 'profile_user', password: 'long enough password' }));
    assert.equal(registered.status, 200);
    const body = await registered.json();
    assert.deepEqual(body.gameProfile, { name: 'Mara', nameSet: true });
    const cookie = sessionCookie(registered);
    const me = await f.request('/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).gameProfile, { name: 'Mara', nameSet: true });
  } finally { await f.close(); }
});

test('hunter name setup is persisted before joining the world', { concurrency: false }, async () => {
  const profiles = new Map();
  const profileStore = {
    async loadPlayer(id) { return profiles.get(id) || null; },
    async savePlayer(id, profile) { profiles.set(id, profile); },
  };
  const f = await fixture({ profileStore });
  try {
    const registered = await f.request('/auth/register', jsonPost({ username: 'new_hunter', password: 'long enough password' }));
    assert.equal(registered.status, 200);
    const registeredBody = await registered.json();
    const accountId = registeredBody.account.id;
    const cookie = sessionCookie(registered);
    assert.deepEqual(registeredBody.gameProfile, { name: '', nameSet: false });

    const saved = await f.request('/auth/profile/name', jsonPost({ name: 'Kirito' }, { cookie }));
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).gameProfile, { name: 'Kirito', nameSet: true });

    const me = await f.request('/auth/me', { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).gameProfile, { name: 'Kirito', nameSet: true });
    assert.equal(profiles.get(accountId).name, 'Kirito');
    assert.equal(profiles.get(accountId).nameSet, true);
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
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);

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

test('bearer session token authenticates cross-site auth requests when cookies are unavailable', { concurrency: false }, async () => {
  const profiles = new Map();
  const profileStore = {
    async loadPlayer(id) { return profiles.get(id) || null; },
    async savePlayer(id, profile) { profiles.set(id, profile); },
  };
  const origin = 'https://blockcraft-client.vercel.app';
  const f = await fixture({ production: true, clientOrigin: origin, profileStore });
  try {
    const login = await f.request('/auth/register', jsonPost(
      { username: 'bearer_user', password: 'long enough password' },
      { origin, 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.10' },
    ));
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.match(loginBody.sessionToken, /^[A-Za-z0-9_-]{20,}$/);

    const saved = await f.request('/auth/profile/name', jsonPost(
      { name: 'Admin_Levin' },
      { origin, 'x-forwarded-proto': 'https', Authorization: 'Bearer ' + loginBody.sessionToken },
    ));
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).gameProfile, { name: 'Admin_Levin', nameSet: true });

    const me = await f.request('/auth/me', {
      headers: { origin, 'x-forwarded-proto': 'https', Authorization: 'Bearer ' + loginBody.sessionToken },
    });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).gameProfile, { name: 'Admin_Levin', nameSet: true });
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

test('admin reset endpoint deletes game profiles only with the reset token', { concurrency: false }, async () => {
  const deleted = [];
  const profileStore = {
    async loadPlayer() { return null; },
    async deletePlayer(id) { deleted.push(id); },
  };
  const backend = {
    async findAccount(identifier) {
      if (identifier !== 'student@example.test') return null;
      return { id: 'student_42', username: identifier, displayName: 'Student' };
    },
  };
  const f = await fixture({
    profileStore,
    authOptions: { authBackend: backend },
    env: { ADMIN_RESET_TOKEN: 'reset-secret' },
  });
  try {
    const denied = await f.request('/auth/admin/reset-player', jsonPost({ accountId: 'student_42' }));
    assert.equal(denied.status, 403);
    const byId = await f.request('/auth/admin/reset-player', jsonPost(
      { accountId: 'student_42' },
      { 'x-admin-reset-token': 'reset-secret' },
    ));
    assert.equal(byId.status, 200);
    assert.equal((await byId.json()).account.id, 'student_42');
    const byEmail = await f.request('/auth/admin/reset-player', jsonPost(
      { email: 'student@example.test' },
      { 'x-admin-reset-token': 'reset-secret' },
    ));
    assert.equal(byEmail.status, 200);
    assert.deepEqual(deleted, ['student_42', 'student_42']);
  } finally { await f.close(); }
});

test('admin profile lookup reports the resolved account id and hunter name', { concurrency: false }, async () => {
  const profiles = new Map([['student_42', { name: 'Admin_Levin', nameSet: true, S: { lvl: 1, str: 1, agi: 1, vit: 1, int: 1 } }]]);
  const profileStore = {
    async loadPlayer(id) { return profiles.get(id) || null; },
    async savePlayer(id, profile) { profiles.set(id, profile); },
  };
  const authOptions = {
    authBackend: {
      async findAccount(identifier) {
        if (identifier !== 'dylan.lynee@st-ignatius.example') return null;
        return {
          id: 'student_42',
          username: identifier,
          displayName: 'Dylan Lynee',
          accountType: 'student',
          role: 'student',
          schoolId: '1',
          schoolName: 'St Ignatius',
        };
      },
    },
  };
  const f = await fixture({ profileStore, authOptions, env: { ADMIN_RESET_TOKEN: 'admin-secret' } });
  try {
    const forbidden = await f.request('/auth/admin/player-profile', jsonPost(
      { email: 'dylan.lynee@st-ignatius.example' },
      { 'x-admin-reset-token': 'wrong' },
    ));
    assert.equal(forbidden.status, 403);

    const lookup = await f.request('/auth/admin/player-profile', jsonPost(
      { email: 'dylan.lynee@st-ignatius.example' },
      { 'x-admin-reset-token': 'admin-secret' },
    ));
    assert.equal(lookup.status, 200);
    const body = await lookup.json();
    assert.equal(body.account.id, 'student_42');
    assert.equal(body.account.username, 'dylan.lynee@st-ignatius.example');
    assert.deepEqual(body.profile, { exists: true, name: 'Admin_Levin', nameSet: true, level: 1 });

    const renamed = await f.request('/auth/admin/player-profile/name', jsonPost(
      { email: 'dylan.lynee@st-ignatius.example', name: 'Dylan Lynee' },
      { 'x-admin-reset-token': 'admin-secret' },
    ));
    assert.equal(renamed.status, 200);
    const renamedBody = await renamed.json();
    assert.equal(renamedBody.account.id, 'student_42');
    assert.deepEqual(renamedBody.profile, { exists: true, name: 'Dylan Lynee', nameSet: true, level: 1 });
    assert.equal(profiles.get('student_42').name, 'Dylan Lynee');
    assert.equal(profiles.get('student_42').S.lvl, 1);

    const levelTwo = await f.request('/auth/admin/player-profile/level-two-job-choice', jsonPost(
      { email: 'dylan.lynee@st-ignatius.example' },
      { 'x-admin-reset-token': 'admin-secret' },
    ));
    assert.equal(levelTwo.status, 200);
    const levelTwoBody = await levelTwo.json();
    assert.equal(levelTwoBody.profile.level, 2);
    assert.equal(levelTwoBody.profile.job, '');
    assert.equal(levelTwoBody.profile.forceJobChoice, true);
    assert.equal(profiles.get('student_42').name, 'Dylan Lynee');
    assert.equal(profiles.get('student_42').S.lvl, 2);
    assert.equal(profiles.get('student_42').job, '');
    assert.equal(profiles.get('student_42').tutorials.onboarding, 7);
    assert.equal(profiles.get('student_42').tutorials.townJob, 0);

    const patched = await f.request('/auth/admin/player-profile/patch', jsonPost(
      { email: 'dylan.lynee@st-ignatius.example', job: 'pet_tamer', grantItems: [{ id: 185, count: 1 }] },
      { 'x-admin-reset-token': 'admin-secret' },
    ));
    assert.equal(patched.status, 200);
    const patchedBody = await patched.json();
    assert.equal(patchedBody.profile.job, 'pet_tamer');
    assert.deepEqual(patchedBody.profile.inv, [{ id: 185, count: 1 }]);
    assert.equal(profiles.get('student_42').job, 'pet_tamer');
    assert.equal(profiles.get('student_42').forceJobChoice, false);
    assert.deepEqual(profiles.get('student_42').inv, [{ id: 185, count: 1 }]);

    const deniedTrace = await f.request('/auth/admin/identity-trace');
    assert.equal(deniedTrace.status, 403);
    const trace = await f.request('/auth/admin/identity-trace', { headers: { 'x-admin-reset-token': 'admin-secret' } });
    assert.equal(trace.status, 200);
    const traceBody = await trace.json();
    assert.equal(traceBody.ok, true);
    assert.equal(Array.isArray(traceBody.events), true);
    const cleared = await f.request('/auth/admin/identity-trace/clear', jsonPost({}, { 'x-admin-reset-token': 'admin-secret' }));
    assert.equal(cleared.status, 200);
    assert.equal((await cleared.json()).ok, true);
  } finally { await f.close(); }
});

test('student registration endpoint creates a MySQL-backed session', { concurrency: false }, async () => {
  const profileStore = {
    async loadPlayer() { return null; },
  };
  const backend = {
    async registerStudent(body) {
      assert.equal(body.email, 'new.student@school.test');
      assert.equal(body.school, undefined);
      assert.equal(body.yearGroup, 'Year 9');
      return {
        id: 'student_42',
        username: 'new.student@school.test',
        displayName: 'New Student',
        accountType: 'student',
        role: 'student',
        schoolId: '42',
        yearGroup: 'Year 9',
        yearGroupSaved: true,
      };
    },
  };
  const f = await fixture({ profileStore, authOptions: { authBackend: backend } });
  try {
    const response = await f.request('/auth/student/register', jsonPost({
      email: 'new.student@school.test',
      yearGroup: 'Year 9',
      password: 'correct horse student',
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /bc_session=/);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.account.id, 'student_42');
    assert.equal(body.account.schoolId, '42');
    assert.equal(body.account.yearGroup, 'Year 9');
    assert.equal(body.yearGroupSaved, true);
    assert.deepEqual(body.gameProfile, { name: '', nameSet: false });
  } finally { await f.close(); }
});
