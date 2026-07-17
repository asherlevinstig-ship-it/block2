const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createConfiguredAuthBackend } = require('./mysql-auth');
const { createStore, sanitizeProfile, defaultProfile } = require('./store');
const { resetLivePlayerProfiles, updateLivePlayerProfiles } = require('./profile-reset');

const COOKIE = 'bc_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 10 * 60 * 1000;   // reclaim expired sessions and stale rate-limit rows
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const b64url = buf => Buffer.from(buf).toString('base64url');
const cleanUsername = value => String(value || '').trim().toLowerCase();
const validUsername = value => /^[a-z0-9_]{3,24}$/.test(value);
const cleanDisplayName = value => String(value || 'Hunter').replace(/[<>]/g, '').trim().slice(0, 16) || 'Hunter';

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const key = part.slice(0, at).trim();
    try { out[key] = decodeURIComponent(part.slice(at + 1).trim()); } catch (_) {}
  }
  return out;
}

function configuredClientOrigins() {
  return String(process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 32, SCRYPT, (err, key) => err ? reject(err) : resolve(key)));
}

class AuthService {
  constructor(dir, options = {}) {
    this.dir = dir || path.join(process.cwd(), 'data');
    this.file = path.join(this.dir, 'auth.json');
    this.authBackend = options.authBackend === undefined ? createConfiguredAuthBackend(options.env || process.env) : options.authBackend;
    this.accounts = new Map();
    this.byId = new Map();
    this.sessions = new Map();
    this.attempts = new Map();
    this.pendingRegistrations = new Set();
    this.writeQueue = Promise.resolve();
    this.profileStore = Object.prototype.hasOwnProperty.call(options, 'profileStore') ? options.profileStore : null;
    this.env = options.env || process.env;
    this.reloadSessionsOnMiss = Object.prototype.hasOwnProperty.call(options, 'reloadSessionsOnMiss') ? options.reloadSessionsOnMiss : !!this.authBackend;
    fs.mkdirSync(this.dir, { recursive: true });
    this.load();
    // Expired sessions and rate-limit rows are otherwise only reclaimed lazily on
    // access, so a long-running process accumulates dead entries indefinitely.
    // Sweep them on a timer; unref so it never keeps the process (or tests) alive.
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_MS);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  sweep(now = Date.now()) {
    // Dropping in-memory expired sessions needs no disk write: load() re-filters
    // expired rows on boot, so a stale row never outlives a restart anyway.
    for (const [sid, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(sid);
    for (const [ip, row] of this.attempts) if (row.resetAt <= now) this.attempts.delete(ip);
  }

  stop() {
    if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; }
  }

  load() {
    let data = { accounts: [], sessions: [] };
    try { data = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('cannot read auth database: ' + e.message); }
    for (const raw of Array.isArray(data.accounts) ? data.accounts : []) {
      const username = cleanUsername(raw.username);
      if (!validUsername(username) || !/^u_[a-f0-9]{32}$/.test(raw.id || '') || !raw.salt || !raw.hash) continue;
      const account = { id: raw.id, username, displayName: cleanDisplayName(raw.displayName), salt: raw.salt, hash: raw.hash, createdAt: Number(raw.createdAt) || Date.now() };
      this.accounts.set(username, account);
      this.byId.set(account.id, account);
    }
    const now = Date.now();
    for (const raw of Array.isArray(data.sessions) ? data.sessions : []) {
      if (!/^[a-f0-9]{64}$/.test(raw.id || '') || !(Number(raw.expiresAt) > now)) continue;
      const account = this.publicAccount(raw.account);
      if (!this.byId.has(raw.accountId) && !account) continue;
      this.sessions.set(raw.id, { accountId: raw.accountId, account, expiresAt: Number(raw.expiresAt) });
    }
  }

  loadSessionsFromDisk(now = Date.now()) {
    let data = { sessions: [] };
    try { data = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('cannot read auth sessions: ' + e.message); }
    for (const raw of Array.isArray(data.sessions) ? data.sessions : []) {
      if (!/^[a-f0-9]{64}$/.test(raw.id || '') || !(Number(raw.expiresAt) > now)) continue;
      const account = this.publicAccount(raw.account);
      if (!raw.accountId || !account) continue;
      this.sessions.set(raw.id, { accountId: raw.accountId, account, expiresAt: Number(raw.expiresAt) });
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    const sessions = [...this.sessions].map(([id, session]) => ({ id, ...session }));
    const contents = JSON.stringify({ accounts: [...this.accounts.values()], sessions });
    const write = async () => {
      await fs.promises.writeFile(tmp, contents);
      await fs.promises.rename(tmp, this.file);
      try { await fs.promises.chmod(this.file, 0o600); } catch (_) {}
    };
    this.writeQueue = this.writeQueue.catch(() => {}).then(write);
    return this.writeQueue;
  }

  publicAccount(account) {
    if (!account || typeof account.id !== 'string') return null;
    const out = { id: account.id, username: cleanUsername(account.username), displayName: cleanDisplayName(account.displayName) };
    if (account.accountType) out.accountType = String(account.accountType);
    if (account.role) out.role = String(account.role);
    if (account.schoolId != null) out.schoolId = String(account.schoolId);
    if (account.schoolName != null) out.schoolName = String(account.schoolName).slice(0, 255);
    if (account.yearGroup != null) out.yearGroup = String(account.yearGroup).slice(0, 50);
    return out;
  }

  getProfileStore() {
    if (this.profileStore) return this.profileStore;
    this.profileStore = createStore({ shardId: 'main', env: this.env });
    return this.profileStore;
  }

  async publicGameProfile(account) {
    const id = account && account.id;
    if (!id) return { name: '', nameSet: false };
    try {
      const raw = await this.getProfileStore().loadPlayer(id);
      if (!raw) return { name: '', nameSet: false };
      const profile = sanitizeProfile(raw);
      return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true };
    } catch (e) {
      console.warn('[auth] game profile lookup failed:', e.message);
      return null;
    }
  }

  async resolveAccountForReset(body) {
    const accountId = String(body && body.accountId || '').trim();
    if (/^(?:student|teacher)_[0-9A-Za-z_-]{1,64}$/.test(accountId)) {
      return { id: accountId, username: '' };
    }
    const identifier = cleanUsername(body && (body.email || body.username));
    if (!identifier || !identifier.includes('@') || !this.authBackend || typeof this.authBackend.findAccount !== 'function') return null;
    const account = await this.authBackend.findAccount(identifier);
    return account ? this.publicAccount(account) : null;
  }

  async resetPlayerProfile(body) {
    const account = await this.resolveAccountForReset(body);
    if (!account || !account.id) throw Object.assign(new Error('Account not found.'), { status: 404, code: 'account' });
    const store = this.getProfileStore();
    if (typeof store.deletePlayer === 'function') await store.deletePlayer(account.id);
    else await store.savePlayer(account.id, null);
    const liveRoomsReset = await resetLivePlayerProfiles(account.id);
    for (const [key, session] of [...this.sessions]) {
      if (session && session.accountId === account.id) this.sessions.delete(key);
    }
    await this.save();
    return { account, liveRoomsReset };
  }

  async inspectPlayerProfile(body) {
    const account = await this.resolveAccountForReset(body);
    if (!account || !account.id) throw Object.assign(new Error('Account not found.'), { status: 404, code: 'account' });
    const store = this.getProfileStore();
    let raw = null;
    try {
      raw = await store.loadPlayer(account.id);
    } catch (e) {
      throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' });
    }
    const profile = raw ? sanitizeProfile(raw) : null;
    return {
      account,
      profile: profile ? {
        exists: true,
        name: profile.name,
        nameSet: profile.nameSet === true,
        level: profile.S && profile.S.lvl || 1,
      } : { exists: false, name: '', nameSet: false, level: 1 },
    };
  }

  async setPlayerProfileName(body) {
    const account = await this.resolveAccountForReset(body);
    if (!account || !account.id) throw Object.assign(new Error('Account not found.'), { status: 404, code: 'account' });
    const clean = cleanDisplayName(body && body.name);
    if (!clean || clean === 'Hunter') throw Object.assign(new Error('Choose a hunter name.'), { status: 400, code: 'name' });
    const store = this.getProfileStore();
    let profile = null;
    try {
      const raw = await store.loadPlayer(account.id);
      profile = raw ? sanitizeProfile(raw) : defaultProfile(clean);
    } catch (e) {
      throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' });
    }
    profile.name = clean;
    profile.nameSet = true;
    await store.savePlayer(account.id, profile);
    await updateLivePlayerProfiles(account.id, { name: clean, nameSet: true });
    return {
      account,
      profile: {
        exists: true,
        name: profile.name,
        nameSet: profile.nameSet === true,
        level: profile.S && profile.S.lvl || 1,
      },
    };
  }

  async saveHunterName(account, name) {
    const publicAccount = this.publicAccount(account);
    if (!publicAccount || !publicAccount.id) throw Object.assign(new Error('Not signed in.'), { status: 401, code: 'auth' });
    const clean = cleanDisplayName(name);
    if (!clean || clean === 'Hunter') throw Object.assign(new Error('Choose your hunter name.'), { status: 400, code: 'name' });
    const store = this.getProfileStore();
    let profile = null;
    try {
      const existing = await store.loadPlayer(publicAccount.id);
      profile = existing ? sanitizeProfile(existing) : defaultProfile(clean);
    }
    catch (e) { throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' }); }
    profile.name = clean;
    profile.nameSet = true;
    await store.savePlayer(publicAccount.id, profile);
    await updateLivePlayerProfiles(publicAccount.id, { name: clean, nameSet: true });
    return { name: clean, nameSet: true };
  }

  async register(username, password, displayName) {
    if (this.authBackend) throw Object.assign(new Error('Registration is managed by your school account system.'), { status: 403, code: 'external_auth' });
    username = cleanUsername(username);
    if (!validUsername(username)) throw Object.assign(new Error('Username must be 3-24 lowercase letters, numbers, or underscores.'), { status: 400, code: 'username' });
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw Object.assign(new Error('Password must be 10-128 characters.'), { status: 400, code: 'password' });
    if (this.accounts.has(username) || this.pendingRegistrations.has(username)) throw Object.assign(new Error('That username is already registered.'), { status: 409, code: 'exists' });
    this.pendingRegistrations.add(username);
    try {
      const salt = b64url(crypto.randomBytes(16));
      const hash = b64url(await scrypt(password, salt));
      const account = { id: 'u_' + crypto.randomBytes(16).toString('hex'), username, displayName: cleanDisplayName(displayName), salt, hash, createdAt: Date.now() };
      this.accounts.set(username, account);
      this.byId.set(account.id, account);
      await this.save();
      return account;
    } finally { this.pendingRegistrations.delete(username); }
  }

  async registerStudent(body) {
    if (!this.authBackend || typeof this.authBackend.registerStudent !== 'function') {
      throw Object.assign(new Error('Student registration is not available on this server.'), { status: 403, code: 'external_auth' });
    }
    const account = await this.authBackend.registerStudent(body || {});
    const yearGroupSaved = account.yearGroupSaved === true;
    delete account.yearGroupSaved;
    return { account, yearGroupSaved };
  }

  async login(username, password) {
    if (this.authBackend) return this.authBackend.login(username, password);
    username = cleanUsername(username);
    const account = this.accounts.get(username);
    // Perform the expensive hash even for unknown accounts to reduce username probing.
    const salt = account ? account.salt : 'invalid-account-salt';
    const expected = account ? Buffer.from(account.hash, 'base64url') : crypto.randomBytes(32);
    const actual = await scrypt(typeof password === 'string' ? password : '', salt);
    if (!account || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw Object.assign(new Error('Invalid username or password.'), { status: 401, code: 'credentials' });
    return account;
  }

  async issueSession(account) {
    const sid = b64url(crypto.randomBytes(32));
    const publicAccount = this.publicAccount(account);
    this.sessions.set(this.sessionKey(sid), { accountId: publicAccount.id, account: publicAccount, expiresAt: Date.now() + SESSION_MS });
    await this.save();
    return sid;
  }

  sessionKey(sid) {
    return crypto.createHash('sha256').update(String(sid || '')).digest('hex');
  }

  sessionAccount(sid) {
    const key = this.sessionKey(sid);
    let session = this.sessions.get(key);
    if (!session && sid && this.reloadSessionsOnMiss) {
      this.loadSessionsFromDisk();
      session = this.sessions.get(key);
    }
    if (!session) return null;
    if (session.expiresAt <= Date.now()) { this.sessions.delete(key); return null; }
    return this.byId.get(session.accountId) || session.account || null;
  }

  authenticateRequest(req) {
    const headers = req && req.headers || {};
    const auth = String(headers.authorization || '');
    const bearer = auth.match(/^Bearer\s+(.+)$/i);
    const bearerSid = bearer ? bearer[1].trim() : '';
    const cookieSid = parseCookies(headers.cookie)[COOKIE] || '';
    let account = this.sessionAccount(bearerSid || cookieSid);
    if (!account && bearerSid && cookieSid && bearerSid !== cookieSid) account = this.sessionAccount(cookieSid);
    if (!account) return false;
    return this.publicAccount(account);
  }

  cookie(sid, req, clear = false) {
    const secure = !!(req && (req.secure || String(req.headers && req.headers['x-forwarded-proto']).split(',')[0].trim() === 'https'));
    const crossSite = configuredClientOrigins().length > 0;
    const sameSite = crossSite ? 'None' : 'Strict';
    return `${COOKIE}=${clear ? '' : encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${clear ? 0 : Math.floor(SESSION_MS / 1000)}${secure || crossSite ? '; Secure' : ''}`;
  }

  consumeAttempt(key, now) {
    const row = this.attempts.get(key) || { count: 0, resetAt: now + 60000 };
    if (row.resetAt <= now) { row.count = 0; row.resetAt = now + 60000; }
    row.count++;
    this.attempts.set(key, row);
    return row.count <= 12;
  }

  allowAttempt(req, username) {
    const now = Date.now();
    const ip = String(req.ip || req.socket && req.socket.remoteAddress || 'unknown');
    const account = cleanUsername(username);
    const ipAllowed = this.consumeAttempt('ip:' + ip, now);
    const accountAllowed = !account || this.consumeAttempt('account:' + account, now);
    return ipAllowed && accountAllowed;
  }

  attach(app) {
    app.use('/auth', (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      const origins = configuredClientOrigins();
      const origin = String(req.headers.origin || '').replace(/\/+$/, '');
      if (origin && origins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-reset-token');
        return res.status(204).end();
      }
      const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
      if (process.env.NODE_ENV === 'production' && !secure) return res.status(426).json({ ok: false, error: 'HTTPS is required for authentication.' });
      next();
    });
    app.use('/auth', require('express').json({ limit: '8kb' }));
    const complete = async (req, res, create) => {
      if (!this.allowAttempt(req, req.body && req.body.username)) return res.status(429).json({ ok: false, error: 'Too many authentication attempts.' });
      try {
        const account = create
          ? await this.register(req.body && req.body.username, req.body && req.body.password, req.body && req.body.displayName)
          : await this.login(req.body && req.body.username, req.body && req.body.password);
        const sid = await this.issueSession(account);
        res.setHeader('Set-Cookie', this.cookie(sid, req));
        res.json({ ok: true, account: this.publicAccount(account), gameProfile: await this.publicGameProfile(account), sessionToken: sid });
      } catch (e) { res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Authentication failed.' }); }
    };
    app.post('/auth/register', (req, res) => complete(req, res, true));
    app.post('/auth/student/register', async (req, res) => {
      const identifier = req.body && (req.body.email || req.body.username);
      if (!this.allowAttempt(req, identifier)) return res.status(429).json({ ok: false, error: 'Too many registration attempts.' });
      try {
        const result = await this.registerStudent(req.body);
        const sid = await this.issueSession(result.account);
        res.setHeader('Set-Cookie', this.cookie(sid, req));
        res.json({
          ok: true,
          account: this.publicAccount(result.account),
          gameProfile: await this.publicGameProfile(result.account),
          sessionToken: sid,
          yearGroupSaved: result.yearGroupSaved,
        });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Registration failed.' });
      }
    });
    app.post('/auth/login', (req, res) => complete(req, res, false));
    app.get('/auth/me', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      res.json({ ok: true, account, gameProfile: await this.publicGameProfile(account) });
    });
    app.post('/auth/profile/name', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      try {
        const gameProfile = await this.saveHunterName(account, req.body && req.body.name);
        res.json({ ok: true, gameProfile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile update failed.' });
      }
    });
    app.post('/auth/admin/reset-player', async (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.resetPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, liveRoomsReset: result.liveRoomsReset });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Reset failed.' });
      }
    });
    app.post('/auth/admin/player-profile', async (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.inspectPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile lookup failed.' });
      }
    });
    app.post('/auth/admin/player-profile/name', async (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.setPlayerProfileName(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile rename failed.' });
      }
    });
    app.post('/auth/logout', async (req, res) => {
      const sid = parseCookies(req.headers.cookie)[COOKIE];
      if (sid) {
        this.sessions.delete(this.sessionKey(sid));
        await this.save();
      }
      res.setHeader('Set-Cookie', this.cookie('', req, true));
      res.json({ ok: true });
    });
  }
}

let singleton;
function getAuthService() {
  if (!singleton) singleton = new AuthService(process.env.DATA_DIR);
  return singleton;
}
function resetAuthServiceForTests() { singleton = undefined; }

module.exports = { AuthService, getAuthService, resetAuthServiceForTests, parseCookies, cleanUsername, validUsername };
