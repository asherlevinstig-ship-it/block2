const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { powerMetrics, buildPowerRanking, savedPowerProfiles, updateSavedPowerProfile } = require('../power-ranking');
const { xpNeedForLevel } = require('../rooms/constants');

const profile = (name, extra = {}) => ({ name, nameSet: true, S: { lvl: 1, xp: 0, str: 1, agi: 1, vit: 1, int: 1 }, gold: 0, ...extra });

test('power XP does not fall at level-up and guild spending does not lower guild level', () => {
  const before = profile('Before', { S: { lvl: 1, xp: xpNeedForLevel(1) } });
  const after = profile('After', { S: { lvl: 2, xp: 0 } });
  assert.equal(powerMetrics(before).xp, powerMetrics(after).xp);
  assert.equal(powerMetrics(after, { renown: 0, totalRenown: 400 }).guild, 3);
  assert.equal(powerMetrics(after).guild, 0);
});

test('balanced strength outranks money alone and every category is bounded', () => {
  const profiles = new Map([
    ['rich', profile('Rich', { gold: 1e9 })],
    ['strong', profile('Strong', { S: { lvl: 21, xp: 12, str: 40, agi: 40, vit: 40, int: 40 }, gold: 100 })],
    ['new', profile('New')],
    ['unnamed', { name: 'Hunter', nameSet: false }],
  ]);
  const guilds = new Map([['g', { name: 'Champions', totalRenown: 900, members: new Set(['strong']) }]]);
  const ranking = buildPowerRanking(profiles, guilds, 'rich');
  assert.equal(ranking.total, 3);
  assert.equal(ranking.leaders[0].name, 'Strong');
  assert.equal(ranking.yours.name, 'Rich');
  for (const row of ranking.leaders) {
    assert.ok(row.score >= 0 && row.score <= 100);
    for (const value of Object.values(row.points)) assert.ok(value >= 0 && value <= 20);
    assert.equal(row.token, undefined, 'account identifiers are private');
  }
});

test('equal profiles share place, no guild earns zero, and empty rankings are safe', () => {
  const result = buildPowerRanking(new Map([['a', profile('A')], ['b', profile('B')]]), new Map(), 'a');
  assert.deepEqual(result.leaders.map(row => row.place), [1, 1]);
  assert.equal(result.yours.points.guild, 0);
  assert.equal(buildPowerRanking(new Map(), new Map()).total, 0);
});

test('saved-profile scans coalesce and callers cannot mutate the cached map', async () => {
  let reads = 0;
  const store = { async loadPowerProfiles() { reads++; return [['offline', profile('Offline')]]; } };
  const [a, b] = await Promise.all([savedPowerProfiles(store), savedPowerProfiles(store)]);
  assert.equal(reads, 1);
  a.delete('offline');
  assert.equal(b.has('offline'), true);
  assert.equal((await savedPowerProfiles(store)).has('offline'), true);
  assert.equal(reads, 1);
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 24 * 60 * 60 * 1000;
    await savedPowerProfiles(store);
    assert.equal(reads, 1, 'elapsed time never triggers another full scan');
  } finally { Date.now = realNow; }
  updateSavedPowerProfile('offline', profile('Offline', { gold: 250 }));
  assert.equal((await savedPowerProfiles(store)).get('offline').gold, 250);
  updateSavedPowerProfile('offline', null);
  assert.equal((await savedPowerProfiles(store)).has('offline'), false);
  assert.equal(reads, 1, 'normal save/delete cache updates cause no additional reads');
});

test('all tied champions are crowned, even beyond the top 20 display limit', () => {
  const profiles = new Map(Array.from({ length: 25 }, (_, i) => ['hunter-' + i, profile('Same name')]));
  const result = buildPowerRanking(profiles, new Map(), 'hunter-24');
  assert.equal(result.leaders.length, 20);
  assert.equal(result.crownTokens.length, 25);
  assert.equal(result.yours.place, 1);
  const room = fs.readFileSync(path.join(__dirname, '../rooms/GameRoom.js'), 'utf8');
  assert.match(room, /const \{ crownTokens, \.\.\.ranking \} = buildPowerRanking/);
  assert.match(room, /winners\.has\(room\.tokens\.get\(member\.sessionId\)\)/);
});

test('crowns follow the correct remote and release their resources when leadership changes', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../client/js/world.mjs'), 'utf8');
  const start = source.indexOf('const powerCrowns=new Map();');
  const end = source.indexOf('function crownMesh(', start);
  const disposed = [], crowns = [];
  const group = () => ({ add(crown) { crown.parent = this; }, position: {} });
  const scene = group(), remote = { grp: group() };
  const NET = { room: { sessionId: 'self' }, remotes: { other: remote } };
  const update = vm.runInNewContext(source.slice(start, end) + '\nupdatePowerCrowns', {
    NET, scene, player: { pos: { x: 1, y: 2, z: 3 } }, performance: { now: () => 0 },
    crownMesh() { const crown = { position: { set(...coords) { this.coords = coords; } }, rotation: {} }; crowns.push(crown); return crown; },
    disposeKingVisual(crown) { disposed.push(crown); crown.parent = null; },
  });
  update(['other']);
  assert.equal(crowns[0].parent, remote.grp);
  assert.equal(crowns[0].position.coords[1], 3.55);
  update(['other']);
  assert.equal(crowns.length, 1, 'updates reuse the crown');
  update(['self']);
  assert.equal(disposed.length, 1);
  assert.equal(crowns[1].parent, scene);
  assert.equal(crowns[1].position.coords[1], 5.55);
  update([]);
  assert.equal(disposed.length, 2, 'disconnect clears the local crown too');
});
