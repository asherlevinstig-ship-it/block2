// Diagnostic copy: dismiss the visible dungeon result panel after loot.
// The original regression test and game code are unchanged.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const original = path.resolve(__dirname, '../../e2e/c-rank-specialization.spec.js');
const source = fs.readFileSync(original, 'utf8').replaceAll(
  'await dismissGateLoot(page);',
  'await dismissGateLoot(page); await dismissRankUp(page);',
);
const copied = new Module(original, module);
copied.filename = original;
copied.paths = Module._nodeModulePaths(path.dirname(original));
copied._compile(source, original);
