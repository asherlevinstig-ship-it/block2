const crypto = require('crypto');

const MAX_EVENTS = Math.max(25, Math.min(500, Number(process.env.IDENTITY_TRACE_MAX || 200) | 0));
const events = [];

function shortHash(value) {
  const raw = String(value || '');
  if (!raw) return '';
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

function accountSummary(account) {
  if (!account || typeof account !== 'object') return null;
  const out = {
    id: String(account.id || ''),
    username: String(account.username || ''),
    displayName: String(account.displayName || ''),
  };
  if (account.accountType) out.accountType = String(account.accountType || '');
  if (account.role) out.role = String(account.role || '');
  if (account.schoolId != null) out.schoolId = String(account.schoolId || '');
  return out;
}

function recordIdentityTrace(type, detail = {}) {
  const entry = {
    at: new Date().toISOString(),
    type: String(type || 'identity'),
    ...detail,
  };
  events.push(entry);
  while (events.length > MAX_EVENTS) events.shift();
  try {
    console.log('[identity-trace] ' + JSON.stringify(entry));
  } catch (_) {
    console.log('[identity-trace] ' + entry.type);
  }
  return entry;
}

function recentIdentityTrace() {
  return events.slice();
}

function clearIdentityTrace() {
  const count = events.length;
  events.length = 0;
  return count;
}

module.exports = {
  accountSummary,
  clearIdentityTrace,
  recentIdentityTrace,
  recordIdentityTrace,
  shortHash,
};
