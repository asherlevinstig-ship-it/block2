const test = require('node:test');
const assert = require('node:assert/strict');

const {
  defaultProfile,
  meditationGrowthCapsForLevel,
  sanitizeMeditationGrowth,
  sanitizeProfile,
} = require('../store');

test('meditation growth can expand the stored mana pool', () => {
  const prof = defaultProfile('Meditator');
  prof.S.int = 3;
  prof.meditationGrowth = { completed: 8, next: 15, hp: 0, mp: 4, sp: 0, hunger: 0 };
  prof.vitals = { mp: 999 };
  prof.vitalsSavedAt = Date.now();

  const clean = sanitizeProfile(prof);

  assert.equal(clean.meditationGrowth.mp, 4);
  assert.equal(clean.vitals.mp, 30);
});

test('meditation mana growth is capped by hunter rank', () => {
  const caps = meditationGrowthCapsForLevel(1);
  const clean = sanitizeMeditationGrowth({ completed: 999, next: 3, mp: 999 }, 1);

  assert.equal(caps.mp, 6);
  assert.equal(clean.mp, caps.mp);
  assert.equal(clean.next, 1005);
});
