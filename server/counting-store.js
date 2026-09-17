const { JsonStore, packWorldEditChunks } = require('./store');

const DEFAULT_PRICES_USD_PER_MILLION = Object.freeze({ reads: 0.30, writes: 0.90, deletes: 0.10 });
const FREE_DAILY_QUOTA = Object.freeze({ reads: 50000, writes: 20000, deletes: 20000 });

function emptyUsage() {
  return { reads: 0, writes: 0, deletes: 0, bytesRead: 0, bytesWritten: 0, calls: 0, byCategory: {}, byOperation: {} };
}

let usage = emptyUsage();

function jsonBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value == null ? null : value)); }
  catch (_) { return 0; }
}

function add(target, counts) {
  target.calls = (target.calls || 0) + 1;
  for (const key of ['reads', 'writes', 'deletes', 'bytesRead', 'bytesWritten']) {
    target[key] = (target[key] || 0) + Math.max(0, Number(counts[key]) || 0);
  }
}

function record(operation, category, counts = {}) {
  add(usage, counts);
  add(usage.byCategory[category] || (usage.byCategory[category] = {}), counts);
  add(usage.byOperation[operation] || (usage.byOperation[operation] = {}), counts);
}

function resetCountingUsage() {
  usage = emptyUsage();
}

function getCountingUsageSnapshot() {
  return JSON.parse(JSON.stringify(usage));
}

function subtractUsage(after, before) {
  const out = {};
  for (const key of ['reads', 'writes', 'deletes', 'bytesRead', 'bytesWritten', 'calls']) {
    out[key] = Math.max(0, (Number(after && after[key]) || 0) - (Number(before && before[key]) || 0));
  }
  return out;
}

function scaleUsage(value, factor) {
  const out = {};
  for (const key of ['reads', 'writes', 'deletes', 'bytesRead', 'bytesWritten', 'calls']) {
    out[key] = Math.max(0, (Number(value && value[key]) || 0) * factor);
  }
  return out;
}

function sumUsage(...values) {
  return values.reduce((total, value) => {
    for (const key of ['reads', 'writes', 'deletes', 'bytesRead', 'bytesWritten', 'calls']) {
      total[key] += Number(value && value[key]) || 0;
    }
    return total;
  }, { reads: 0, writes: 0, deletes: 0, bytesRead: 0, bytesWritten: 0, calls: 0 });
}

function estimateFirestoreCost(daily, prices = DEFAULT_PRICES_USD_PER_MILLION, days = 30) {
  const chargeableDaily = {};
  let dailyUsd = 0;
  for (const key of ['reads', 'writes', 'deletes']) {
    chargeableDaily[key] = Math.max(0, (Number(daily && daily[key]) || 0) - FREE_DAILY_QUOTA[key]);
    dailyUsd += chargeableDaily[key] / 1_000_000 * (Number(prices[key]) || 0);
  }
  return {
    pricesUsdPerMillion: { ...prices },
    freeDailyQuota: { ...FREE_DAILY_QUOTA },
    chargeableDaily,
    dailyUsd,
    monthlyUsd: dailyUsd * Math.max(0, Number(days) || 0),
  };
}

class CountingStore extends JsonStore {
  async loadWorldEdits() {
    const edits = await super.loadWorldEdits();
    const chunks = {};
    for (const [key, value] of Object.entries(edits)) {
      const [x, , z] = key.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      const id = (x >> 4) + '_' + (z >> 4);
      (chunks[id] || (chunks[id] = {}))[key] = value;
    }
    const packReads = Math.max(1, Object.keys(packWorldEditChunks(chunks)).length);
    record('loadWorldEdits', 'world', { reads: 1 + packReads, bytesRead: jsonBytes(edits) });
    return edits;
  }

