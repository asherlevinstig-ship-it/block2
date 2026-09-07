const test = require('node:test');
const assert = require('node:assert/strict');
const { Encoder, Reflection, StateView } = require('@colyseus/schema');
const { State, Player, Mob } = require('../schema');

test('deployed browser bundle decodes full state and filtered entity churn through the server serializer', () => {
  const vm = require('node:vm');
  const { SchemaSerializer } = require('@colyseus/core');
  const { browserSdkBundle } = require('../browser-sdk');
  const errors = [];
  const context = vm.createContext({ console: { ...console, error: (...args) => errors.push(args.join(' ')), warn: (...args) => errors.push(args.join(' ')) }, setTimeout, clearTimeout, TextEncoder, TextDecoder, URL, URLSearchParams });
  vm.runInContext(browserSdkBundle(), context);
  const serializer = new SchemaSerializer();
  const state = new State();
  serializer.reset(state);
  const clients = [0, 1].map(() => {
    const decoder = new context.Colyseus.SchemaSerializer();
    decoder.handshake(serializer.handshake());
    return { view: new StateView(), state: 1, decoder, raw: bytes => decoder.patch(bytes, { offset: 1 }) };
  });
  const player = new Player();state.players.set('self', player);
  for (const client of clients) {
    client.view.add(player);
    client.decoder.setState(serializer.getFullState(client), { offset: 1 });
  }
  serializer.applyPatches(clients);
  for (let i = 0; i < 30; i++) {
    const mob = new Mob();mob.x = i;state.mobs.set('moving', mob);
    for (const client of clients)client.view.add(mob);
    serializer.applyPatches(clients);
    for (const client of clients)assert.equal(client.decoder.state.mobs.get('moving').x, i);
    // Include exit/re-entry in one patch, then a deletion from shared state.
    clients[0].view.remove(mob);clients[0].view.add(mob);
    serializer.applyPatches(clients);
    state.mobs.delete('moving');
    for (const client of clients)client.view.remove(mob);
    serializer.applyPatches(clients);
    for (const client of clients)assert.equal(client.decoder.state.mobs.size, 0);
  }
  assert.deepEqual(errors, []);
});

function schemaTypes(klass) {
  const metadata = klass[Symbol.metadata] || {};
  const byName = {};
  for (const field of Object.values(metadata)) {
    if (field && field.name) byName[field.name] = field.type;
  }
  return byName;
}

test('hot replicated entity numeric fields use compact float32 encoding', () => {
  const player = schemaTypes(Player);
  for (const field of ['x', 'y', 'z', 'yaw']) assert.equal(player[field], 'float32', 'Player.' + field);

  const mob = schemaTypes(Mob);
  for (const field of ['x', 'y', 'z', 'yaw', 'hp', 'maxHp']) assert.equal(mob[field], 'float32', 'Mob.' + field);
});

test('large filtered player patches decode for every client view', () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));
  const state = new State();
  const encoder = new Encoder(state);
  const firstView = new StateView();
  const secondView = new StateView();
  const firstDecoder = Reflection.decode(Reflection.encode(encoder));
  const secondDecoder = Reflection.decode(Reflection.encode(encoder));

  for (let i = 0; i < 400; i++) {
    const player = new Player();
    player.name = 'Replication Hunter ' + i;
    player.schoolId = 'SCHEMA-STRESS-' + i;
    player.path = i % 2 ? 'guardian' : 'mage';
    player.job = i % 3 ? 'miner' : 'farmer';
    state.players.set('player-' + i, player);
    firstView.add(player);
    secondView.add(player);
  }

  try {
    const it = { offset: 0 };
    encoder.encode(it);
    const sharedOffset = it.offset;
    firstDecoder.decode(encoder.encodeView(firstView, sharedOffset, it));
    secondDecoder.decode(encoder.encodeView(secondView, sharedOffset, it));
    encoder.discardChanges();
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(warnings.some(message => message.includes('buffer overflow')), 'test must exercise filtered-buffer growth');
  assert.equal(firstDecoder.state.players.size, 400);
  assert.equal(secondDecoder.state.players.size, 400);
  assert.equal(secondDecoder.state.players.get('player-399').name, 'Replication Hunter 399');
  assert.equal(secondDecoder.state.players.get('player-399').path, 'guardian');
  assert.equal(secondDecoder.state.players.get('player-399').job, 'farmer');
});
