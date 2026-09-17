const { xpNeedForLevel, hunterRankIndexForLevel } = require('./rooms/constants');

const categories = ['stats', 'xp', 'money', 'level', 'guild'];
const number = value => Math.max(0, Math.min(1e12, Number(value) || 0));
const rankNames = ['E', 'D', 'C', 'B', 'A', 'S'];

function powerMetrics(profile, guild) {
  const s = profile.S || {}, level = Math.max(1, Math.min(999, Math.floor(number(s.lvl))));
  let xp = number(s.xp);
  for (let i = 1; i < level; i++) xp += xpNeedForLevel(i);
  return {
    stats: ['str', 'agi', 'vit', 'int'].reduce((sum, key) => sum + number(s[key]), 0),
    xp, money: number(profile.gold), level,
    guild: guild ? 1 + Math.floor(Math.sqrt(number(guild.totalRenown) / 100)) : 0,
  };
}

function buildPowerRanking(profiles, guilds, ownToken) {
  const membership = new Map();
  for (const guild of guilds.values()) for (const token of guild.members || []) membership.set(token, guild);
  const rows = [...profiles.entries()].filter(([, p]) => p && p.name && p.nameSet !== false && (p.nameSet === true || p.name !== 'Hunter')).map(([token, profile]) => {
    const guild = membership.get(token);
    return { token, name: String(profile.name).slice(0, 32), guildName: guild ? String(guild.name).slice(0, 32) : '', metrics: powerMetrics(profile, guild) };
  });
  // Midrank percentiles make every category worth at most 20 points and preserve ties.
  for (const key of categories) {
    const values = rows.map(row => row.metrics[key]).sort((a, b) => a - b);
    const points = new Map();
    for (let i = 0; i < values.length;) {
      let j = i + 1;
      while (j < values.length && values[j] === values[i]) j++;
      points.set(values[i], values[i] === 0 ? 0 : values.length === 1 ? 20 : 20 * (i + j - 1) / (2 * (values.length - 1)));
      i = j;
    }
    for (const row of rows) { row.points ||= {}; row.points[key] = points.get(row.metrics[key]); }
  }
  for (const row of rows) row.score = categories.reduce((sum, key) => sum + row.points[key], 0);
  rows.sort((a, b) => b.score - a.score || b.metrics.level - a.metrics.level || b.metrics.xp - a.metrics.xp || a.token.localeCompare(b.token));
  let previous = null, place = 0;
  const publicRows = rows.map((row, index) => {
    if (previous === null || Math.abs(previous - row.score) > 1e-9) place = index + 1;
    previous = row.score;
    return { place, name: row.name, guildName: row.guildName, rank: rankNames[hunterRankIndexForLevel(row.metrics.level)], metrics: row.metrics,
      score: Math.round(row.score * 100) / 100, points: Object.fromEntries(categories.map(key => [key, Math.round(row.points[key] * 100) / 100])), you: row.token === ownToken };
  });
  return { total: rows.length, leaders: publicRows.slice(0, 20), yours: publicRows.find(row => row.you) || null,
    crownTokens: rows.filter(row => rows.length && Math.abs(row.score - rows[0].score) < 1e-9).map(row => row.token) };
}

// Share one lazy saved-profile scan across rooms. No polling or per-player full scans.
let snapshot = null, refresh = null;
const pendingUpdates = new Map();
function updateSavedPowerProfile(token, profile) {
  const value = profile ? { name: profile.name, nameSet: profile.nameSet, S: { ...profile.S }, gold: profile.gold } : null;
  if (snapshot) { if (value) snapshot.set(token, value); else snapshot.delete(token); }
  else if (refresh) pendingUpdates.set(token, value);
}
async function savedPowerProfiles(store) {
  if (snapshot) return new Map(snapshot);
  if (!refresh) refresh = store.loadPowerProfiles().then(rows => {
    snapshot = new Map(rows);
    for (const [token, value] of pendingUpdates) { if (value) snapshot.set(token, value); else snapshot.delete(token); }
    pendingUpdates.clear();
    return snapshot;
  }).finally(() => { refresh = null; });
  return new Map(await refresh);
}

module.exports = { powerMetrics, buildPowerRanking, savedPowerProfiles, updateSavedPowerProfile };
