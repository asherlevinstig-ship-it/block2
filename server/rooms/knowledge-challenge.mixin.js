const KC = require('../../shared/knowledge-challenge');
const { getAuthService } = require('../auth');

// Entry stakes and payout coefficients (policy — see docs/KNOWLEDGE_CHALLENGE_DB.md §11).
// Overridable per-room via this._kcConfig for tests / tuning.
const KC_CONFIG = Object.freeze({
  entry: Object.freeze({ quick: 20, standard: 40, full: 60, timed: 40, endless: 25 }),
  payout: Object.freeze({}), // {} = KC.DEFAULT_PAYOUT
  maxGold: 1e9,
});

function freshTotals() {
  return {
    completedCases: 0, firstAttemptCorrect: 0, independentCorrect: 0, nearTransferCorrect: 0,
    recoveryCases: 0, handbookUses: 0, bestStreak: 0, streak: 0, stagesAdvanced: 0,
    atomsMaintained: 0, responseMsSum: 0,
  };
}

function safeKcValue(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch (_) { return v == null ? null : String(v); }
}

class KnowledgeChallengeMixin {
  initKnowledgeChallengeState() {
    this.kcShifts = new Map(); // sessionId -> shift state
  }
  kcConfig() { return this._kcConfig || KC_CONFIG; }
  kcAccountFor(client) { return (client && client._account) || null; }
  kcStore() {
    try {
      const auth = getAuthService();
      if (!auth) return null;
      const store = typeof auth.getGameQuestionStore === 'function' ? auth.getGameQuestionStore() : null;
      return store && typeof store.loadStudentAtoms === 'function' ? store : null;
    } catch (_) { return null; }
  }
  kcSyncGold(client, prof) {
    if (typeof this.syncPlayerProfile === 'function') this.syncPlayerProfile(client, prof);
    else if (typeof this.sendProfile === 'function') this.sendProfile(client, prof);
  }
  kcTrace(client, event, data = {}) {
    const payload = Object.assign({ event, at: Date.now() }, safeKcValue(data) || {});
    try { if (client && typeof client.send === 'function') client.send('kcTrace', payload); } catch (_) {}
    try { console.log('[kc-trace] ' + JSON.stringify(payload)); } catch (_) { console.log('[kc-trace] ' + event); }
  }

  // Present a challenge to the client, shuffling multiple-choice answers so the
  // correct index is not positionally predictable. The authoritative correct
  // index is kept server-side in shift.pending.
  kcChallengeView(challenge) {
    const answers = Array.isArray(challenge.answers) ? challenge.answers.slice() : [];
    if (answers.length < 2) return { answers, correctIndex: challenge.correctIndex | 0 };
    const order = answers.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    return { answers: order.map(i => answers[i]), correctIndex: order.indexOf(challenge.correctIndex | 0) };
  }

  kcShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Turn a stored challenge into the served case + its grading spec. The five
  // single-choice formats ride the index protocol (kcChallengeView). The two
  // assembly formats carry a payload the client renders and a server-side grade.
  kcBuildCase(challenge) {
    const fmt = challenge.format, payload = challenge.payload;
    if (fmt === 'construct_justification' && payload && Array.isArray(payload.bank)) {
      const bank = payload.bank.map(b => ({ text: String((b && b.text) || ''), correct: !!(b && b.correct) }));
      this.kcShuffle(bank);
      const correctSet = bank.map((b, i) => (b.correct ? i : -1)).filter(i => i >= 0);
      return {
        answers: [], correctIndex: -1, grade: { kind: 'construct', correctSet },
        payload: { kind: 'construct_justification', instruction: String(payload.prompt || 'Select the parts that make a complete justification.'), bank: bank.map(b => b.text) },
      };
    }
    if (fmt === 'repair_diagram' && payload && Array.isArray(payload.pool) && Array.isArray(payload.solution)) {
      const pool = payload.pool.map((p, i) => ({ text: String(p || ''), i }));
      this.kcShuffle(pool);
      const remap = new Map(pool.map((p, newIdx) => [p.i, newIdx]));
      const solution = payload.solution.map(oldIdx => (remap.has(oldIdx) ? remap.get(oldIdx) : -1));
      return {
        answers: [], correctIndex: -1, grade: { kind: 'repair', solution },
        payload: { kind: 'repair_diagram', instruction: String(payload.prompt || 'Arrange the pieces into a valid flow.'), pool: pool.map(p => p.text), slots: payload.solution.length },
      };
    }
    const view = this.kcChallengeView(challenge);
    return { answers: view.answers, correctIndex: view.correctIndex, grade: null, payload: challenge.payload || null };
  }

