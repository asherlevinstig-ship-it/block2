const crypto = require('node:crypto');

const ADMISSION_TTL_MS = 30000;
const admissions = new Map();

function pruneAdmissions(now = Date.now()) {
  for (const [ticket, entry] of admissions) if (entry.expiresAt <= now) admissions.delete(ticket);
}

function issueDungeonAdmission(gate, tokens, now = Date.now()) {
  if (!gate || !gate.id) throw new TypeError('gate admission requires a canonical gate');
  const allowed = new Set((tokens || []).filter(Boolean));
  if (!allowed.size) throw new TypeError('gate admission requires an authenticated party');
  pruneAdmissions(now);
  const ticket = crypto.randomBytes(24).toString('base64url');
  admissions.set(ticket, {
    gate: {
      id: gate.id, seed: gate.seed >>> 0, dungeonId: gate.dungeonId || '', rank: gate.rank | 0,
      kind: gate.kind || 'public', x: +gate.x, y: +gate.y, z: +gate.z,
      expiresAt: gate.expiresAt || 0,
      shardPlus: gate.shardPlus | 0, shardName: gate.shardName || '', shardMods: gate.shardMods || '',
    },
    allowed,
    claimed: new Set(),
    expiresAt: now + ADMISSION_TTL_MS,
  });
  return ticket;
}

function peekDungeonAdmission(ticket, now = Date.now()) {
  const entry = typeof ticket === 'string' ? admissions.get(ticket) : null;
  if (!entry || entry.expiresAt <= now) {
    if (entry) admissions.delete(ticket);
    return null;
  }
  return entry.gate;
}

function claimDungeonAdmission(ticket, token, now = Date.now()) {
  const entry = typeof ticket === 'string' ? admissions.get(ticket) : null;
  if (!entry || entry.expiresAt <= now || !token || !entry.allowed.has(token) || entry.claimed.has(token)) {
    if (entry && entry.expiresAt <= now) admissions.delete(ticket);
    return null;
  }
  entry.claimed.add(token);
  return entry.gate;
}

function clearDungeonAdmissions() { admissions.clear(); }
function revokeDungeonAdmission(ticket) { return admissions.delete(ticket); }

module.exports = { ADMISSION_TTL_MS, issueDungeonAdmission, peekDungeonAdmission, claimDungeonAdmission, pruneAdmissions, clearDungeonAdmissions, revokeDungeonAdmission };
