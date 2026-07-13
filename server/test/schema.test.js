const test = require('node:test');
const assert = require('node:assert/strict');
const { Player, Mob } = require('../schema');

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