  // Grade a submitted answer against the pending case's format.
  kcGrade(pending, m) {
    const g = pending && pending.grade;
    if (g && g.kind === 'construct') {
      const want = new Set(g.correctSet);
      const got = new Set((Array.isArray(m.selected) ? m.selected : []).map(n => n | 0).filter(n => n >= 0));
      return want.size > 0 && want.size === got.size && Array.from(want).every(i => got.has(i));
    }
    if (g && g.kind === 'repair') {
      const sol = g.solution || [];
      const ord = Array.isArray(m.order) ? m.order.map(n => n | 0) : [];
      return sol.length > 0 && sol.length === ord.length && sol.every((v, i) => v === ord[i]);
    }
    return (m.index | 0) === (pending.correctIndex | 0);
  }

  async handleKcStart(client, m = {}) {
    if (!client) return;
    if (typeof this.rateLimited === 'function' && this.rateLimited(client, 'kcStart', 3, 6)) return client.send('kcReject', { reason: 'rate' });
    if (this.kcShifts.has(client.sessionId)) return client.send('kcReject', { reason: 'active' });
    const store = this.kcStore(), account = this.kcAccountFor(client);
    const rec = typeof this.profileFor === 'function' ? this.profileFor(client) : null;
    if (!store || !account || !rec || !rec.prof) {
      this.kcTrace(client, 'start.unavailable', {
        hasStore: !!store,
        hasAccount: !!account,
        hasProfile: !!(rec && rec.prof),
      });
      return client.send('kcReject', { reason: 'unavailable' });
    }
    const type = KC.SHIFT_TYPES[m.shiftType] ? m.shiftType : 'standard';
    const entry = Math.max(0, this.kcConfig().entry[type] | 0);
    if ((rec.prof.gold | 0) < entry) return client.send('kcReject', { reason: 'gold', gold: rec.prof.gold | 0, entry });

    let subject = null;
    const subjectQuery = { subject: m.subject, subjectId: m.subjectId, fallbackSubject: m.fallbackSubject || 'Computer Science' };
    this.kcTrace(client, 'start.request', {
      accountId: account && account.id,
      schoolId: account && account.schoolId,
      shiftType: type,
      requestedSubject: subjectQuery.subject || '',
      requestedSubjectId: subjectQuery.subjectId || 0,
      fallbackSubject: subjectQuery.fallbackSubject,
    });
    try {
      subject = typeof store.findPlayableChallengeSubject === 'function'
        ? await store.findPlayableChallengeSubject(account, subjectQuery)
        : await store.resolvePlaySubject(account, subjectQuery);
    } catch (e) {
      this.kcTrace(client, 'start.subject-error', { message: e && e.message || String(e) });
    }
    if (!subject) {
      let debug = null;
      try { if (typeof store.debugChallengeSubjects === 'function') debug = await store.debugChallengeSubjects(account, subjectQuery); } catch (e) { debug = { error: e && e.message || String(e) }; }
      this.kcTrace(client, 'start.no-subject', { query: subjectQuery, debug });
      return client.send('kcReject', { reason: 'subject', requestedSubject: subjectQuery.subject || '', fallbackSubject: subjectQuery.fallbackSubject, debug });
    }
    let atoms = [];
    try { atoms = (await store.loadStudentAtoms(account, { subjectId: subject.subjectId, playableOnly: true })).atoms; } catch (e) {
      this.kcTrace(client, 'start.atoms-error', { subject, message: e && e.message || String(e) });
    }
    let contentDebug = null;
    try { if (typeof store.debugChallengeSubjects === 'function') contentDebug = await store.debugChallengeSubjects(account, subjectQuery); } catch (e) { contentDebug = { error: e && e.message || String(e) }; }
    this.kcTrace(client, 'start.resolved', {
      subject,
      playableAtoms: atoms && atoms.length || 0,
      debug: contentDebug,
    });
    if (!atoms || !atoms.length) {
      return client.send('kcReject', {
        reason: 'no_content',
        subjectId: subject.subjectId,
        subjectName: subject.subjectName || m.subject || '',
        requestedSubject: m.subject || '',
        fallbackSubject: m.fallbackSubject || 'Computer Science',
        debug: contentDebug,
      });
    }

    // Debit the stake before serving anything.
    rec.prof.gold = Math.max(0, (rec.prof.gold | 0) - entry);
    if (typeof this.recordEconomyGold === 'function') this.recordEconomyGold(client, -entry, 'knowledge_challenge', 'shift_entry', { shiftType: type });
    if (this.dirtyPlayers) this.dirtyPlayers.add(rec.token);
    this.kcSyncGold(client, rec.prof);

    let shiftId = 0;
    try {
      const started = await store.startShift(account, {
        subjectId: subject.subjectId, shiftType: type,
        plannedCases: KC.SHIFT_TYPES[type].cases, entryCostGold: entry,
      });
      shiftId = started && started.id || 0;
    } catch (_) {}
    let confusionPairs = [];
    try { confusionPairs = await store.loadConfusionPairs(subject.subjectId); } catch (_) {}

    const shift = {
      id: shiftId, subjectId: subject.subjectId, type, entry,
      planned: KC.SHIFT_TYPES[type].cases, ordinal: 0, lastAtomId: null,
      pending: null, corrective: null, confusionPairs, remediation: [], totals: freshTotals(),
    };
    this.kcShifts.set(client.sessionId, shift);
    this.kcTrace(client, 'start.shift-created', {
      shiftId,
      subjectId: shift.subjectId,
      subjectName: subject.subjectName || '',
      playableAtoms: atoms.length,
      shiftType: type,
      entry,
    });
    client.send('kcShiftStarted', {
      shiftId, shiftType: type, planned: shift.planned, entry, gold: rec.prof.gold | 0,
      subjectId: subject.subjectId,
      subjectName: subject.subjectName || '',
      requestedSubject: subject.requestedSubject || m.subject || '',
      subjectFallback: !!subject.subjectFallback,
    });
    await this.kcServeNextCase(client, shift);
  }