  async saveWorldEdits(edits) {
    const chunks = {};
    for (const [key, value] of Object.entries(edits || {})) {
      const [x, , z] = key.split(',').map(Number);
      if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
      const id = (x >> 4) + '_' + (z >> 4);
      (chunks[id] || (chunks[id] = {}))[key] = value;
    }
    await JsonStore.prototype.saveWorldEdits.call(this, edits);
    const writes = Math.max(1, Object.keys(packWorldEditChunks(chunks)).length);
    record('saveWorldEdits', 'world', { writes, bytesWritten: jsonBytes(edits) });
  }

  async saveWorldEditChunks(chunks) {
    const edits = await JsonStore.prototype.loadWorldEdits.call(this);
    for (const [chunkId, replacement] of Object.entries(chunks || {})) {
      const prefix = String(chunkId).split('_').map(Number);
      if (prefix.length !== 2 || prefix.some(value => !Number.isFinite(value))) continue;
      for (const key of Object.keys(edits)) {
        const [x, , z] = key.split(',').map(Number);
        if ((x >> 4) === prefix[0] && (z >> 4) === prefix[1]) delete edits[key];
      }
      Object.assign(edits, replacement || {});
    }
    await JsonStore.prototype.saveWorldEdits.call(this, edits);
    const writes = Object.keys(packWorldEditChunks(chunks)).length;
    record('saveWorldEditChunks', 'world', { writes, bytesWritten: jsonBytes(chunks) });
  }

  async loadPlayer(token) {
    const value = await super.loadPlayer(token);
    record('loadPlayer', 'profiles', { reads: 1, bytesRead: jsonBytes(value) });
    return value;
  }

  async savePlayer(token, profile) {
    await super.savePlayer(token, profile);
    record('savePlayer', 'profiles', { writes: 1, bytesWritten: jsonBytes(profile) });
  }

  async deletePlayer(token) {
    await super.deletePlayer(token);
    record('deletePlayer', 'profiles', { deletes: 1 });
  }

  async saveModerationReport(report) {
    await super.saveModerationReport(report);
    record('saveModerationReport', 'moderation', { writes: 1, bytesWritten: jsonBytes(report) });
  }

  async grantTownMapToAllPlayers() {
    record('townMapMarkerRead', 'maintenance', { reads: 1 });
    return { ok: true, skipped: true, reason: 'offline-simulator-marker' };
  }
}

for (const [method, operation] of [
  ['loadWorldProgress', 'loadWorldProgress'], ['loadLandClaims', 'loadLandClaims'],
  ['loadChests', 'loadChests'], ['loadFurnaces', 'loadFurnaces'],
  ['loadIncubations', 'loadIncubations'], ['loadNestDragons', 'loadNestDragons'],
  ['loadGates', 'loadGates'], ['loadTeams', 'loadTeams'], ['loadGuilds', 'loadGuilds'],
]) {
  CountingStore.prototype[method] = async function (...args) {
    const value = await JsonStore.prototype[method].apply(this, args);
    record(operation, 'world', { reads: 1, bytesRead: jsonBytes(value) });
    return value;
  };
}

for (const [method, operation] of [
  ['saveWorldProgress', 'saveWorldProgress'], ['saveLandClaims', 'saveLandClaims'],
  ['saveChests', 'saveChests'], ['saveFurnaces', 'saveFurnaces'],
  ['saveIncubations', 'saveIncubations'], ['saveNestDragons', 'saveNestDragons'],
  ['saveGates', 'saveGates'], ['saveTeams', 'saveTeams'], ['saveGuilds', 'saveGuilds'],
]) {
  CountingStore.prototype[method] = async function (value, ...args) {
    await JsonStore.prototype[method].call(this, value, ...args);
    record(operation, 'world', { writes: 1, bytesWritten: jsonBytes(value) });
  };
}

module.exports = {
  CountingStore,
  DEFAULT_PRICES_USD_PER_MILLION,
  FREE_DAILY_QUOTA,
  estimateFirestoreCost,
  getCountingUsageSnapshot,
  resetCountingUsage,
  scaleUsage,
  subtractUsage,
  sumUsage,
};
