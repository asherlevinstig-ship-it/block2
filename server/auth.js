const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createConfiguredAuthBackend } = require('./mysql-auth');
const { createStore, sanitizeProfile, defaultProfile, TUTORIAL_VERSIONS, sanitizeUtilityUnlocks, sanitizeUtilityLoadout } = require('./store');
const { resetLivePlayerProfiles, updateLivePlayerProfiles } = require('./profile-reset');
const { accountSummary, clearIdentityTrace, recentIdentityTrace, recordIdentityTrace, shortHash } = require('./identity-trace');
const { clearRoomLifecycleTrace, recentRoomLifecycleTrace } = require('./room-lifecycle-trace');
const { I, JOB_IDS, ITEM_NAMES, ABILITY_SYSTEM, UTILITY_IDS } = require('./rooms/constants');
const APPEARANCE_SYSTEM = require('../shared/appearance-system');
const ABILITY_PROGRESSION = require('../shared/ability-progression');

const COOKIE = 'bc_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 10 * 60 * 1000;   // reclaim expired sessions and stale rate-limit rows
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const b64url = buf => Buffer.from(buf).toString('base64url');
const cleanUsername = value => String(value || '').trim().toLowerCase();
const validUsername = value => /^[a-z0-9_]{3,24}$/.test(value);
const cleanDisplayName = value => String(value || 'Hunter').replace(/[<>]/g, '').trim().slice(0, 16) || 'Hunter';
const INV_MAX = 36;
const KNOWN_ITEM_IDS = new Set(Object.values(I).filter(Number.isFinite));
const JOB_XP_MAX = 1000000000;
const JOB_XP_IDS = [...JOB_IDS].filter(Boolean);
const cleanAdminId = value => String(value || '').trim().toLowerCase();
const clampJobXp = value => Math.max(0, Math.min(JOB_XP_MAX, Math.round(Number(value) || 0)));

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveAdminAbilityPath(value) {
  const path = cleanAdminId(value);
  if (!path) return '';
  if (!ABILITY_SYSTEM.PATHS[path]) throw Object.assign(new Error('Unknown ability path.'), { status: 400, code: 'ability_path' });
  return path;
}

function resolveAdminAbilitySpec(path, value) {
  const spec = cleanAdminId(value);
  if (!spec) return '';
  if (!path || !ABILITY_PROGRESSION.validSpecialization(path, spec)) {
    throw Object.assign(new Error('Unknown specialization for that ability path.'), { status: 400, code: 'ability_spec' });
  }
  return spec;
}

function applyAdminJobXp(profile, body) {
  profile.jobXpByJob = profile.jobXpByJob && typeof profile.jobXpByJob === 'object' ? profile.jobXpByJob : {};
  for (const id of JOB_XP_IDS) profile.jobXpByJob[id] = clampJobXp(profile.jobXpByJob[id]);
  const patch = body && body.jobXpByJob && typeof body.jobXpByJob === 'object' && !Array.isArray(body.jobXpByJob) ? body.jobXpByJob : null;
  if (patch) {
    for (const [rawId, rawXp] of Object.entries(patch)) {
      const id = cleanAdminId(rawId);
      if (!JOB_IDS.has(id) || !id) throw Object.assign(new Error('Unknown job XP id.'), { status: 400, code: 'job_xp' });
      profile.jobXpByJob[id] = clampJobXp(rawXp);
    }
  }
  if (hasOwn(body, 'jobXp')) {
    const active = profile.job || 'adventurer';
    profile.jobXpByJob[active] = clampJobXp(body.jobXp);
  }
  profile.jobXp = clampJobXp(profile.jobXpByJob[profile.job || 'adventurer']);
}

function applyAdminUtilities(profile, body) {
  let unlocks = sanitizeUtilityUnlocks(profile.utilityUnlocks);
  if (hasOwn(body, 'utilityUnlocks')) {
    if (!Array.isArray(body.utilityUnlocks)) throw Object.assign(new Error('utilityUnlocks must be an array.'), { status: 400, code: 'utility' });
    for (const id of body.utilityUnlocks) if (!UTILITY_IDS.has(cleanAdminId(id))) throw Object.assign(new Error('Unknown utility.'), { status: 400, code: 'utility' });
    unlocks = sanitizeUtilityUnlocks(body.utilityUnlocks.map(cleanAdminId));
  }
  if (Array.isArray(body && body.grantUtilities)) {
    for (const raw of body.grantUtilities) {
      const id = cleanAdminId(raw);
      if (!UTILITY_IDS.has(id)) throw Object.assign(new Error('Unknown utility.'), { status: 400, code: 'utility' });
      if (!unlocks.includes(id)) unlocks.push(id);
    }
  }
  if (Array.isArray(body && body.revokeUtilities)) {
    const remove = new Set();
    for (const raw of body.revokeUtilities) {
      const id = cleanAdminId(raw);
      if (!UTILITY_IDS.has(id)) throw Object.assign(new Error('Unknown utility.'), { status: 400, code: 'utility' });
      remove.add(id);
    }
    unlocks = unlocks.filter(id => !remove.has(id));
  }
  profile.utilityUnlocks = sanitizeUtilityUnlocks(unlocks);
  if (hasOwn(body, 'utilityLoadout')) {
    if (!body.utilityLoadout || typeof body.utilityLoadout !== 'object' || Array.isArray(body.utilityLoadout)) {
      throw Object.assign(new Error('utilityLoadout must be an object.'), { status: 400, code: 'utility_loadout' });
    }
    profile.utilityLoadout = sanitizeUtilityLoadout(body.utilityLoadout, profile.utilityUnlocks);
  } else {
    profile.utilityLoadout = sanitizeUtilityLoadout(profile.utilityLoadout, profile.utilityUnlocks);
  }
}

