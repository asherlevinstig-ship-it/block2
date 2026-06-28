const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const clientModule = name => import(pathToFileURL(path.join(__dirname, '..', '..', 'client', 'js', name)).href);

test('reconnect policy retries with bounded exponential delays', async () => {
  const { reconnectWithBackoff } = await clientModule('reconnect.mjs');
  const attempts = [], delays = [];
  const room = await reconnectWithBackoff(async attempt => {
    attempts.push(attempt);
    if (attempt < 3) throw new Error('offline');
    return { id: 'restored' };
  }, { attempts: 4, baseDelay: 10, wait: async ms => delays.push(ms) });
  assert.equal(room.id, 'restored');
  assert.deepEqual(attempts, [1, 2, 3]);
  assert.deepEqual(delays, [10, 20]);
});

test('progression module reconciles authoritative updates and rejection messages', async () => {
  const { bindProgressionMessages } = await clientModule('progression.mjs');
  const handlers = new Map(), events = [];
  const room = { onMessage(type, fn) { handlers.set(type, fn); } };
  let xp = 0, contract = null;
  bindProgressionMessages(room, {
    getJobXp: () => xp, setJobXp: value => { xp = value; },
    setContract: value => { contract = value; }, clampContract: value => value,
    jobLevel: value => value >= 10 ? 2 : 1, contractReady: () => !!contract && contract.have >= contract.need,
    onJobLevel: level => events.push(['level', level]), onContractReady: () => events.push(['ready']),
    reconcileArmor: () => events.push(['armor']), reject: text => events.push(['reject', text]),
    accept: message => events.push(['accept', message.type]), refresh: () => events.push(['refresh']),
  });
  handlers.get('jobProgress')({ jobXp: 10, contract: { have: 1, need: 1 } });
  handlers.get('progressionResult')({ ok: false, type: 'armor', reason: 'unowned' });
  assert.equal(xp, 10);
  assert.deepEqual(events, [['level', 2], ['ready'], ['refresh'], ['armor'], ['reject', 'You do not own that armor']]);
});

test('Hunter XP curve has explicit rank thresholds and steepens at high rank', async () => {
  const progression = await clientModule('progression.mjs');
  const serverProgression = require('../rooms/constants');
  const { hunterActivityXpForLevel, hunterRankIndexForLevel, gateRankIndexForLevel, nextHunterRankLevel, xpNeedForLevel } = progression;
  assert.deepEqual([1, 4, 8, 13, 19, 27].map(hunterRankIndexForLevel), [0, 1, 2, 3, 4, 5]);
  assert.equal(gateRankIndexForLevel(99), 4, 'gate tiers stop at A while Hunter rank reaches S');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(nextHunterRankLevel), [4, 8, 13, 19, 27, 0]);
  assert.equal(xpNeedForLevel(3), 130, 'the polished onboarding still reaches Level 3 on schedule');
  assert.ok(xpNeedForLevel(18) > xpNeedForLevel(7) * 4);
  assert.ok(xpNeedForLevel(26) > xpNeedForLevel(18) * 2);
  for (let level = 1; level <= 40; level++) {
    assert.equal(xpNeedForLevel(level), serverProgression.xpNeedForLevel(level), `client/server XP parity at Level ${level}`);
    assert.equal(hunterRankIndexForLevel(level), serverProgression.hunterRankIndexForLevel(level), `client/server rank parity at Level ${level}`);
    assert.equal(hunterActivityXpForLevel(level, .75), serverProgression.hunterActivityXpForLevel(level, .75), `client/server reward parity at Level ${level}`);
  }
});

test('inventory and equipment models own stacking consumption and profile restore', async () => {
  const { createInventoryModel, createEquipmentModel } = await clientModule('inventory.mjs');
  const slots = new Array(4).fill(null), changes = [];
  const items = { 1: { stack: 10 }, 2: { stack: 1, armor: { mitigation: .2 } }, 3: { stack: 1, tool: { dur: 40 } } };
  let armor = null;
  const inventory = createInventoryModel({ slots, items, size: 4, getEquippedArmor: () => armor, onChange: () => changes.push('inventory') });
  assert.equal(inventory.add(1, 14), 0);
  assert.equal(inventory.count(1), 14);
  assert.equal(inventory.remove(1, 11), true);
  assert.equal(inventory.count(1), 3);
  assert.equal(inventory.add(3, 1), 0);
  assert.equal(slots.find(s => s && s.id === 3).dur, 40);
  const equipment = createEquipmentModel({ items, inventory, getArmor: () => armor, setArmor: value => { armor = value; } });
  assert.deepEqual(equipment.restore({ id: 2, count: 99 }), { id: 2, count: 1 });
  assert.equal(equipment.owns(2), true);
  assert.equal(inventory.add(2, 1), 0, 'equipped armor is not duplicated into inventory');
  assert.equal(inventory.count(2), 0);
  assert.ok(changes.length >= 3);
});

