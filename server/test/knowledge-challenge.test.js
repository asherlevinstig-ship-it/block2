'use strict';
const test = require('node:test');
const assert = require('node:assert');
const K = require('../../shared/knowledge-challenge');

const T = 1_000_000_000_000; // fixed "now"

test('fluency stage machine climbs Learn -> Maintain only with the right evidence', () => {
  // 1. Independent first-attempt success -> Retrieve.
  let r = K.reviewAtom(null, { correct: true, firstAttemptCorrect: true, format: 'multiple_choice', shiftId: 1 }, T);
  assert.equal(r.state.stage, 1, 'retrieve');
  assert.equal(r.advanced, true);
  // 2. Wins a close comparison -> Discriminate.
  r = K.reviewAtom(r.state, { correct: true, discriminated: true, format: 'compare', shiftId: 1 }, T);
  assert.equal(r.state.stage, 2, 'discriminate');
  // 3. Correct in a changed context -> Apply.
  r = K.reviewAtom(r.state, { correct: true, nearTransfer: true, format: 'classify', shiftId: 1 }, T);
  assert.equal(r.state.stage, 3, 'apply');
  // 4. Constructs a justification -> Explain.
  r = K.reviewAtom(r.state, { correct: true, explained: true, format: 'construct_justification', shiftId: 1 }, T);
  assert.equal(r.state.stage, 4, 'explain');
  // 5. Retrieved again in a LATER shift, across >=3 formats -> Maintain.
  r = K.reviewAtom(r.state, { correct: true, format: 'predict_consequence', shiftId: 2 }, T);
  assert.equal(r.state.stage, 5, 'maintain');
  assert.equal(r.reachedMaintain, true);
  assert.ok(K.formatsCount(r.state.formatsSeen) >= K.MAINTAIN_MIN_FORMATS);
});

test('a single success advances at most one stage', () => {
  // Fresh atom that somehow carries later-stage flags cannot jump straight to Apply.
  const primed = { stage: 0, firstAttemptCorrect: 1, discriminated: true, nearTransferOk: true };
  const r = K.reviewAtom(primed, { correct: true, format: 'classify', shiftId: 1 }, T);
  assert.equal(r.state.stage, 1);
});

test('cannot reach Maintain in the same shift it was last seen', () => {
  const atExplain = {
    stage: 4, firstAttemptCorrect: 3, discriminated: true, nearTransferOk: true, explained: true,
    formatsSeen: 0b1111, lastShiftId: 7,
  };
  const sameShift = K.reviewAtom(atExplain, { correct: true, format: 'compare', shiftId: 7 }, T);
  assert.equal(sameShift.state.delayedSuccess, false);
  assert.equal(sameShift.state.stage, 4, 'no delayed retrieval -> stays at Explain');
  const laterShift = K.reviewAtom(atExplain, { correct: true, format: 'compare', shiftId: 8 }, T);
  assert.equal(laterShift.state.delayedSuccess, true);
  assert.equal(laterShift.state.stage, 5);
});

test('correction is not mastery: an eventually-correct case does not earn Retrieve', () => {
  const r = K.reviewAtom(null, { correct: true, firstAttemptCorrect: false, independent: false, format: 'multiple_choice', shiftId: 1 }, T);
  assert.equal(r.state.firstAttemptCorrect, 0);
  assert.equal(r.state.correct, 1, 'still counts as answered');
  assert.equal(r.state.stage, 0, 'but no fluency credit');
});

test('a miss regresses to Retrieve, resets the streak, and reschedules soon', () => {
  const secure = { stage: 5, firstAttemptCorrect: 6, streak: 6, discriminated: true, nearTransferOk: true, explained: true, delayedSuccess: true, formatsSeen: 0b1111, lastShiftId: 3 };
  const r = K.reviewAtom(secure, { correct: false, format: 'multiple_choice', shiftId: 4 }, T);
  assert.equal(r.state.stage, 1, 'drops to Retrieve, not below');
  assert.equal(r.regressed, true);
  assert.equal(r.state.streak, 0);
  assert.equal(r.state.nextDue, T + K.RETRY_INTERVAL_MS);
});

test('failing a discriminator revokes that dimension', () => {
  const s = { stage: 2, firstAttemptCorrect: 2, discriminated: true };
  const r = K.reviewAtom(s, { correct: false, discriminated: true, format: 'compare', shiftId: 1 }, T);
  assert.equal(r.state.discriminated, false);
});

test('scheduling advances the interval ladder on success', () => {
  const first = K.reviewAtom(null, { correct: true, firstAttemptCorrect: true, format: 'multiple_choice', shiftId: 1 }, T);
  assert.equal(first.state.intervalIdx, 1);
  assert.equal(first.state.nextDue, T + K.REVIEW_INTERVALS_MS[1]);
  const second = K.reviewAtom(first.state, { correct: true, format: 'multiple_choice', shiftId: 1 }, T);
  assert.equal(second.state.intervalIdx, 2);
});

