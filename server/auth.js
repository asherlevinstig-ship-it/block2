const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createConfiguredAuthBackend } = require('./mysql-auth');
const { MySqlGameQuestionStore } = require('./mysql-game-questions');
const { createStore, sanitizeProfile, defaultProfile, TUTORIAL_VERSIONS, sanitizeUtilityUnlocks, sanitizeUtilityLoadout, ensureAsherAdminFishingRod } = require('./store');
const { resetLivePlayerProfiles, updateLivePlayerProfiles } = require('./profile-reset');
const { accountSummary, clearIdentityTrace, recentIdentityTrace, recordIdentityTrace, shortHash } = require('./identity-trace');
const { clearRoomLifecycleTrace, recentRoomLifecycleTrace } = require('./room-lifecycle-trace');
const { I, JOB_IDS, ITEM_NAMES, ABILITY_SYSTEM, UTILITY_IDS, ARMOR_INFO, TOOL_INFO } = require('./rooms/constants');
const APPEARANCE_SYSTEM = require('../shared/appearance-system');
const ABILITY_PROGRESSION = require('../shared/ability-progression');
const GEAR_SYSTEM = require('../shared/gear-system');

const COOKIE = 'bc_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const SWEEP_MS = 10 * 60 * 1000;   // reclaim expired sessions and stale rate-limit rows
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DEFAULT_CURRICULUM_MAIL_BRIDGE_URL = 'https://compscigo.com/teacher/blockcraft_curriculum_mail.php';
const DEFAULT_BUG_REPORT_TO = 'asherlevin85@gmail.com';
const BUG_REPORT_SENSITIVE_KEY = /password|pass|token|secret|credential|private|cookie|authorization/i;
const BUG_REPORT_MAIL_TIMEOUT_MS = Math.max(2000, Math.min(15000, Number(process.env.BUG_REPORT_MAIL_TIMEOUT_MS || 8000) | 0));
const LIGHTWEAVE_HANDOFF_SECRET = String(process.env.BLOCKCRAFT_LIGHTWEAVE_HANDOFF_SECRET || 'lw-bc-handoff-v1-2026-rotate-me-9a3f2d7c1e8b4a6d').trim();
const LIGHTWEAVE_HANDOFF_MAX_AGE_MS = 2 * 60 * 1000;

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
const clampAdminInt = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
function cleanBugText(value, max = 1600) {
  return String(value || '')
    .replace(/\0/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, max);
}
function compactBugValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[truncated]';
  if (typeof value === 'string') return cleanBugText(value, depth <= 1 ? 700 : 240);
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(-80).map(v => compactBugValue(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value).slice(0, 80)) {
      if (BUG_REPORT_SENSITIVE_KEY.test(key)) continue;
      out[String(key).slice(0, 48)] = compactBugValue(raw, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 120);
}
const curriculumAllowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
]);

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function safeEqualString(a, b) {
  const ab = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyLightweaveHandoffToken(token) {
  const clean = String(token || '').trim();
  const match = clean.match(/^lw1\.([A-Za-z0-9_-]{20,})\.([A-Za-z0-9_-]{32,})$/);
  if (!match || !LIGHTWEAVE_HANDOFF_SECRET) return null;
  const payload64 = match[1];
  const sig = match[2];
  const expected = crypto.createHmac('sha256', LIGHTWEAVE_HANDOFF_SECRET).update(payload64).digest('base64url');
  if (!safeEqualString(sig, expected)) return null;
  let payload = null;
  try { payload = JSON.parse(Buffer.from(payload64, 'base64url').toString('utf8')); } catch (_) { return null; }
  const now = Date.now();
  const issuedAt = Number(payload && payload.iat) || 0;
  const expiresAt = Number(payload && payload.exp) || 0;
  if (!issuedAt || !expiresAt || expiresAt < now || Math.abs(now - issuedAt) > LIGHTWEAVE_HANDOFF_MAX_AGE_MS) return null;
  const kind = String(payload.kind || payload.type || '').toLowerCase();
  if (kind !== 'student' && kind !== 'teacher') return null;
  const sourceId = Math.max(1, Math.round(Number(payload.id) || 0));
  const username = cleanUsername(payload.email || payload.username);
  if (!sourceId || !username || !username.includes('@')) return null;
  const schoolId = String(payload.schoolId || payload.school_id || '').trim();
  const displayName = cleanDisplayName(payload.name || payload.displayName || username.split('@')[0]);
  const role = kind === 'teacher' ? String(payload.role || 'teacher').trim().toLowerCase() || 'teacher' : 'student';
  return {
    id: kind + '_' + sourceId,
    username,
    displayName,
    accountType: kind,
    role,
    schoolId,
    sourceId,
  };
}

function adminMaxHp(profile) {
  const growth = profile && profile.meditationGrowth || {};
  return 20 + ((profile && profile.S && profile.S.vit || 1) - 1) * 2 + (growth.hp || 0);
}

function adminMaxMp(profile) {
  const growth = profile && profile.meditationGrowth || {};
  return 20 + ((profile && profile.S && profile.S.int || 1) - 1) * 3 + (growth.mp || 0);
}

function adminMaxSp(profile) {
  const growth = profile && profile.meditationGrowth || {};
  return 100 + ((profile && profile.S && profile.S.agi || 1) - 1) * 4 + (growth.sp || 0);
}

function applyAdminMaxStat(profile, key, requestedMax, base, perPoint, growthKey) {
  const growth = profile && profile.meditationGrowth || {};
  const want = clampAdminInt(requestedMax, 1, JOB_XP_MAX);
  profile.S[key] = clampAdminInt(Math.ceil((want - (growth[growthKey] || 0) - base) / perPoint) + 1, 1, 999);
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

function adminProfileSummary(profile) {
  return {
    exists: true,
    name: profile.name,
    nameSet: profile.nameSet === true,
    level: profile.S && profile.S.lvl || 1,
    xp: profile.S && profile.S.xp || 0,
    statPoints: profile.S && profile.S.pts || 0,
    gold: profile.gold | 0,
    path: profile.S && profile.S.path || '',
    abilitySpec: profile.abilitySpec || '',
    job: profile.job || '',
    jobXp: profile.jobXp | 0,
    jobXpByJob: { ...(profile.jobXpByJob || {}) },
    maxHp: adminMaxHp(profile),
    maxMp: adminMaxMp(profile),
    maxSp: adminMaxSp(profile),
    vitals: profile.vitals && typeof profile.vitals === 'object' ? {
      hp: Number(profile.vitals.hp) || 0,
      mp: Number(profile.vitals.mp) || 0,
      sp: Number(profile.vitals.sp) || 0,
      hunger: Number(profile.vitals.hunger) || 0,
    } : { hp: 0, mp: 0, sp: 0, hunger: 0 },
    utilityUnlocks: Array.isArray(profile.utilityUnlocks) ? [...profile.utilityUnlocks] : [],
    utilityLoadout: sanitizeUtilityLoadout(profile.utilityLoadout, profile.utilityUnlocks),
    armor: profile.armor ? { ...profile.armor, count: 1 } : null,
    inv: (profile.inv || []).filter(Boolean).map(slot => ({ ...slot, count: slot.count || 1 })),
  };
}

function adminGearStack(raw) {
  const itemId = Math.max(1, Math.round(Number(raw && raw.id) || 0));
  const info = ARMOR_INFO[itemId] || TOOL_INFO[itemId] || null;
  if (!KNOWN_ITEM_IDS.has(itemId) && !ITEM_NAMES[itemId] && !info) throw Object.assign(new Error('Unknown item id.'), { status: 400, code: 'item' });
  const qty = Math.max(1, Math.min(info ? 1 : 999, Math.round(Number(raw && raw.count) || 1)));
  const stack = { id: itemId, count: qty };
  if (info) {
    stack.count = 1;
    stack.dur = Math.max(1, Math.min(99999, Math.round(Number(raw && raw.dur) || info.dur || 1)));
    stack.source = 'admin';
  }
  if (ARMOR_INFO[itemId]) {
    const type = String(raw && raw.armorType || ARMOR_INFO[itemId].armorType || 'vanguard').trim();
    stack.armorType = GEAR_SYSTEM.ARMOR_ARCHETYPES[type] ? type : ARMOR_INFO[itemId].armorType || 'vanguard';
  }
  if (GEAR_SYSTEM.RARITIES.some(r => r.id === String(raw && raw.rarity || ''))) stack.rarity = String(raw.rarity);
  if (GEAR_SYSTEM.RANKS.some((r, i) => i < 6 && r.id === String(raw && raw.gearRank || ''))) stack.gearRank = String(raw.gearRank);
  if (raw && raw.locked === true) stack.locked = true;
  return stack;
}

function grantProfileItem(profile, rawOrId, count) {
  const raw = rawOrId && typeof rawOrId === 'object' ? rawOrId : { id: rawOrId, count };
  const next = adminGearStack(raw);
  const itemId = next.id;
  const qty = next.count;
  if (raw && raw.equip === true) {
    if (!ARMOR_INFO[itemId]) throw Object.assign(new Error('Only armor can be equipped by admin grant.'), { status: 400, code: 'equip' });
    profile.armor = { ...next, count: 1 };
    return;
  }
  const inv = Array.isArray(profile.inv) ? profile.inv : [];
  for (const slot of inv) {
    if (!ARMOR_INFO[itemId] && !TOOL_INFO[itemId] && slot && slot.id === itemId && !slot.gear && !slot.rarity && !slot.dur) {
      slot.count = Math.max(1, Math.min(999, (slot.count | 0) + qty));
      profile.inv = inv;
      return;
    }
  }
  const empty = inv.findIndex(slot => !slot);
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
    this.gameQuestionStore = Object.prototype.hasOwnProperty.call(options, 'gameQuestionStore') ? options.gameQuestionStore : null;
    this.env = options.env || process.env;
    this.curriculumUploadDir = options.curriculumUploadDir || path.join(this.dir, 'curriculum-uploads');
    this.curriculumMailBridgeFetch = options.curriculumMailBridgeFetch || null;
    this.bugReportMailBridgeFetch = options.bugReportMailBridgeFetch || null;
    this.reloadSessionsOnMiss = Object.prototype.hasOwnProperty.call(options, 'reloadSessionsOnMiss') ? options.reloadSessionsOnMiss : !!this.authBackend;
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.curriculumUploadDir, { recursive: true });
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

  adminEmails() {
    const raw = String(this.env && this.env.ADMIN_EMAILS || process.env.ADMIN_EMAILS || 'asherlevin85@gmail.com');
    return new Set(raw.split(',').map(cleanUsername).filter(Boolean));
  }

  adminIdentifiers() {
    const raw = String(this.env && this.env.ADMIN_IDENTIFIERS || process.env.ADMIN_IDENTIFIERS || 'asherlevin85@gmail.com,asherlevin85,asherlevin');
    return new Set(raw.split(',').map(value => cleanAdminId(value)).filter(Boolean));
  }

  isAdminAccount(account) {
    if (!account) return false;
    const role = cleanAdminId(account.role || account.accountType);
    const username = cleanUsername(account.username || account.email);
    const identifiers = this.adminIdentifiers();
    return role === 'admin'
      || this.adminEmails().has(username)
      || identifiers.has(cleanAdminId(username))
      || identifiers.has(cleanAdminId(account.displayName));
  }

  authorizeAdmin(req) {
    const expected = String(this.env && this.env.ADMIN_RESET_TOKEN || process.env.ADMIN_RESET_TOKEN || '');
    const provided = String(req.headers['x-admin-reset-token'] || req.query && req.query.token || '');
    if (expected && provided === expected) return true;
    const account = this.authenticateRequest(req);
    return this.isAdminAccount(account);
  }

  getProfileStore() {
    if (this.profileStore) return this.profileStore;
    this.profileStore = createStore({ shardId: 'main', env: this.env });
    return this.profileStore;
  }

  getGameQuestionStore() {
    if (this.gameQuestionStore) return this.gameQuestionStore;
    this.gameQuestionStore = new MySqlGameQuestionStore({ authBackend: this.authBackend, env: this.env });
    return this.gameQuestionStore;
  }

  curriculumUploadMiddleware() {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, this.curriculumUploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(String(file.originalname || '')).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
        cb(null, Date.now().toString(36) + '-' + crypto.randomBytes(8).toString('hex') + ext);
      },
    });
    return multer({
      storage,
      limits: { files: 5, fileSize: 15 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (curriculumAllowedMime.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
        return cb(Object.assign(new Error('Unsupported file type.'), { status: 400, code: 'file_type' }));
      },
    }).array('files', 5);
  }

  async sendCurriculumNotification(account, submission) {
    const to = String(this.env.CURRICULUM_NOTIFY_TO || 'asherlevin85@gmail.com').trim();
    const bridgeUrl = String(this.env.CURRICULUM_MAIL_BRIDGE_URL || DEFAULT_CURRICULUM_MAIL_BRIDGE_URL).trim();
    const bridgeSecret = String(this.env.CURRICULUM_MAIL_BRIDGE_SECRET || this.env.BLOCKCRAFT_CURRICULUM_MAIL_SECRET || '').trim();
    if (!to) return { sent: false, to, reason: 'mail_recipient_not_configured' };
    if (!bridgeUrl) return { sent: false, to, reason: 'mail_bridge_url_not_configured' };
    if (!bridgeSecret) return { sent: false, to, reason: 'mail_bridge_secret_not_configured' };
    const fetchImpl = this.curriculumMailBridgeFetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return { sent: false, to, reason: 'fetch_not_available' };
    const files = (submission.files || []).map(file => '- ' + file.originalName + ' (' + Math.ceil((file.size || 0) / 1024) + ' KB)').join('\n') || '- none';
    const text = [
      'A teacher submitted a curriculum request.',
      '',
      'Teacher: ' + String(account.displayName || account.username || account.id || ''),
      'Email: ' + String(account.username || ''),
      'Subject: ' + String(submission.subjectName || submission.subjectId || ''),
      'Title: ' + submission.title,
      '',
      'Topics:',
      submission.topics || '(not supplied)',
      '',
      'Syllabus:',
      submission.syllabus || '(not supplied)',
      '',
      'Notes:',
      submission.notes || '(not supplied)',
      '',
      'Uploaded files:',
      files,
    ].join('\n');
    const response = await fetchImpl(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blockcraft-Mail-Secret': bridgeSecret,
      },
      body: JSON.stringify({
        to,
        subject: '[Blockcraft] Curriculum request: ' + submission.title,
        text,
        teacherName: String(account.displayName || account.username || account.id || ''),
        teacherEmail: String(account.username || ''),
        subjectName: String(submission.subjectName || ''),
        subjectId: String(submission.subjectId || ''),
        title: String(submission.title || ''),
        topics: String(submission.topics || ''),
        syllabus: String(submission.syllabus || ''),
        notes: String(submission.notes || ''),
        files: (submission.files || []).map(file => ({
          originalName: String(file.originalName || ''),
          mimeType: String(file.mimeType || ''),
          size: Number(file.size || 0),
        })),
      }),
    });
    if (!response || !response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_e) {}
      throw new Error('mail_bridge_failed' + (detail ? ': ' + detail.slice(0, 200) : ''));
    }
    return { sent: true, to };
  }

  async sendCurriculumCompletionNotification(account, request) {
    const to = String(request && (request.teacherEmail || request.notificationEmail) || '').trim();
    const bridgeUrl = String(this.env.CURRICULUM_MAIL_BRIDGE_URL || DEFAULT_CURRICULUM_MAIL_BRIDGE_URL).trim();
    const bridgeSecret = String(this.env.CURRICULUM_MAIL_BRIDGE_SECRET || this.env.BLOCKCRAFT_CURRICULUM_MAIL_SECRET || '').trim();
    if (!to) return { sent: false, to, reason: 'request_owner_email_missing' };
    if (!bridgeUrl) return { sent: false, to, reason: 'mail_bridge_url_not_configured' };
    if (!bridgeSecret) return { sent: false, to, reason: 'mail_bridge_secret_not_configured' };
    const fetchImpl = this.curriculumMailBridgeFetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return { sent: false, to, reason: 'fetch_not_available' };
    const title = String(request && request.title || 'Curriculum request');
    const subjectName = String(request && request.subjectName || '');
    const text = [
      'Good news - your request to have questions added to the BlockCraft homework game has been completed.',
      '',
      'Request: ' + title,
      subjectName ? 'Subject: ' + subjectName : '',
      request && request.className ? 'Class: ' + request.className : '',
      '',
      'You can sign in to the teacher dashboard to review the request.',
    ].filter(line => line !== '').join('\n');
    const response = await fetchImpl(bridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blockcraft-Mail-Secret': bridgeSecret,
      },
      body: JSON.stringify({
        to,
        template: 'completion',
        subject: '[Blockcraft] Curriculum request complete: ' + title,
        text,
        teacherName: String(request && (request.teacherName || request.teacherEmail) || ''),
        teacherEmail: to,
        completedBy: String(account && (account.displayName || account.username || account.id) || 'Blockcraft admin'),
        subjectName,
        className: String(request && request.className || ''),
        title,
        topics: '',
        syllabus: '',
        notes: '',
        files: [],
      }),
    });
    if (!response || !response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_e) {}
      throw new Error('mail_bridge_failed' + (detail ? ': ' + detail.slice(0, 200) : ''));
    }
    return { sent: true, to };
  }

  bugReportRecipient() {
    return cleanBugText(this.env.BUG_REPORT_NOTIFY_TO || this.env.CURRICULUM_NOTIFY_TO || DEFAULT_BUG_REPORT_TO, 160);
  }

  bugReportMailBridgeUrl() {
    return cleanBugText(this.env.BUG_REPORT_MAIL_BRIDGE_URL || this.env.CURRICULUM_MAIL_BRIDGE_URL || DEFAULT_CURRICULUM_MAIL_BRIDGE_URL, 400);
  }

  bugReportMailBridgeSecret() {
    return String(this.env.BUG_REPORT_MAIL_BRIDGE_SECRET || this.env.CURRICULUM_MAIL_BRIDGE_SECRET || this.env.BLOCKCRAFT_CURRICULUM_MAIL_SECRET || '').trim();
  }

  buildHttpBugReport(account, body = {}) {
    const now = Date.now();
    const context = compactBugValue(body.clientContext || {});
    const snapshot = context && context.snapshot || {};
    const position = context && context.position || snapshot && snapshot.player || null;
    return {
      id: 'bug_' + now.toString(36) + '_' + crypto.randomBytes(4).toString('hex'),
      at: now,
      atIso: new Date(now).toISOString(),
      to: this.bugReportRecipient(),
      route: 'http',
      player: {
        account: accountSummary(account),
        tokenHash: shortHash(account && account.id),
        name: cleanBugText(snapshot && snapshot.player && snapshot.player.name || account && account.displayName || account && account.username || 'Hunter', 80),
        schoolId: cleanBugText(account && account.schoolId || '', 80),
        level: snapshot && snapshot.player && snapshot.player.level || 0,
        job: cleanBugText(snapshot && snapshot.player && snapshot.player.job || '', 40),
      },
      position: compactBugValue(position || {}),
      room: {
        name: cleanBugText(context && context.roomName || snapshot && snapshot.roomName || 'blockcraft', 80),
        dim: cleanBugText(context && context.dimension || snapshot && snapshot.player && snapshot.player.dim || '', 40),
        dgn: cleanBugText(context && context.dungeonId || '', 80),
      },
      progress: compactBugValue({
        quest: snapshot && snapshot.quest || null,
        progression: snapshot && snapshot.progression || null,
        objective: snapshot && snapshot.objective || null,
      }),
      message: cleanBugText(body.message, 2000),
      clientContext: context,
      trace: Array.isArray(body.trace) ? body.trace.slice(-80).map(entry => compactBugValue(entry)) : [],
    };
  }

  bugReportText(report) {
    return [
      'A Blockcraft player reported a bug.',
      '',
      'Report ID: ' + report.id,
      'Time: ' + report.atIso,
      'Route: ' + report.route,
      'Player: ' + (report.player.name || 'Hunter'),
      'School ID: ' + (report.player.schoolId || '(none)'),
      'Account: ' + JSON.stringify(report.player.account || {}),
      'Location: ' + JSON.stringify(report.position || {}),
      'Room: ' + JSON.stringify(report.room || {}),
      '',
      'Player message:',
      report.message || '(no custom message)',
      '',
      'Progress snapshot:',
      JSON.stringify(report.progress, null, 2),
      '',
      'Client context:',
      JSON.stringify(report.clientContext, null, 2),
      '',
      'Recent player/client actions:',
      JSON.stringify(report.trace, null, 2),
    ].join('\n');
  }

  async saveBugReportFile(report) {
    const dir = path.join(this.dir, 'bug-reports');
    await fs.promises.mkdir(dir, { recursive: true });
    const file = path.join(dir, report.id + '.json');
    await fs.promises.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
    return file;
  }

  async sendBugReportNotification(report) {
    const to = report.to || this.bugReportRecipient();
    const bridgeUrl = this.bugReportMailBridgeUrl();
    const bridgeSecret = this.bugReportMailBridgeSecret();
    if (!to) return { sent: false, to, reason: 'mail_recipient_not_configured' };
    if (!bridgeUrl) return { sent: false, to, reason: 'mail_bridge_url_not_configured' };
    if (!bridgeSecret) return { sent: false, to, reason: 'mail_bridge_secret_not_configured' };
    const fetchImpl = this.bugReportMailBridgeFetch || this.curriculumMailBridgeFetch || globalThis.fetch;
    if (typeof fetchImpl !== 'function') return { sent: false, to, reason: 'fetch_not_available' };
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeout = null;
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blockcraft-Mail-Secret': bridgeSecret,
      },
      body: JSON.stringify({
        to,
        subject: '[Blockcraft] Bug report: ' + report.id,
        title: 'Bug report: ' + report.id,
        template: 'request',
        teacherName: report.player && report.player.name || 'Blockcraft Player',
        teacherEmail: this.env.BUG_REPORT_BRIDGE_TEACHER_EMAIL || this.env.CURRICULUM_DASHBOARD_TEACHER_EMAIL || 'asherlevin85@gmail.com',
        subjectName: 'Bug Reports',
        topics: 'In-game bug report from ' + (report.player && report.player.name || 'Blockcraft Player'),
        syllabus: 'Location: ' + JSON.stringify(report.position || {}) + ' | Room: ' + JSON.stringify(report.room || {}),
        notes: this.bugReportText(report),
        text: this.bugReportText(report),
        bugReport: report,
      }),
    };
    if (controller) {
      fetchOptions.signal = controller.signal;
      timeout = setTimeout(() => controller.abort(), BUG_REPORT_MAIL_TIMEOUT_MS);
    }
    let response;
    try {
      response = await fetchImpl(bridgeUrl, fetchOptions);
    } catch (error) {
      if (error && (error.name === 'AbortError' || /abort/i.test(String(error.message || '')))) return { sent: false, to, reason: 'mail_bridge_timeout' };
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    if (!response || !response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (_e) {}
      throw new Error('mail_bridge_failed' + (detail ? ': ' + detail.slice(0, 200) : ''));
    }
    return { sent: true, to };
  }

  authorizeTeacher(req) {
    const account = this.authenticateRequest(req);
    if (!account) return false;
    if (account.accountType !== 'teacher' && cleanAdminId(account.role) !== 'teacher' && cleanAdminId(account.role) !== 'admin') return false;
    return account;
  }

  async publicGameProfile(account) {
    const id = account && account.id;
    if (!id) return { name: '', nameSet: false, path: '', appearance: APPEARANCE_SYSTEM.sanitizeAppearance(null) };
    try {
      const raw = await this.getProfileStore().loadPlayer(id);
      if (!raw) {
        recordIdentityTrace('auth.profile.lookup', {
          account: accountSummary(account),
          profile: { exists: false, name: '', nameSet: false, level: 1 },
        });
        return { name: '', nameSet: false, path: '', appearance: APPEARANCE_SYSTEM.sanitizeAppearance(null) };
      }
      const profile = sanitizeProfile(raw);
      if (ensureAsherAdminFishingRod(profile, account)) {
        await this.getProfileStore().savePlayer(id, profile);
      }
      recordIdentityTrace('auth.profile.lookup', {
        account: accountSummary(account),
        profile: {
          exists: true,
          name: profile.name,
          nameSet: profile.nameSet === true,
          level: profile.S && profile.S.lvl || 1,
          path: profile.S && profile.S.path || '',
        },
      });
      return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true, path: profile.S && profile.S.path || '', appearance: APPEARANCE_SYSTEM.sanitizeAppearance(profile.appearance) };
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
      Object.assign(summary, adminProfileSummary(profile));
      summary.activeRoom = profile.activeRoom || null;
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
    profile.S = profile.S && typeof profile.S === 'object' ? profile.S : {};
    if (hasOwn(patch, 'level')) {
      const before = Math.max(1, profile.S.lvl | 0);
      const next = clampAdminInt(patch.level, 1, 60);
      profile.S.lvl = next;
      if (next > before) profile.S.pts = clampAdminInt((profile.S.pts | 0) + (next - before), 0, 999);
    }
    if (hasOwn(patch, 'xp')) profile.S.xp = clampAdminInt(patch.xp, 0, JOB_XP_MAX);
    if (hasOwn(patch, 'statPoints')) profile.S.pts = clampAdminInt(patch.statPoints, 0, 999);
    if (hasOwn(patch, 'gold')) profile.gold = clampAdminInt(patch.gold, 0, JOB_XP_MAX);
    if (hasOwn(patch, 'addGold')) profile.gold = clampAdminInt((profile.gold | 0) + Number(patch.addGold || 0), 0, JOB_XP_MAX);
    if (hasOwn(patch, 'maxHp')) applyAdminMaxStat(profile, 'vit', patch.maxHp, 20, 2, 'hp');
    if (hasOwn(patch, 'maxMp')) applyAdminMaxStat(profile, 'int', patch.maxMp, 20, 3, 'mp');
    if (hasOwn(patch, 'maxSp')) applyAdminMaxStat(profile, 'agi', patch.maxSp, 100, 4, 'sp');
    if (hasOwn(patch, 'vitals')) {
      if (!patch.vitals || typeof patch.vitals !== 'object' || Array.isArray(patch.vitals)) {
        throw Object.assign(new Error('vitals must be an object.'), { status: 400, code: 'vitals' });
      }
      profile.vitals = profile.vitals && typeof profile.vitals === 'object' ? profile.vitals : {};
      for (const key of ['hp', 'mp', 'sp', 'hunger']) {
        if (hasOwn(patch.vitals, key)) profile.vitals[key] = Math.max(0, Number(patch.vitals[key]) || 0);
      }
      profile.vitalsSavedAt = Date.now();
    }

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
    for (const item of grants) grantProfileItem(profile, item);

    profile = sanitizeProfile(profile);
    await store.savePlayer(account.id, profile);
    const liveRoomsUpdated = await updateLivePlayerProfiles(account.id, { replaceProfile: profile });
    return {
      account,
      liveRoomsUpdated,
      profile: {
        ...adminProfileSummary(profile),
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
    return { name: clean, nameSet: true, path: profile.S && profile.S.path || '', appearance: APPEARANCE_SYSTEM.sanitizeAppearance(profile.appearance) };
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
    return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true, path: profile.S && profile.S.path || '', appearance: nextAppearance };
  }

  async saveHunterPath(account, value) {
    const publicAccount = this.publicAccount(account);
    if (!publicAccount || !publicAccount.id) throw Object.assign(new Error('Not signed in.'), { status: 401, code: 'auth' });
    const nextPath = resolveAdminAbilityPath(value);
    if (!nextPath) throw Object.assign(new Error('Choose an ability path.'), { status: 400, code: 'ability_path' });
    const store = this.getProfileStore();
    let profile = null;
    try {
      const existing = await store.loadPlayer(publicAccount.id);
      profile = existing ? sanitizeProfile(existing) : defaultProfile(publicAccount.displayName || publicAccount.username || 'Hunter');
    } catch (e) {
      throw Object.assign(new Error('Could not load profile.'), { status: 500, code: 'profile' });
    }
    const currentPath = profile.S && profile.S.path || '';
    if (currentPath && currentPath !== nextPath) {
      throw Object.assign(new Error('Your hunter path is already locked.'), { status: 409, code: 'path_locked', path: currentPath });
    }
    profile.S.path = nextPath;
    profile.tutorials.ability = Math.max(profile.tutorials.ability | 0, TUTORIAL_VERSIONS.ability);
    await store.savePlayer(publicAccount.id, profile);
    await updateLivePlayerProfiles(publicAccount.id, { path: nextPath });
    return { name: profile.nameSet ? profile.name : '', nameSet: profile.nameSet === true, path: nextPath, appearance: APPEARANCE_SYSTEM.sanitizeAppearance(profile.appearance) };
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
    return { name: clean, nameSet: true, path: profile.S && profile.S.path || '', appearance: nextAppearance };
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

  async loginTeacherToken(token) {
    if (!this.authBackend || typeof this.authBackend.loginTeacherToken !== 'function') {
      throw Object.assign(new Error('Teacher handoff is not configured.'), { status: 503, code: 'teacher_token_config' });
    }
    const account = await this.authBackend.loginTeacherToken(token);
    if (!account) throw Object.assign(new Error('Invalid teacher handoff token.'), { status: 401, code: 'teacher_token' });
    return account;
  }

  async loginHandoffToken(token) {
    const signedAccount = verifyLightweaveHandoffToken(token);
    if (signedAccount) return signedAccount;
    if (this.authBackend && typeof this.authBackend.loginHandoffToken === 'function') {
      const account = await this.authBackend.loginHandoffToken(token);
      if (account) return account;
    }
    throw Object.assign(new Error('Invalid login handoff token.'), { status: 401, code: 'handoff_token' });
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
    app.use('/auth/bug-report', require('express').json({ limit: '180kb' }));
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
    app.post('/auth/teacher/token-login', async (req, res) => {
      const token = req.body && (req.body.authToken || req.body.auth_token || req.body.token);
      if (!this.allowAttempt(req, 'teacher-token')) return res.status(429).json({ ok: false, error: 'Too many authentication attempts.' });
      try {
        const account = await this.loginTeacherToken(token);
        const sid = await this.issueSession(account);
        res.setHeader('Set-Cookie', this.cookie(sid, req));
        res.json({ ok: true, account: this.publicAccount(account), gameProfile: await this.publicGameProfile(account), sessionToken: sid });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Teacher handoff failed.' });
      }
    });
    app.post('/auth/token-login', async (req, res) => {
      const token = req.body && (req.body.authToken || req.body.auth_token || req.body.token);
      if (!this.allowAttempt(req, 'handoff-token')) return res.status(429).json({ ok: false, error: 'Too many authentication attempts.' });
      try {
        const account = await this.loginHandoffToken(token);
        const sid = await this.issueSession(account);
        res.setHeader('Set-Cookie', this.cookie(sid, req));
        res.json({ ok: true, account: this.publicAccount(account), gameProfile: await this.publicGameProfile(account), sessionToken: sid });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Login handoff failed.' });
      }
    });
    app.get('/auth/me', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      res.json({ ok: true, account, gameProfile: await this.publicGameProfile(account) });
    });
    app.post('/auth/bug-report', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false, code: 'auth' });
      try {
        const report = this.buildHttpBugReport(account, req.body || {});
        await this.saveBugReportFile(report);
        let mail = { sent: false, to: report.to, reason: 'not_attempted' };
        try {
          mail = await this.sendBugReportNotification(report);
        } catch (error) {
          mail = { sent: false, to: report.to, reason: cleanBugText(error && error.message || 'mail_failed', 240) };
        }
        console.warn('[bug-report-http]', JSON.stringify({ id: report.id, player: report.player.name, position: report.position, mail }));
        res.json({ ok: true, id: report.id, to: report.to, saved: true, mailed: !!(mail && mail.sent), mailReason: mail && mail.reason || '' });
      } catch (e) {
        console.warn('[bug-report-http] failed:', e && e.message || e);
        res.status(500).json({ ok: false, code: 'save_failed' });
      }
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
    app.post('/auth/profile/path', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false });
      try {
        const gameProfile = await this.saveHunterPath(account, req.body && req.body.path);
        res.json({ ok: true, gameProfile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', path: e.path || '', error: e.status ? e.message : 'Path update failed.' });
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
    app.get('/auth/profile/subjects', async (req, res) => {
      const account = this.authenticateRequest(req);
      if (!account) return res.status(401).json({ ok: false, error: 'Sign in required.' });
      try {
        const store = this.getGameQuestionStore();
        const subjects = store && typeof store.listStudentSubjects === 'function' ? await store.listStudentSubjects(account) : [];
        res.json({ ok: true, subjects });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load subjects.' });
      }
    });
    app.get('/auth/teacher/subjects', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const subjects = await this.getGameQuestionStore().listSubjects(account);
        res.json({ ok: true, subjects });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load subjects.' });
      }
    });
    app.get('/auth/teacher/classes', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const classes = await this.getGameQuestionStore().listClasses(account, req.query && (req.query.subjectId || req.query.subject_id));
        res.json({ ok: true, classes });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load classes.' });
      }
    });
    app.get('/auth/teacher/game-questions', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const questions = await this.getGameQuestionStore().listQuestions(account, req.query || {});
        res.json({ ok: true, questions });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load game questions.' });
      }
    });
    app.get('/auth/teacher/knowledge-plan', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const store = this.getGameQuestionStore();
        const plan = store && typeof store.listKnowledgePlan === 'function' ? await store.listKnowledgePlan(account, req.query || {}) : { entities: [], atoms: [], confusionPairs: [], counts: {} };
        res.json({ ok: true, plan });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load Knowledge Challenge plan.' });
      }
    });
    app.get('/auth/teacher/analytics', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const analytics = await this.getGameQuestionStore().analytics(account, req.query || {});
        res.json({ ok: true, analytics });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load teacher analytics.' });
      }
    });
    app.get('/auth/teacher/homework', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const homework = await this.getGameQuestionStore().listHomework(account, req.query || {});
        res.json({ ok: true, homework });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load homework.' });
      }
    });
    app.get('/auth/teacher/curriculum-requests', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const store = this.getGameQuestionStore();
        const requests = typeof store.listCurriculumRequests === 'function' ? await store.listCurriculumRequests(account, req.query || {}) : [];
        res.json({ ok: true, requests, admin: this.isAdminAccount(account) || cleanUsername(account.username) === 'asherlevin85@gmail.com' });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not load curriculum requests.' });
      }
    });
    app.get('/auth/teacher/curriculum-requests/:id/files/:storedName', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const store = this.getGameQuestionStore();
        if (!store || typeof store.curriculumAttachment !== 'function') throw Object.assign(new Error('Attachment not found.'), { status: 404 });
        const file = await store.curriculumAttachment(account, req.params && req.params.id, req.params && req.params.storedName);
        const uploadRoot = path.resolve(this.curriculumUploadDir);
        const filePath = path.resolve(file.path || path.join(uploadRoot, file.storedName));
        if (!filePath.startsWith(uploadRoot + path.sep)) throw Object.assign(new Error('Attachment not found.'), { status: 404 });
        res.download(filePath, file.originalName || file.storedName);
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not download attachment.' });
      }
    });
    app.post('/auth/teacher/curriculum-requests/:id/complete', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const store = this.getGameQuestionStore();
        if (!store || typeof store.completeCurriculumRequest !== 'function') throw Object.assign(new Error('Curriculum request not found.'), { status: 404 });
        const request = await store.completeCurriculumRequest(account, req.params && req.params.id);
        const notification = await this.sendCurriculumCompletionNotification(account, request)
          .catch(e => ({ sent: false, to: String(request && request.teacherEmail || ''), reason: e && e.message || 'mail_failed' }));
        res.json({ ok: true, request, notification });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not complete curriculum request.' });
      }
    });
    app.delete('/auth/teacher/curriculum-requests/:id', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const store = this.getGameQuestionStore();
        if (!store || typeof store.deleteCurriculumRequest !== 'function') throw Object.assign(new Error('Curriculum request not found.'), { status: 404 });
        const deleted = await store.deleteCurriculumRequest(account, req.params && req.params.id);
        const uploadRoot = path.resolve(this.curriculumUploadDir);
        await Promise.all((deleted.files || []).map(file => {
          const filePath = path.resolve(file.path || path.join(uploadRoot, file.storedName || ''));
          if (!filePath.startsWith(uploadRoot + path.sep)) return Promise.resolve();
          return fs.promises.unlink(filePath).catch(() => {});
        }));
        res.json({ ok: true, deleted: { id: deleted.id } });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not delete curriculum request.' });
      }
    });
    app.post('/auth/teacher/homework', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const homework = await this.getGameQuestionStore().createHomework(account, req.body || {});
        res.json({ ok: true, homework });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not set homework.' });
      }
    });
    app.post('/auth/teacher/curriculum-requests', (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      this.curriculumUploadMiddleware()(req, res, async err => {
        if (err) return res.status(err.status || 400).json({ ok: false, code: err.code || 'upload', error: err.message || 'Upload failed.' });
        const uploaded = (req.files || []).map(file => ({
          originalName: file.originalname,
          storedName: file.filename,
          path: file.path,
          mimeType: file.mimetype,
          size: file.size,
        }));
        try {
          const draft = {
            subjectId: req.body && req.body.subjectId,
            classId: req.body && req.body.classId,
            title: req.body && req.body.title,
            topics: req.body && req.body.topics,
            syllabus: req.body && req.body.syllabus,
            notes: req.body && req.body.notes,
            files: uploaded,
          };
          const store = this.getGameQuestionStore();
          const submission = await store.createCurriculumRequest(account, {
            ...draft,
            notificationEmail: String(this.env.CURRICULUM_NOTIFY_TO || 'asherlevin85@gmail.com'),
            notificationSent: false,
          });
          const notification = await this.sendCurriculumNotification(account, submission)
            .catch(e => ({ sent: false, to: String(this.env.CURRICULUM_NOTIFY_TO || 'asherlevin85@gmail.com'), reason: e && e.message || 'mail_failed' }));
          if (typeof store.markCurriculumNotification === 'function') {
            await store.markCurriculumNotification(account, submission.id, notification.sent, notification.to).catch(() => {});
          }
          submission.notificationSent = notification.sent;
          submission.notificationEmail = notification.to;
          res.json({ ok: true, submission, notification });
        } catch (e) {
          await Promise.all(uploaded.map(file => fs.promises.unlink(file.path).catch(() => {})));
          res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not submit curriculum request.' });
        }
      });
    });
    app.post('/auth/teacher/game-questions', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const question = await this.getGameQuestionStore().createQuestion(account, req.body || {});
        res.json({ ok: true, question });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not save game question.' });
      }
    });
    app.post('/auth/teacher/game-questions/:id', async (req, res) => {
      const account = this.authorizeTeacher(req);
      if (!account) return res.status(403).json({ ok: false, error: 'Teacher account required.' });
      try {
        const question = await this.getGameQuestionStore().updateQuestion(account, req.params && req.params.id, req.body || {});
        res.json({ ok: true, question });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Could not update game question.' });
      }
    });
    app.post('/auth/admin/reset-player', async (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.resetPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, liveRoomsReset: result.liveRoomsReset });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Reset failed.' });
      }
    });
    app.post('/auth/admin/player-profile', async (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.inspectPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile lookup failed.' });
      }
    });
    app.post('/auth/admin/player-profile/name', async (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.setPlayerProfileName(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile rename failed.' });
      }
    });
    app.post('/auth/admin/player-profile/level-two-job-choice', async (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.resetPlayerToLevelTwoJobChoice(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile, liveRoomsUpdated: result.liveRoomsUpdated });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Level two reset failed.' });
      }
    });
    app.post('/auth/admin/player-profile/patch', async (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      try {
        const result = await this.patchPlayerProfile(req.body);
        res.json({ ok: true, account: result.account, profile: result.profile, liveRoomsUpdated: result.liveRoomsUpdated });
      } catch (e) {
        res.status(e.status || 500).json({ ok: false, code: e.code || 'server', error: e.status ? e.message : 'Profile patch failed.' });
      }
    });
    app.get('/auth/admin/identity-trace', (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, events: recentIdentityTrace() });
    });
    app.post('/auth/admin/identity-trace/clear', (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, cleared: clearIdentityTrace() });
    });
    app.get('/auth/admin/room-lifecycle', (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
      res.json({ ok: true, events: recentRoomLifecycleTrace() });
    });
    app.post('/auth/admin/room-lifecycle/clear', (req, res) => {
      if (!this.authorizeAdmin(req)) return res.status(403).json({ ok: false, error: 'Forbidden.' });
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