function grantProfileItem(profile, id, count) {
  const itemId = Math.max(1, Math.round(Number(id) || 0));
  const qty = Math.max(1, Math.min(999, Math.round(Number(count) || 1)));
  if (!KNOWN_ITEM_IDS.has(itemId) && !ITEM_NAMES[itemId]) throw Object.assign(new Error('Unknown item id.'), { status: 400, code: 'item' });
  const inv = Array.isArray(profile.inv) ? profile.inv : [];
  for (const slot of inv) {
    if (slot && slot.id === itemId && !slot.gear && !slot.rarity && !slot.dur) {
      slot.count = Math.max(1, Math.min(999, (slot.count | 0) + qty));
      profile.inv = inv;
      return;
    }
  }
  const empty = inv.findIndex(slot => !slot);
  const next = { id: itemId, count: qty };
  if (empty >= 0) inv[empty] = next;
  else if (inv.length < INV_MAX) inv.push(next);
  else throw Object.assign(new Error('Inventory is full.'), { status: 409, code: 'inventory_full' });
  profile.inv = inv;
}

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
    if (!id) return { name: '', nameSet: false, appearance: APPEARANCE_SYSTEM.sanitizeAppearance(null) };
    try {
      const raw = await this.getProfileStore().loadPlayer(id);
      if (!raw) {
        recordIdentityTrace('auth.profile.lookup', {
          account: accountSummary(account),
          profile: { exists: false, name: '', nameSet: false, level: 1 },
        });
        return { name: '', nameSet: false, appearance: APPEARANCE_SYSTEM.sanitizeAppearance(null) };
      }
      const profile = sanitizeProfile(raw);
      recordIdentityTrace('auth.profile.lookup', {
        account: accountSummary(account),
        profile: {
          exists: true,
          name: profile.name,
          nameSet: profile.nameSet === true,
          level: profile.S && profile.S.lvl || 1,
        },
      });
      return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true, appearance: APPEARANCE_SYSTEM.sanitizeAppearance(profile.appearance) };
    } catch (e) {
      console.warn('[auth] game profile lookup failed:', e.message);
      recordIdentityTrace('auth.profile.lookup_failed', {
        account: accountSummary(account),
        error: e && e.message ? String(e.message).slice(0, 160) : 'unknown',
      });
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
    const details = body && body.details === true;
    const summary = profile ? {
      exists: true,
      name: profile.name,
      nameSet: profile.nameSet === true,
      level: profile.S && profile.S.lvl || 1,
    } : { exists: false, name: '', nameSet: false, level: 1 };
    if (profile && details) {
      summary.path = profile.S && profile.S.path || '';
      summary.abilitySpec = profile.abilitySpec || '';
      summary.job = profile.job || '';
      summary.jobXp = profile.jobXp | 0;
      summary.jobXpByJob = { ...(profile.jobXpByJob || {}) };
      summary.utilityUnlocks = Array.isArray(profile.utilityUnlocks) ? [...profile.utilityUnlocks] : [];
      summary.utilityLoadout = sanitizeUtilityLoadout(profile.utilityLoadout, profile.utilityUnlocks);
      summary.gold = profile.gold | 0;
      summary.activeRoom = profile.activeRoom || null;
      summary.inv = (profile.inv || []).filter(Boolean).map(slot => ({ id: slot.id, count: slot.count || 1 }));
      summary.mountUnlocks = Array.isArray(profile.mountUnlocks) ? [...profile.mountUnlocks] : [];
      summary.dragonHatchedAt = profile.dragonHatchedAt || {};
    }
    return {
      account,
      profile: summary,
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

  async resetPlayerToLevelTwoJobChoice(body) {
    const account = await this.resolveAccountForReset(body);
    if (!account || !account.id) throw Object.assign(new Error('Account not found.'), { status: 404, code: 'account' });
    const store = this.getProfileStore();
    let existing = null;
    try {
      existing = await store.loadPlayer(account.id);
    } catch (e) {
      throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' });
    }
    const current = existing ? sanitizeProfile(existing) : null;
    const name = cleanDisplayName(
      body && body.name
      || current && current.nameSet && current.name
      || account.displayName
      || account.username
      || 'Hunter',
    );
    const profile = defaultProfile(name);
    profile.name = name;
    profile.nameSet = name !== 'Hunter';
    profile.S.lvl = 2;
    profile.S.xp = 0;
    profile.S.pts = 1;
    profile.S.path = '';
    profile.job = '';
    profile.jobXp = 0;
    profile.jobXpByJob = { adventurer: 0, miner: 0, farmer: 0, cook: 0, blacksmith: 0, monk: 0, pet_tamer: 0 };
    profile.gold = 100;
    profile.starterGoldGranted = true;
    profile.tutorials = {
      onboarding: TUTORIAL_VERSIONS.onboarding,
      ability: 0,
      intro: TUTORIAL_VERSIONS.intro,
      gate: 0,
      townJob: 0,
      townTavern: 0,
      townLand: 0,
      familiar: 0,
    };
    profile.forceJobChoice = true;
    profile.progressionFocus = 'first_profession_contract';
    profile.vitals = { hp: 20, mp: 20, sp: 100, hunger: 100 };
    profile.vitalsSavedAt = Date.now();
    profile.pos = [64.5, 20, 71.5];
    await store.savePlayer(account.id, profile);
    const liveRoomsUpdated = await updateLivePlayerProfiles(account.id, { replaceProfile: profile });
    return {
      account,
      liveRoomsUpdated,
      profile: {
        exists: true,
        name: profile.name,
        nameSet: profile.nameSet === true,
        level: profile.S.lvl,
        job: profile.job,
        forceJobChoice: profile.forceJobChoice === true,
      },
    };
  }

  async patchPlayerProfile(body) {
    const account = await this.resolveAccountForReset(body);
    if (!account || !account.id) throw Object.assign(new Error('Account not found.'), { status: 404, code: 'account' });
    const store = this.getProfileStore();
    let profile = null;
    try {
      const raw = await store.loadPlayer(account.id);
      profile = raw ? sanitizeProfile(raw) : defaultProfile(account.displayName || account.username || 'Hunter');
    } catch (e) {
      throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' });
    }

    const patch = body || {};
    const nextPath = hasOwn(patch, 'abilityPath') ? resolveAdminAbilityPath(patch.abilityPath)
      : hasOwn(patch, 'path') ? resolveAdminAbilityPath(patch.path)
        : profile.S && profile.S.path || '';
    if (hasOwn(patch, 'abilityPath') || hasOwn(patch, 'path')) {
      profile.S = profile.S && typeof profile.S === 'object' ? profile.S : {};
      profile.S.path = nextPath;
      if (!nextPath || !ABILITY_PROGRESSION.validSpecialization(nextPath, profile.abilitySpec)) profile.abilitySpec = '';
    }
    if (hasOwn(patch, 'abilitySpec')) profile.abilitySpec = resolveAdminAbilitySpec(nextPath, patch.abilitySpec);

    if (hasOwn(patch, 'job')) {
      const job = cleanAdminId(patch.job);
      if (!JOB_IDS.has(job)) throw Object.assign(new Error('Unknown job.'), { status: 400, code: 'job' });
      profile.job = job === 'adventurer' ? '' : job;
      profile.forceJobChoice = false;
    }
    if (hasOwn(patch, 'job') || hasOwn(patch, 'jobXp') || hasOwn(patch, 'jobXpByJob')) applyAdminJobXp(profile, patch);
    if (hasOwn(patch, 'utilityUnlocks') || hasOwn(patch, 'grantUtilities') || hasOwn(patch, 'revokeUtilities') || hasOwn(patch, 'utilityLoadout')) applyAdminUtilities(profile, patch);

    const grants = Array.isArray(patch && patch.grantItems) ? patch.grantItems : [];
    for (const item of grants) grantProfileItem(profile, item && item.id, item && item.count);

    profile = sanitizeProfile(profile);
    await store.savePlayer(account.id, profile);
    const liveRoomsUpdated = await updateLivePlayerProfiles(account.id, { replaceProfile: profile });
    return {
      account,
      liveRoomsUpdated,
      profile: {
        exists: true,
        name: profile.name,
        nameSet: profile.nameSet === true,
        level: profile.S && profile.S.lvl || 1,
        path: profile.S && profile.S.path || '',
        abilitySpec: profile.abilitySpec || '',
        job: profile.job || '',
        jobXp: profile.jobXp | 0,
        jobXpByJob: { ...(profile.jobXpByJob || {}) },
        utilityUnlocks: Array.isArray(profile.utilityUnlocks) ? [...profile.utilityUnlocks] : [],
        utilityLoadout: sanitizeUtilityLoadout(profile.utilityLoadout, profile.utilityUnlocks),
        inv: (profile.inv || []).filter(Boolean).map(slot => ({ id: slot.id, count: slot.count || 1 })),
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
    return { name: clean, nameSet: true, appearance: APPEARANCE_SYSTEM.sanitizeAppearance(profile.appearance) };
  }

  async saveHunterAppearance(account, appearance) {
    const publicAccount = this.publicAccount(account);
    if (!publicAccount || !publicAccount.id) throw Object.assign(new Error('Not signed in.'), { status: 401, code: 'auth' });
    const nextAppearance = APPEARANCE_SYSTEM.sanitizeAppearance(appearance);
    const store = this.getProfileStore();
    let profile = null;
    try {
      const existing = await store.loadPlayer(publicAccount.id);
      profile = existing ? sanitizeProfile(existing) : defaultProfile(publicAccount.displayName || publicAccount.username || 'Hunter');
    }
    catch (e) { throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' }); }
    profile.appearance = nextAppearance;
    await store.savePlayer(publicAccount.id, profile);
    await updateLivePlayerProfiles(publicAccount.id, { appearance: nextAppearance });
    return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true, appearance: nextAppearance };
  }

  async saveHunterProfile(account, body) {
    const publicAccount = this.publicAccount(account);
    if (!publicAccount || !publicAccount.id) throw Object.assign(new Error('Not signed in.'), { status: 401, code: 'auth' });
    const clean = cleanDisplayName(body && body.name);
    if (!clean || clean === 'Hunter') throw Object.assign(new Error('Choose your hunter name.'), { status: 400, code: 'name' });
    const nextAppearance = APPEARANCE_SYSTEM.sanitizeAppearance(body && body.appearance);
    const store = this.getProfileStore();
    let profile = null;
    try {
      const existing = await store.loadPlayer(publicAccount.id);
      profile = existing ? sanitizeProfile(existing) : defaultProfile(clean);
    }
    catch (e) { throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' }); }
    profile.name = clean;
    profile.nameSet = true;
    profile.appearance = nextAppearance;
    await store.savePlayer(publicAccount.id, profile);
    await updateLivePlayerProfiles(publicAccount.id, { name: clean, nameSet: true, appearance: nextAppearance });
    return { name: clean, nameSet: true, appearance: nextAppearance };
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
    recordIdentityTrace('auth.session.issue', {
      account: accountSummary(publicAccount),
      sessionHash: shortHash(sid),
    });
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
    const publicAccount = account ? this.publicAccount(account) : false;
    recordIdentityTrace('auth.request', {
      source: bearerSid ? 'bearer' : cookieSid ? 'cookie' : 'none',
      bearerHash: shortHash(bearerSid),
      cookieHash: shortHash(cookieSid),
      account: accountSummary(publicAccount),
      ok: !!publicAccount,
    });
    if (!account) return false;
    return publicAccount;
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
    app.post('/auth/profile/appearance', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      try {
        const gameProfile = await this.saveHunterAppearance(account, req.body && req.body.appearance);
        res.json({ ok: true, gameProfile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Appearance update failed.' });
      }
    });
    app.post('/auth/profile', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      try {
        const gameProfile = await this.saveHunterProfile(account, req.body || {});
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
    app.post('/auth/admin/player-profile/level-two-job-choice', async (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.resetPlayerToLevelTwoJobChoice(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile, liveRoomsUpdated: result.liveRoomsUpdated });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Level two reset failed.' });
      }
    });
    app.post('/auth/admin/player-profile/patch', async (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.patchPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile, liveRoomsUpdated: result.liveRoomsUpdated });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile patch failed.' });
      }
    });
    app.get('/auth/admin/identity-trace', (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || req.query && req.query.token || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, events: recentIdentityTrace() });
    });
    app.post('/auth/admin/identity-trace/clear', (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, cleared: clearIdentityTrace() });
    });
    app.get('/auth/admin/room-lifecycle', (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || req.query && req.query.token || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, events: recentRoomLifecycleTrace() });
    });
    app.post('/auth/admin/room-lifecycle/clear', (req, res) => {
      const expected = String(process.env.ADMIN_RESET_TOKEN || '');
      const provided = String(req.headers['x-admin-reset-token'] || '');
      if (!expected || provided !== expected) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, cleared: clearRoomLifecycleTrace() });
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
