// Server adapter for the runtime-neutral dungeon generation rules.
const W = require('./world');
const { createDungeonGeneration } = require('../shared/dungeon-generation');

module.exports = createDungeonGeneration({
  B: W.B,
  hash2: W.hash2,
});