  async kcServeNextCase(client, shift) {
    const store = this.kcStore(), account = this.kcAccountFor(client);
    if (!store || !account) return;
    let atoms = [];
    try { atoms = (await store.loadStudentAtoms(account, { subjectId: shift.subjectId })).atoms; } catch (_) {}
    // A missed atom returns 3-5 cases later as a recovery. Feed those that are now due.
    const nextOrdinal = shift.ordinal + 1;
    const remediation = (shift.remediation || [])
      .filter(r => !r.served && r.dueOrdinal <= nextOrdinal)
      .map(r => ({ atomId: r.atomId, dueNow: true }));
    const pick = KC.selectNextAtom({
      atoms, confusionPairs: shift.confusionPairs, remediation,
      avoidAtomId: shift.lastAtomId, now: Date.now(),
    }, Math.random);
    if (!pick) return this.kcEndShift(client, 'exhausted');
    let challenge = null;
    try { challenge = await store.loadChallengeForAtom(shift.subjectId, pick.atomId, {}); } catch (_) {}
    if (!challenge) return this.kcEndShift(client, 'exhausted');

    let recovery = null;
    if (pick.reason === 'remediation') {
      recovery = (shift.remediation || []).find(r => !r.served && r.atomId === pick.atomId && r.dueOrdinal <= nextOrdinal);
      if (recovery) recovery.served = true;
    }

    shift.ordinal = nextOrdinal;
    shift.lastAtomId = pick.atomId;
    const built = this.kcBuildCase(challenge);
    shift.pending = {
      atomId: pick.atomId, questionId: challenge.questionId, format: challenge.format,
      correctIndex: built.correctIndex, grade: built.grade, reason: pick.reason, startedAt: Date.now(),
      explanation: challenge.explanation, confusionPairId: challenge.confusionPairId,
      isRecovery: !!recovery, remId: recovery ? recovery.remId : null,
      prompt: challenge.prompt, answers: built.answers,
      consequence: (challenge.payload && challenge.payload.consequence) || '',
    };
    client.send('kcCase', {
      shiftId: shift.id, ordinal: shift.ordinal, planned: shift.planned,
      atomId: pick.atomId, questionId: challenge.questionId, format: challenge.format,
      prompt: challenge.prompt, answers: built.answers, payload: built.payload,
      reason: pick.reason, recovery: !!recovery,
    });
  }