test('formatsSeen is a bitmask over the eight formats', () => {
  let s = K.reviewAtom(null, { correct: true, format: 'multiple_choice', shiftId: 1 }, T).state;
  s = K.reviewAtom(s, { correct: true, format: 'compare', shiftId: 1 }, T).state;
  s = K.reviewAtom(s, { correct: true, format: 'compare', shiftId: 1 }, T).state; // duplicate format
  assert.equal(K.formatsCount(s.formatsSeen), 2);
});

// ---- selector ----

function atom(id, over) { return Object.assign({ atomId: id, difficulty: 1, entityId: 1, state: {} }, over); }

test('selector serves scheduled remediation before any budget bucket', () => {
  const out = K.selectNextAtom({
    atoms: [atom(1, { state: { stage: 0 } }), atom(2, { state: { stage: 0 } })],
    remediation: [{ atomId: 2, dueNow: true }],
    now: T,
  }, () => 0);
  assert.deepEqual(out, { atomId: 2, reason: 'remediation' });
});

test('selector picks the weakness bucket on a low roll', () => {
  const out = K.selectNextAtom({
    atoms: [atom(1, { state: { stage: 0 } }), atom(9, { state: { stage: 5, attempts: 5, firstAttemptCorrect: 5 } })],
    now: T,
  }, () => 0); // roll 0 -> primary bucket = weakness
  assert.equal(out.reason, 'weakness');
  assert.equal(out.atomId, 1);
});

test('selector falls back by descending weight when the primary bucket is empty', () => {
  // Nothing weak; one atom is due for retrieval. Roll 0 targets weakness (empty)
  // so the fallback order reaches retrieval next.
  const secure = { stage: 3, attempts: 5, firstAttemptCorrect: 5 };
  const out = K.selectNextAtom({
    atoms: [
      atom(1, { state: Object.assign({}, secure) }),
      atom(2, { state: Object.assign({ nextDue: T - 1 }, secure) }),
    ],
    now: T,
  }, () => 0);
  assert.equal(out.reason, 'retrieval');
  assert.equal(out.atomId, 2);
});

test('selector avoids repeating the last atom when an alternative exists', () => {
  const out = K.selectNextAtom({
    atoms: [atom(1, { state: { stage: 0 } }), atom(2, { state: { stage: 0 } })],
    avoidAtomId: 1,
    now: T,
  }, () => 0);
  assert.equal(out.atomId, 2);
});

test('selector returns null with no atoms', () => {
  assert.equal(K.selectNextAtom({ atoms: [] }, () => 0), null);
});

test('weightedOrder maps the roll onto the budget', () => {
  assert.equal(K.weightedOrder(K.SELECTOR_WEIGHTS, () => 0)[0], 'weakness');
  assert.equal(K.weightedOrder(K.SELECTOR_WEIGHTS, () => 0.999)[0], 'near_transfer');
});

// ---- payout ----

test('computeShiftPayout pays a performance return plus a flat mastery bonus', () => {
  // Perfect quick run (entry 20): returnRate = 0.5 + 1.2*(0.6*1 + 0.4*1) + streakBonus.
  const perfect = K.computeShiftPayout(20, {
    completedCases: 10, firstAttemptCorrect: 10, independentCorrect: 10,
    bestStreak: 10, stagesAdvanced: 2, atomsMaintained: 1,
  });
  // returnRate = 0.5 + 1.2 + min(0.2, 10*0.02)=0.2 => 1.9 ; performance = round(20*1.9)=38
  assert.equal(perfect.performance, 38);
  assert.equal(perfect.masteryBonus, 2 * 5 + 1 * 15);
  assert.equal(perfect.payout, 38 + 25);
});

test('computeShiftPayout: a weak run loses the stake but learning still pays', () => {
  const weak = K.computeShiftPayout(40, {
    completedCases: 20, firstAttemptCorrect: 4, independentCorrect: 4,
    bestStreak: 1, stagesAdvanced: 1, atomsMaintained: 0,
  });
  // firstRate=indepRate=0.2 => returnRate = 0.5 + 1.2*0.2 + 0.02 = 0.762 ; perf=round(40*0.762)=30
  assert.ok(weak.performance < 40, 'performance return is below the stake');
  assert.equal(weak.masteryBonus, 5, 'a stage advance still pays');
});

test('computeShiftPayout is zero for a shift with no completed cases', () => {
  assert.deepEqual(K.computeShiftPayout(20, { completedCases: 0 }), { payout: 0, performance: 0, masteryBonus: 0, returnRate: 0 });
});

test('SHIFT_TYPES lists the five paid runs with entry stakes', () => {
  assert.deepEqual(Object.keys(K.SHIFT_TYPES), ['quick', 'standard', 'full', 'timed', 'endless']);
  assert.equal(K.SHIFT_TYPES.endless.cases, 0);
  assert.equal(K.SHIFT_TYPES.quick.entry, 20);
});

test('masteryOverview rolls up stages, due and maintained counts', () => {
  const o = K.masteryOverview([
    atom(1, { state: { stage: 0 } }),
    atom(2, { state: { stage: 5 } }),
    atom(3, { state: { stage: 2, nextDue: T - 1 } }),
  ], T);
  assert.equal(o.total, 3);
  assert.equal(o.maintained, 1);
  assert.equal(o.due, 1);
  assert.equal(o.byStage[0], 1);
  assert.equal(o.byStage[5], 1);
});
