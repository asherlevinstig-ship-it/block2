const DEFAULT_LIMIT = 1000;

function cleanPart(value, fallback = 'unknown') {
  const text = String(value || '').toLowerCase().replace(/[^a-z0-9_.:-]/g, '_').slice(0, 48);
  return text || fallback;
}

function signedAmount(amount) {
  const n = Math.round(Number(amount) || 0);
  return Math.max(-1000000000, Math.min(1000000000, n));
}

function createEconomyLedger(limit = DEFAULT_LIMIT) {
  return { limit: Math.max(1, Math.min(10000, limit | 0 || DEFAULT_LIMIT)), seq: 0, events: [] };
}

function recordEconomyGold(ledger, entry = {}, now = Date.now()) {
  if (!ledger || !Array.isArray(ledger.events)) return null;
  const amount = signedAmount(entry.amount);
  if (!amount) return null;
  const event = {
    seq: ++ledger.seq,
    at: Math.max(0, Number(now) || Date.now()),
    token: String(entry.token || '').slice(0, 64),
    sid: String(entry.sid || '').slice(0, 64),
    player: String(entry.player || '').slice(0, 32),
    category: amount > 0 ? cleanPart(entry.category, 'faucet') : cleanPart(entry.category, 'sink'),
    source: cleanPart(entry.source, 'unknown'),
    amount,
    balance: Math.max(0, Math.min(1000000000, Math.round(Number(entry.balance) || 0))),
    meta: entry.meta && typeof entry.meta === 'object' ? { ...entry.meta } : {},
  };
  ledger.events.push(event);
  if (ledger.events.length > ledger.limit) ledger.events.splice(0, ledger.events.length - ledger.limit);
  return event;
}

function summarizeEconomyGold(ledger, opts = {}) {
  const since = Math.max(0, Number(opts.since) || 0);
  const token = opts.token ? String(opts.token).slice(0, 64) : '';
  const events = (ledger && Array.isArray(ledger.events) ? ledger.events : [])
    .filter(e => (!since || e.at >= since) && (!token || e.token === token));
  const summary = { count: events.length, faucets: 0, sinks: 0, net: 0, byCategory: {}, bySource: {} };
  for (const e of events) {
    const amount = e.amount | 0;
    if (amount > 0) summary.faucets += amount;
    else summary.sinks += -amount;
    summary.net += amount;
    summary.byCategory[e.category] = (summary.byCategory[e.category] || 0) + amount;
    const key = e.category + ':' + e.source;
    summary.bySource[key] = (summary.bySource[key] || 0) + amount;
  }
  return summary;
}

module.exports = { createEconomyLedger, recordEconomyGold, summarizeEconomyGold };