  // Open a durable remediation row and schedule the atom to return 3-5 cases later.
  async kcScheduleRemediation(client, shift, atomId, confusionPairId, reason) {
    const store = this.kcStore(), account = this.kcAccountFor(client);
    let remId = 0;
    if (store && account) {
      try {
        const r = await store.openRemediation(account, { subjectId: shift.subjectId, atomId, confusionPairId, reason });
        remId = (r && r.id) || 0;
      } catch (_) {}
    }
    shift.remediation = shift.remediation || [];
    shift.remediation.push({ atomId, remId, confusionPairId, dueOrdinal: shift.ordinal + 3 + Math.floor(Math.random() * 3), served: false });
    return remId;
  }

  // A reduced-load corrective: the same distinction narrowed to two options
  // (the correct answer plus the one the player picked). MCQ-style formats only.
  kcBuildCorrective(pending, wrongIndex) {
    const answers = (pending && pending.answers) || [];
    if (answers.length < 2 || !Number.isInteger(pending.correctIndex) || answers[pending.correctIndex] == null) return null;
    let di = (Number.isInteger(wrongIndex) && wrongIndex !== pending.correctIndex && answers[wrongIndex] != null) ? wrongIndex : -1;
    if (di < 0) { for (let i = 0; i < answers.length; i++) { if (i !== pending.correctIndex) { di = i; break; } } }
    if (di < 0) return null;
    const opts = [answers[pending.correctIndex], answers[di]];
    let correctIndex = 0;
    if (Math.random() < 0.5) { opts.reverse(); correctIndex = 1; }
    return { prompt: pending.prompt || 'Which is correct?', answers: opts, correctIndex };
  }

