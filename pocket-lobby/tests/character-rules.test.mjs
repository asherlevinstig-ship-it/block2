import test from 'node:test';
import {AWAY_GRACE_MS as G} from '../public/character-rules.js';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';

const initial = activity => ({
  location: 'hub', adventure: {discovered: ['pond']},
  woodcutting: {axeOwned: true, equipped: true, timber: 98},
  characterRules: {enabled: true, activity, keepBait: 7, timberTarget: 100}
});
const character = activity => ({...normalizeState(initial(activity)), routineLastSeen: 0});

test('away work respects grace period, bait reserve, timber target and time cap', () => {
  const fish = character('fishing');
  touchPresence(fish, G-1);
  assert.equal(fish.report, undefined);
  touchPresence(fish, G-1+G+180000, {random: () => 0.5});
  assert.equal(fish.fishingGear.bait, 7);
  assert.equal(fish.report.xp, 30);
  assert.equal(fish.report.reason, 'bait-reserve');
  assert.equal(fish.credits, 100);
  assert.equal(fish.location, 'home');
  const wood = character('woodcutting');
  touchPresence(wood, 86400000);
  assert.equal(wood.woodcutting.timber, 100);
  assert.equal(wood.report.endedAt, G+120000);
  assert.equal(wood.report.reason, 'target-reached');
  const capped = character('woodcutting');
  capped.characterRules.timberTarget = 1000000;
  capped.meals.silverfinFeast = 20;
  touchPresence(capped, 86400000);
  assert.equal(capped.report.timber, 100);
  assert.equal(capped.report.reason, 'action-points');
});

test('missing requirements trigger rest and combat is left untouched', () => {
  const rest = character('fishing');
  rest.adventure.discovered = [];
  touchPresence(rest, 180000);
  assert.equal(rest.report.kind, 'rest');
  assert.match(rest.report.ruleSummary, /Visit Silverfin Pond/);
  assert.equal(rest.location, 'home');
  const recovering = character('woodcutting');
  recovering.hunting.recoveryUntil = 200000;
  touchPresence(recovering, 180000);
  assert.equal(recovering.report, undefined);
  assert.equal(recovering.location, 'hub');
  assert.equal(recovering.activityLog[0].reason, 'combat');
});

test('rules persist and concurrent returns only award one routine', async t => {
  const {db,sql} = testDatabase();
  t.after(() => sql.close());
  const now = Date.now;
  let time = 1000;
  Date.now = () => time;
  t.after(() => { Date.now = now; });
  const origin = 'https://tower.test';
  let cookie;
  async function call(path, body) {
    const headers = {Origin: origin, 'Content-Type': 'application/json'};
    if (cookie) headers.Cookie = cookie;
    const response = await handlePlayerApi(new Request(origin+'/api/player/'+path, {
      headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined
    }), {TOWER_DB: db});
    cookie = response.headers.get('Set-Cookie')?.split(';')[0] ?? cookie;
    return {status: response.status, ...await response.json()};
  }
  const action = (path, revision, body = {}) => call(path, {revision, operation: crypto.randomUUID(), ...body});
  const created = await call('session', {legacy: initial('woodcutting')});
  const saved = await action('rules/save', created.revision, {rules: initial('woodcutting').characterRules});
  assert.equal(saved.status, 200);
  const played = await action('save', saved.revision, {state: {...saved.state, characterRules: {enabled:false}, routineLastSeen: 0, activityLog: ['forged']}});
  assert.equal(played.state.characterRules.enabled, true);
  assert.deepEqual(played.state.activityLog, []);
  time += G+120000;
  const returned = await Promise.all([action('presence', played.revision), action('presence', played.revision)]);
  assert.deepEqual(returned.map(r => r.status).sort(), [200,409]);
  const latest = await call('state');
  assert.equal(latest.state.woodcutting.timber, 100);
  assert.equal(latest.state.activityLog.length, 1);
  time += G+120000;
  const ack = await action('report/ack', latest.revision, {startedAt:latest.state.report.startedAt});
  assert.equal(ack.state.report, undefined);
  const pulse = await action('presence', ack.revision);
  assert.equal(pulse.state.report, undefined);
  assert.equal(pulse.state.activityLog.length, 1);
});