test('quest and job model calculates progress without page globals', async () => {
  const jobs = await clientModule('quests-jobs.mjs');
  assert.equal(jobs.jobLevelFromXp(jobs.jobXpNeed(1)), 2);
  assert.deepEqual(jobs.clampJobContract({ job: 'miner', type: 'mine', need: 2, have: 99, rewardGold: 4, title: 'Stone' }, { miner: {} }).have, 2);
  const model = jobs.createQuestModel({
    countItem: id => id === 5 ? 3 : 0, utilityUnlocked: () => false, utilityUnlocks: () => [],
    familiarUnlocks: () => [], dragonUnlocks: () => [], mounted: () => false, mountKind: () => '', isDragon: () => false,
    escape: value => value, formatTime: () => '1m', utilityName: () => 'Compass', familiarName: () => 'Shade',
  });
  assert.equal(model.done({ type: 'fetch', item: 5, need: 3 }), true);
  assert.equal(model.progressText({ type: 'fetch', item: 5, need: 4 }), '3 / 4');
});

test('rendering runtime owns renderer initialization resize and draw', async () => {
  const { createRenderingRuntime } = await clientModule('rendering.mjs');
  const calls = [], canvas = {};
  class Scene {}
  class Camera { constructor(_fov, aspect) { this.aspect = aspect; } updateProjectionMatrix() { calls.push('projection'); } }
  class Renderer {
    constructor() { this.domElement = canvas; }
    setSize(w, h) { calls.push(['size', w, h]); }
    setPixelRatio(value) { calls.push(['ratio', value]); }
    render(scene, camera) { calls.push(['render', scene, camera]); }
  }
  const mount = { appendChild(value) { calls.push(['mount', value]); } };
  const runtime = createRenderingRuntime({ THREE: { Scene, PerspectiveCamera: Camera, WebGLRenderer: Renderer }, mount, width: 800, height: 400, pixelRatio: 3 });
  runtime.resize(600, 300);
  runtime.render();
  assert.equal(runtime.camera.aspect, 2);
  assert.deepEqual(calls.slice(0, 3), [['size', 800, 400], ['ratio', 2], ['mount', canvas]]);
  assert.equal(calls.at(-1)[0], 'render');
});

test('network controller joins stores resume token and reattaches after disconnect', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  const storage = new Map(), attached = [], events = [];
  const makeRoom = token => ({ reconnectionToken: token, onLeave(fn) { this.leaveHandler = fn; } });
  const first = makeRoom('room:first'), second = makeRoom('room:second');
  class Client {
    async joinOrCreate(name, options) { events.push(['join', name, options.name]); return first; }
    async reconnect(token) { events.push(['reconnect', token]); return second; }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    sessionStorage: { getItem: key => storage.get(key) || '', setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    onAttach: room => attached.push(room), onUnavailable() {}, onInterrupted: () => events.push(['interrupted']),
    onReconnectAttempt() {}, onRestored: () => events.push(['restored']), onFailure: error => { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, first);
  assert.equal(storage.get('resume'), 'room:first');
  first.leaveHandler();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.state.room, second);
  assert.equal(controller.state.attachCount, 2);
  assert.deepEqual(attached, [first, second]);
});

test('network controller shutdown leaves deliberately without starting reconnect teardown', async () => {
  const { createNetworkController } = await clientModule('network.mjs');
  let reconnects = 0, leaves = 0;
  const room = {
    reconnectionToken: 'room:first',
    onLeave(fn) { this.leaveHandler = fn; },
    async leave() { leaves++; this.leaveHandler(); },
  };
  class Client {
    async joinOrCreate() { return room; }
    async reconnect() { reconnects++; throw new Error('shutdown must not reconnect'); }
  }
  const controller = createNetworkController({
    Client, endpoint: () => 'ws://test', roomName: 'blockcraft', tokenKey: 'resume',
    sessionStorage: { getItem: () => '', setItem() {}, removeItem() {} },
    onAttach() {}, onUnavailable() {}, onInterrupted() {}, onReconnectAttempt() {}, onRestored() {},
    onFailure: error => { throw error; },
  });
  controller.connect('Hunter');
  await new Promise(resolve => setTimeout(resolve, 0));
  await controller.shutdown();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(leaves, 1);
  assert.equal(reconnects, 0);
  assert.equal(controller.state.room, null);
  assert.equal(controller.state.on, false);
});