  async handleKcAnswer(client, m = {}) {
    const shift = client && this.kcShifts.get(client.sessionId);
    if (!shift || !shift.pending) return client && client.send('kcReject', { reason: 'no_case' });
    if (typeof this.rateLimited === 'function' && this.rateLimited(client, 'kcAnswer', 8, 12)) return client.send('kcReject', { reason: 'rate' });
    const pending = shift.pending;
    if (m.questionId != null && (m.questionId | 0) !== pending.questionId) return client.send('kcReject', { reason: 'stale' });
    const store = this.kcStore(), account = this.kcAccountFor(client);
    const answerIndex = m.index | 0;
    const correct = this.kcGrade(pending, m);
    const handbookUsed = !!m.handbookUsed;
    const independent = !handbookUsed;
    const responseMs = Math.max(0, Math.min(3600000, m.responseMs | 0));
    const isConfusion = !!pending.confusionPairId || pending.format === 'compare';
    const isNearTransfer = pending.reason === 'near_transfer';
    const isExplain = pending.format === 'construct_justification';
    const isRecovery = !!pending.isRecovery;

    let verdict = { advanced: false, reachedMaintain: false, state: null };
    if (store && account) {
      try {
        const r = await store.recordAtomReview(account, {
          subjectId: shift.subjectId, atomId: pending.atomId,
          event: {
            correct, firstAttemptCorrect: correct, independent, format: pending.format,
            discriminated: isConfusion, nearTransfer: isNearTransfer, explained: isExplain, shiftId: shift.id,
          },
        });
        if (r && r.recorded) verdict = r;
      } catch (_) {}
    }

    const t = shift.totals;
    t.completedCases += 1;
    if (correct) {
      t.firstAttemptCorrect += 1;
      if (independent) t.independentCorrect += 1;
      if (isNearTransfer) t.nearTransferCorrect += 1;
      t.streak += 1;
      if (t.streak > t.bestStreak) t.bestStreak = t.streak;
    } else {
      t.streak = 0;
    }
    if (handbookUsed) t.handbookUses += 1;
    if (verdict.advanced) t.stagesAdvanced += 1;
    if (verdict.reachedMaintain) t.atomsMaintained += 1;
    t.responseMsSum += responseMs;

    let scheduledRemId = 0;
    if (store && account) {
      try {
        await store.recordShiftCase({
          shiftId: shift.id, ordinal: shift.ordinal, questionId: pending.questionId, atomId: pending.atomId,
          format: pending.format, selectorReason: pending.reason, firstAttemptCorrect: correct,
          corrected: isRecovery, independent, responseMs, goldDelta: 0,
        });
      } catch (_) {}
      try {
        await store.logChallengeAttempt(account, {
          subjectId: shift.subjectId, questionId: pending.questionId, atomId: pending.atomId, format: pending.format,
          shiftId: shift.id, caseOrdinal: shift.ordinal, answerIndex, correct, durationMs: responseMs,
          firstAttempt: !isRecovery, requiredCorrection: isRecovery, recoveryPassed: isRecovery && correct,
          independent, handbookUsed, selectorReason: pending.reason, source: 'knowledge_challenge',
        });
      } catch (_) {}
      // Remediation return-loop: a recovery case closes (or, if failed, re-schedules)
      // the remediation; any other miss opens a fresh one that returns 3-5 cases later.
      if (isRecovery) {
        if (correct) {
          t.recoveryCases += 1;
          if (pending.remId) { try { await store.resolveRemediation(pending.remId, { status: 'done', stageOfLoop: 2, correctivePassed: true, recoveryPassed: true }); } catch (_) {} }
        } else {
          if (pending.remId) { try { await store.resolveRemediation(pending.remId, { status: 'failed', stageOfLoop: 1 }); } catch (_) {} }
          scheduledRemId = await this.kcScheduleRemediation(client, shift, pending.atomId, pending.confusionPairId, 'regression');
        }
      } else if (!correct) {
        scheduledRemId = await this.kcScheduleRemediation(client, shift, pending.atomId, pending.confusionPairId, isConfusion ? 'confusion' : 'wrong');
      }
    }

    shift.pending = null;
    client.send('kcResult', {
      shiftId: shift.id, correct, correctIndex: pending.correctIndex, explanation: pending.explanation,
      atomId: pending.atomId, stage: verdict.state ? verdict.state.stage : null,
      advanced: !!verdict.advanced, reachedMaintain: !!verdict.reachedMaintain, streak: t.streak,
      recovery: isRecovery,
    });

    // Immediate corrective on a miss: show the consequence + decisive knowledge and
    // make the player pass a reduced-load question before continuing (template steps 1-3).
    const corrective = correct ? null : this.kcBuildCorrective(pending, answerIndex);
    if (corrective) {
      shift.corrective = { remId: scheduledRemId, atomId: pending.atomId, correctIndex: corrective.correctIndex };
      client.send('kcCorrective', {
        shiftId: shift.id, consequence: pending.consequence || '', decisive: pending.explanation || '',
        prompt: corrective.prompt, answers: corrective.answers,
      });
      return;
    }

    if (shift.planned > 0 && t.completedCases >= shift.planned) return this.kcEndShift(client, 'complete');
    await this.kcServeNextCase(client, shift);
  }

