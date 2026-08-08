// Knowledge Challenge — adaptive practice engine (pure logic).
//
// This module is deliberately storage-free: it operates on plain atom-state
// objects that the MySQL layer (kc_student_atom rows) maps to and from. Keeping
// it pure makes the selector and the fluency stage machine unit-testable without
// a database. See docs/KNOWLEDGE_CHALLENGE_DB.md.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftKnowledgeChallenge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Fluency ladder — index is the stage number stored in kc_student_atom.stage.
  const STAGES = Object.freeze(['learn', 'retrieve', 'discriminate', 'apply', 'explain', 'maintain']);
  // The eight challenge formats. Index is the bit used in formatsSeen.
  const FORMATS = Object.freeze([
    'multiple_choice', 'classify', 'approve_reject', 'replace',
    'compare', 'repair_diagram', 'predict_consequence', 'construct_justification',
  ]);
  // Adaptive selector budget (§7 of the design doc).
  const SELECTOR_WEIGHTS = Object.freeze({
    weakness: 0.35, retrieval: 0.25, confusion: 0.20, maintenance: 0.15, near_transfer: 0.05,
  });
  const REVIEW_INTERVALS_MS = Object.freeze([
    10 * 60 * 1000, 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000, 14 * 24 * 60 * 60 * 1000, 30 * 24 * 60 * 60 * 1000,
  ]);
  const RETRY_INTERVAL_MS = 2 * 60 * 1000;
  // Reaching Maintain requires the atom to have been met in several formats.
  const MAINTAIN_MIN_FORMATS = 3;

  // Shift catalogue: how many cases each paid run serves (0 = endless) and its
  // default gold stake. Entry costs are policy — a room may override them.
  const SHIFT_TYPES = Object.freeze({
    quick: { cases: 10, entry: 20 },
    standard: { cases: 20, entry: 40 },
    full: { cases: 30, entry: 60 },
    timed: { cases: 20, entry: 40 },
    endless: { cases: 0, entry: 25 },
  });
  // Payout policy (mild sink that always rewards learning; see design doc §11).
  const DEFAULT_PAYOUT = Object.freeze({
    base: 0.5, performanceScale: 1.2, wFirst: 0.6, wIndependent: 0.4,
    streakBonusPer: 0.02, streakBonusMax: 0.2,
    goldPerStageAdvanced: 5, goldPerMaintain: 15,
  });

  function clampInt(value, min, max) {
    const n = Math.floor(Number(value) || 0);
    return Math.max(min, Math.min(max, n));
  }
  function formatBit(format) {
    const i = FORMATS.indexOf(format);
    return i >= 0 ? (1 << i) : 0;
  }
  function formatsCount(mask) {
    let n = 0, m = mask | 0;
    while (m) { n += m & 1; m >>>= 1; }
    return n;
  }

  function cleanAtomState(raw) {
    const s = raw || {};
    return {
      stage: clampInt(s.stage, 0, STAGES.length - 1),
      attempts: Math.max(0, s.attempts | 0),
      correct: Math.max(0, s.correct | 0),
      firstAttemptCorrect: Math.max(0, s.firstAttemptCorrect | 0),
      streak: Math.max(0, s.streak | 0),
      ease: clampInt(s.ease == null ? 250 : s.ease, 150, 400),
      intervalIdx: clampInt(s.intervalIdx, 0, REVIEW_INTERVALS_MS.length - 1),
      nextDue: s.nextDue == null ? null : Math.max(0, Number(s.nextDue) || 0),
      formatsSeen: Math.max(0, s.formatsSeen | 0),
      discriminated: s.discriminated === true,
      nearTransferOk: s.nearTransferOk === true,
      explained: s.explained === true,
      delayedSuccess: s.delayedSuccess === true,
      lastShiftId: s.lastShiftId == null ? null : (Number(s.lastShiftId) || 0),
      sessionsSeen: Math.max(0, s.sessionsSeen | 0),
      lastSeenAt: Math.max(0, Number(s.lastSeenAt) || 0),
    };
  }

  // Highest stage the accumulated evidence supports. Each level gates the next,
  // so a student cannot skip (e.g. Apply needs Discriminate already earned).
  function evidenceStage(s) {
    let stage = 0;
    if (s.firstAttemptCorrect > 0) stage = 1;                                   // Retrieve
    if (stage >= 1 && s.discriminated) stage = 2;                               // Discriminate
    if (stage >= 2 && s.nearTransferOk) stage = 3;                              // Apply
    if (stage >= 3 && s.explained) stage = 4;                                   // Explain
    if (stage >= 4 && s.delayedSuccess && formatsCount(s.formatsSeen) >= MAINTAIN_MIN_FORMATS) stage = 5; // Maintain
    return stage;
  }

  // Apply one completed case to an atom's fluency record.
  //
  // event = {
  //   correct,               final correctness (after any remediation)
  //   firstAttemptCorrect,   answered right on the first look, independently — the fluency signal
  //   independent,           no handbook/hint (default true)
  //   format,                one of FORMATS
  //   discriminated,         this case was a confusion/compare discriminator
  //   nearTransfer,          this case was a changed context/entity
  //   explained,             a passed construct_justification
  //   shiftId,               current shift id (for the later-session boundary)
  // }
  function reviewAtom(state, event, now) {
    now = now || Date.now();
    const s = cleanAtomState(state);
    const e = event || {};
    const correct = !!e.correct;
    const independent = e.independent !== false;
    const firstAttempt = !!e.firstAttemptCorrect && correct && independent;
    const shiftId = e.shiftId == null ? null : (Number(e.shiftId) || 0);
    const out = Object.assign({}, s);

    out.attempts = s.attempts + 1;
    if (correct) out.correct = s.correct + 1;
    out.streak = correct ? s.streak + 1 : 0;
    out.formatsSeen = s.formatsSeen | formatBit(e.format);
    if (shiftId != null && shiftId !== s.lastShiftId) out.sessionsSeen = s.sessionsSeen + 1;
    if (firstAttempt) out.firstAttemptCorrect = s.firstAttemptCorrect + 1;

    // Evidence flags: a correct discriminator/near-transfer/explanation earns the
    // dimension; failing that same kind of case revokes it (mastery stays honest).
    if (e.discriminated) out.discriminated = correct ? true : false;
    if (e.nearTransfer) out.nearTransferOk = correct ? true : false;
    if (e.explained) out.explained = correct ? true : false;
    // Delayed retrieval only counts when the atom was last seen in an *earlier* shift.
    if (correct && shiftId != null && s.lastShiftId != null && shiftId !== s.lastShiftId) out.delayedSuccess = true;
    if (shiftId != null) out.lastShiftId = shiftId;
    out.lastSeenAt = now;

    // Spaced-repetition scheduling (on final correctness).
    if (correct) {
      out.intervalIdx = Math.min(REVIEW_INTERVALS_MS.length - 1, s.intervalIdx + 1);
      out.ease = Math.min(400, s.ease + 15);
    } else {
      out.intervalIdx = 0;
      out.ease = Math.max(150, s.ease - 25);
    }
    out.nextDue = now + (correct ? REVIEW_INTERVALS_MS[out.intervalIdx] : RETRY_INTERVAL_MS);

    // Stage machine: advance at most one level per success (only as far as the
    // evidence allows); a miss regresses to Retrieve (or Learn), never below.
    const ev = evidenceStage(out);
    let stage;
    if (correct) stage = Math.min(ev, s.stage + 1);
    else stage = Math.min(s.stage, out.firstAttemptCorrect > 0 ? 1 : 0);
    out.stage = clampInt(stage, 0, STAGES.length - 1);

    return {
      state: out,
      advanced: out.stage > s.stage,
      regressed: out.stage < s.stage,
      reachedMaintain: out.stage === 5 && s.stage < 5,
    };
  }

  function atomState(a) { return (a && a.state) || {}; }
  function firstAttemptRate(a) {
    const s = atomState(a);
    const attempts = s.attempts | 0;
    return attempts ? (s.firstAttemptCorrect | 0) / attempts : 0;
  }

  // Atoms that sit inside a confusion pair and are not yet securely discriminated.
  function confusionCandidates(atoms, pairs) {
    const byId = new Map(atoms.map(a => [a.atomId, a]));
    const out = [];
    for (const pair of pairs || []) {
      for (const id of [pair && pair.atomAId, pair && pair.atomBId]) {
        const a = byId.get(id);
        if (a && (atomState(a).stage | 0) <= 2 && !out.includes(a)) out.push(a);
      }
    }
    return out;
  }

  // Weight-biased bucket order: the first bucket is chosen by the random roll
  // against the budget; the rest follow in descending weight as fallbacks so a
  // selection is always produced even when a bucket is empty.
  function weightedOrder(weights, random) {
    const names = Object.keys(weights);
    const total = names.reduce((sum, n) => sum + Math.max(0, weights[n]), 0) || 1;
    let r = random() * total, primary = names[0];
    for (const n of names) { r -= Math.max(0, weights[n]); if (r <= 0) { primary = n; break; } }
    const rest = names.filter(n => n !== primary).sort((a, b) => weights[b] - weights[a]);
    return [primary].concat(rest);
  }

  // Pick the next atom to practise.
  //
  // input = {
  //   atoms: [{ atomId, difficulty, entityId, state }],   student-merged content
  //   confusionPairs: [{ atomAId, atomBId }],
  //   remediation: [{ atomId, dueNow }],                  scheduled recovery items
  //   avoidAtomId,                                        the atom just served
  //   weights, now,
  // }
  // Returns { atomId, reason } or null when there are no atoms.
  function selectNextAtom(input, random) {
    random = random || Math.random;
    const atoms = Array.isArray(input && input.atoms) ? input.atoms : [];
    if (!atoms.length) return null;
    const now = (input && input.now) || Date.now();
    const avoid = input && input.avoidAtomId != null ? input.avoidAtomId : null;
    const weights = Object.assign({}, SELECTOR_WEIGHTS, (input && input.weights) || {});
    const byId = new Set(atoms.map(a => a.atomId));

    // Scheduled remediation always fires before the budget (§9).
    const due = (input && input.remediation || []).filter(r => r && r.dueNow && byId.has(r.atomId));
    if (due.length) return { atomId: due[Math.floor(random() * due.length)].atomId, reason: 'remediation' };

    const buckets = {
      weakness: atoms.filter(a => (atomState(a).stage | 0) <= 1 || firstAttemptRate(a) < 0.6),
      retrieval: atoms.filter(a => atomState(a).nextDue != null && atomState(a).nextDue <= now),
      confusion: confusionCandidates(atoms, input && input.confusionPairs),
      maintenance: atoms.filter(a => (atomState(a).stage | 0) >= 4),
      near_transfer: atoms.filter(a => (a.difficulty | 0) >= 3 && atomState(a).nearTransferOk !== true),
    };

    for (const name of weightedOrder(weights, random)) {
      let cands = buckets[name] || [];
      if (avoid != null) { const f = cands.filter(a => a.atomId !== avoid); if (f.length) cands = f; }
      if (cands.length) return { atomId: cands[Math.floor(random() * cands.length)].atomId, reason: name };
    }

    // Ultimate fallback: least-secure, least-recently-seen atom.
    let pool = atoms.slice();
    if (avoid != null) { const f = pool.filter(a => a.atomId !== avoid); if (f.length) pool = f; }
    pool.sort((a, b) => (atomState(a).stage | 0) - (atomState(b).stage | 0)
      || (atomState(a).lastSeenAt | 0) - (atomState(b).lastSeenAt | 0));
    return { atomId: pool[0].atomId, reason: 'fallback' };
  }

  function clamp01(n) { return Math.max(0, Math.min(1, Number(n) || 0)); }

  // Gold payout for a finished shift: a performance return on the stake plus a
  // flat mastery bonus, so genuine learning always pays even on a mediocre run.
  //   performance = entry × (base + scale × (wFirst·firstRate + wInd·indepRate) + streakBonus)
  //   masteryBonus = goldPerStageAdvanced × stagesAdvanced + goldPerMaintain × atomsMaintained
  function computeShiftPayout(entryCostGold, totals, coeffs) {
    const c = Object.assign({}, DEFAULT_PAYOUT, coeffs || {});
    const t = totals || {};
    const entry = Math.max(0, entryCostGold | 0);
    const completed = Math.max(0, t.completedCases | 0);
    if (completed <= 0) return { payout: 0, performance: 0, masteryBonus: 0, returnRate: 0 };
    const firstRate = clamp01((t.firstAttemptCorrect | 0) / completed);
    const indepRate = clamp01((t.independentCorrect | 0) / completed);
    const streakBonus = Math.min(c.streakBonusMax, Math.max(0, t.bestStreak | 0) * c.streakBonusPer);
    const returnRate = c.base + c.performanceScale * (c.wFirst * firstRate + c.wIndependent * indepRate) + streakBonus;
    const performance = Math.round(entry * returnRate);
    const masteryBonus = c.goldPerStageAdvanced * Math.max(0, t.stagesAdvanced | 0)
      + c.goldPerMaintain * Math.max(0, t.atomsMaintained | 0);
    return { payout: performance + masteryBonus, performance, masteryBonus, returnRate };
  }

  // Roll-up for the end-of-shift report / mastery bar.
  function masteryOverview(atoms, now) {
    now = now || Date.now();
    const byStage = STAGES.map(() => 0);
    let seen = 0, due = 0, maintained = 0;
    for (const a of atoms || []) {
      const s = cleanAtomState(atomState(a));
      seen++;
      byStage[s.stage]++;
      if (s.stage >= 5) maintained++;
      if (s.nextDue != null && s.nextDue <= now) due++;
    }
    return { total: (atoms || []).length, seen, due, maintained, byStage };
  }

  return Object.freeze({
    STAGES, FORMATS, SELECTOR_WEIGHTS, REVIEW_INTERVALS_MS, RETRY_INTERVAL_MS, MAINTAIN_MIN_FORMATS,
    SHIFT_TYPES, DEFAULT_PAYOUT,
    formatBit, formatsCount, cleanAtomState, evidenceStage, reviewAtom,
    selectNextAtom, masteryOverview, weightedOrder, firstAttemptRate, computeShiftPayout,
  });
});