  // The player's answer to the reduced-load corrective. Records whether it passed
  // on the durable remediation row, then continues the shift.
  async handleKcCorrective(client, m = {}) {
    const shift = client && this.kcShifts.get(client.sessionId);
    if (!shift || !shift.corrective) return client && client.send('kcReject', { reason: 'no_corrective' });
    if (typeof this.rateLimited === 'function' && this.rateLimited(client, 'kcAnswer', 8, 12)) return client.send('kcReject', { reason: 'rate' });
    const c = shift.corrective;
    shift.corrective = null;
    const correct = (m.index | 0) === (c.correctIndex | 0);
    const store = this.kcStore();
    if (store && c.remId) { try { await store.resolveRemediation(c.remId, { status: 'open', stageOfLoop: 1, correctivePassed: correct }); } catch (_) {} }
    client.send('kcCorrectiveResult', { shiftId: shift.id, correct, correctIndex: c.correctIndex });
    if (shift.planned > 0 && shift.totals.completedCases >= shift.planned) return this.kcEndShift(client, 'complete');
    await this.kcServeNextCase(client, shift);
  }

  handleKcEnd(client, m = {}) {
    return this.kcEndShift(client, m && m.reason === 'abandoned' ? 'abandoned' : 'ended');
  }

  async kcEndShift(client, reason = 'complete') {
    const shift = client && this.kcShifts.get(client.sessionId);
    if (!shift) return;
    this.kcShifts.delete(client.sessionId);
    const store = this.kcStore(), account = this.kcAccountFor(client);
    const t = shift.totals;
    const avgResponseMs = t.completedCases ? Math.round(t.responseMsSum / t.completedCases) : 0;
    const abandoned = reason === 'abandoned';
    const payout = abandoned ? 0 : KC.computeShiftPayout(shift.entry, t, this.kcConfig().payout).payout;

    const rec = typeof this.profileFor === 'function' ? this.profileFor(client) : null;
    if (!abandoned && payout > 0 && rec && rec.prof) {
      rec.prof.gold = Math.min(this.kcConfig().maxGold, (rec.prof.gold | 0) + payout);
      if (typeof this.recordEconomyGold === 'function') this.recordEconomyGold(client, payout, 'knowledge_challenge', 'shift_payout', { shiftType: shift.type });
      if (this.dirtyPlayers) this.dirtyPlayers.add(rec.token);
      this.kcSyncGold(client, rec.prof);
    }
    const totals = Object.assign({}, t, { avgResponseMs });
    if (store && account) {
      try { await store.endShift(shift.id, { status: abandoned ? 'abandoned' : 'ended', payoutGold: payout, totals }); } catch (_) {}
    }
    if (client && !abandoned) {
      const net = (payout | 0) - (shift.entry | 0);
      const player = typeof this.playerFor === 'function' ? this.playerFor(client) : null;
      const line = (player && player.name ? player.name : 'A hunter') + ' finished ' + String(shift.type || 'shift')
        + ': payout +' + (payout | 0) + ' gold'
        + ' (net ' + (net >= 0 ? '+' : '') + net + ' after stake).';
      const msg = { name: '[Tavern] [Scholar Table]', text: line };
      if (typeof this.broadcast === 'function') this.broadcast('chat', msg);
      else client.send('chat', msg);
      client.send('kcShiftReport', {
        shiftId: shift.id, reason, payout, entry: shift.entry,
        gold: rec && rec.prof ? rec.prof.gold | 0 : 0, totals,
      });
    }
  }

  // Called on disconnect: forfeit an in-progress shift (the stake was already spent).
  kcAbandon(client) {
    if (client && this.kcShifts && this.kcShifts.has(client.sessionId)) return this.kcEndShift(client, 'abandoned');
  }
}

module.exports = KnowledgeChallengeMixin.prototype;
