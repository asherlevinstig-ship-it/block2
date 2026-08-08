'use strict';
const test = require('node:test');
const assert = require('node:assert');
const mixin = require('../rooms/knowledge-challenge.mixin');

function totals(over) {
  return Object.assign({
    completedCases: 0, firstAttemptCorrect: 0, independentCorrect: 0, nearTransferCorrect: 0,
    recoveryCases: 0, handbookUses: 0, bestStreak: 0, streak: 0, stagesAdvanced: 0,
    atomsMaintained: 0, responseMsSum: 0,
  }, over || {});
}

function fakeStore(over) {
  const calls = { startShift: [], review: [], shiftCase: [], attempt: [], remediation: [], endShift: [] };
  const store = {
    _calls: calls,
    async resolvePlaySubject() { return { subjectId: 5, scopeSchoolId: 0 }; },
    async loadStudentAtoms() { return { subjectId: 5, atoms: [{ atomId: 1, difficulty: 1, entityId: 1, state: {} }] }; },
    async loadConfusionPairs() { return []; },
    async loadChallengeForAtom() {
      return { questionId: 8, atomId: 1, format: 'multiple_choice', prompt: 'Q', answers: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'because', payload: null, confusionPairId: null, difficulty: 1 };
    },
    async startShift(_a, i) { calls.startShift.push(i); return { id: 77 }; },
    async recordAtomReview(_a, i) { calls.review.push(i); return { recorded: true, advanced: true, reachedMaintain: false, state: { stage: 1 } }; },
    async recordShiftCase(i) { calls.shiftCase.push(i); return { recorded: true }; },
    async logChallengeAttempt(_a, i) { calls.attempt.push(i); return { recorded: true }; },
    async openRemediation(_a, i) { calls.remediation.push(i); return { opened: true, id: 1 }; },
    async endShift(id, i) { calls.endShift.push(Object.assign({ id }, i)); return { ended: true }; },
  };
  return Object.assign(store, over || {});
}

function makeRoom(store, prof) {
  const room = Object.create(mixin);
  room.initKnowledgeChallengeState();
  room.kcStore = () => store;
  room.kcAccountFor = () => ({ id: 'student_5' });
  room.profileFor = () => ({ prof, token: 't' });
  room.dirtyPlayers = new Set();
  room._econ = [];
  room.recordEconomyGold = (...a) => { room._econ.push(a); };
  room.syncPlayerProfile = () => {};
  room.rateLimited = () => false;
  return room;
}

function makeClient() {
  const sent = [];
  return { sessionId: 's1', _account: { id: 'student_5' }, send: (type, msg) => sent.push({ type, msg }), sent };
}

test('starting a shift debits the entry stake and serves the first case', async () => {
  const store = fakeStore();
  const prof = { gold: 100 };
  const room = makeRoom(store, prof);
  const client = makeClient();
  await room.handleKcStart(client, { subject: 'CS', shiftType: 'quick' });
  assert.equal(prof.gold, 80, 'entry of 20 debited');
  assert.ok(room.kcShifts.has('s1'));
  assert.equal(store._calls.startShift[0].entryCostGold, 20);
  assert.deepEqual(room._econ[0].slice(0, 4), [client, -20, 'knowledge_challenge', 'shift_entry']);
  assert.ok(client.sent.find(s => s.type === 'kcShiftStarted'));
  const caseMsg = client.sent.find(s => s.type === 'kcCase');
  assert.ok(caseMsg);
  assert.equal(caseMsg.msg.questionId, 8);
  assert.equal(caseMsg.msg.answers.length, 4);
});

test('a shift cannot start without the entry stake', async () => {
  const store = fakeStore();
  const prof = { gold: 5 };
  const room = makeRoom(store, prof);
  const client = makeClient();
  await room.handleKcStart(client, { shiftType: 'quick' });
  assert.equal(prof.gold, 5, 'no gold moved');
  assert.equal(room.kcShifts.has('s1'), false);
  const rej = client.sent.find(s => s.type === 'kcReject');
  assert.equal(rej.msg.reason, 'gold');
});

test('an in-content subject is required', async () => {
  const store = fakeStore({ async loadStudentAtoms() { return { subjectId: 5, atoms: [] }; } });
  const prof = { gold: 100 };
  const room = makeRoom(store, prof);
  const client = makeClient();
  await room.handleKcStart(client, { shiftType: 'quick' });
  assert.equal(prof.gold, 100, 'stake refunded by never being taken');
  assert.equal(client.sent.find(s => s.type === 'kcReject').msg.reason, 'no_content');
});

test('answering correctly reviews the atom and accumulates fluency totals', async () => {
  const store = fakeStore();
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  await room.handleKcStart(client, { shiftType: 'quick' });
  const pending = room.kcShifts.get('s1').pending;
  client.sent.length = 0;
  await room.handleKcAnswer(client, { questionId: 8, index: pending.correctIndex, responseMs: 1200 });
  const result = client.sent.find(s => s.type === 'kcResult');
  assert.equal(result.msg.correct, true);
  assert.equal(store._calls.review.length, 1);
  assert.equal(store._calls.review[0].event.correct, true);
  assert.equal(store._calls.attempt.length, 1);
  const shift = room.kcShifts.get('s1');
  assert.equal(shift.totals.completedCases, 1);
  assert.equal(shift.totals.firstAttemptCorrect, 1);
  assert.equal(shift.totals.stagesAdvanced, 1, 'engine reported an advance');
});

test('a wrong answer opens remediation and breaks the streak', async () => {
  const store = fakeStore();
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  await room.handleKcStart(client, { shiftType: 'quick' });
  const pending = room.kcShifts.get('s1').pending;
  await room.handleKcAnswer(client, { questionId: 8, index: (pending.correctIndex + 1) % 4, responseMs: 400 });
  assert.equal(store._calls.remediation.length, 1);
  assert.equal(room.kcShifts.get('s1').totals.streak, 0);
});

test('completing the planned cases pays out and credits gold', async () => {
  const store = fakeStore();
  const prof = { gold: 100 };
  const room = makeRoom(store, prof);
  const client = makeClient();
  // Seed a one-case shift so the next correct answer completes it.
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'quick', entry: 20, planned: 1, ordinal: 1, lastAtomId: 1,
    confusionPairs: [], totals: totals(),
    pending: { atomId: 1, questionId: 8, format: 'multiple_choice', correctIndex: 2, reason: 'weakness', explanation: 'x', confusionPairId: null, startedAt: Date.now() },
  });
  await room.handleKcAnswer(client, { questionId: 8, index: 2, responseMs: 1000 });
  // returnRate = 0.5 + 1.2*(0.6+0.4) + min(0.2, 1*0.02) = 1.72 -> perf round(20*1.72)=34; +5 stage bonus = 39
  assert.equal(prof.gold, 139);
  assert.equal(room.kcShifts.has('s1'), false, 'shift closed');
  const report = client.sent.find(s => s.type === 'kcShiftReport');
  assert.equal(report.msg.payout, 39);
  assert.equal(store._calls.endShift[0].status, 'ended');
  assert.equal(store._calls.endShift[0].payoutGold, 39);
});

test('disconnecting forfeits an active shift with no payout', async () => {
  const store = fakeStore();
  const prof = { gold: 100 };
  const room = makeRoom(store, prof);
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'quick', entry: 20, planned: 10, ordinal: 4, lastAtomId: 1,
    confusionPairs: [], pending: null, totals: totals({ completedCases: 4, firstAttemptCorrect: 4 }),
  });
  await room.kcAbandon(client);
  assert.equal(prof.gold, 100, 'no payout on abandon');
  assert.equal(room.kcShifts.has('s1'), false);
  assert.equal(store._calls.endShift[0].status, 'abandoned');
  assert.equal(store._calls.endShift[0].payoutGold, 0);
  assert.equal(client.sent.find(s => s.type === 'kcShiftReport'), undefined);
});

test('a miss schedules the atom to return 3-5 cases later as a recovery', async () => {
  const store = fakeStore();
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 2, lastAtomId: 9,
    confusionPairs: [], remediation: [], totals: totals(),
    pending: { atomId: 1, questionId: 8, format: 'multiple_choice', correctIndex: 0, reason: 'weakness', explanation: 'x', confusionPairId: null, isRecovery: false, remId: null, startedAt: Date.now() },
  });
  await room.handleKcAnswer(client, { questionId: 8, index: 1, responseMs: 500 }); // wrong
  const scheduled = room.kcShifts.get('s1').remediation.find(r => r.atomId === 1);
  assert.ok(scheduled, 'remediation scheduled for the missed atom');
  assert.ok(scheduled.dueOrdinal >= 5 && scheduled.dueOrdinal <= 7, 'returns 3-5 cases after the miss');
  assert.equal(scheduled.remId, 1);
  assert.equal(store._calls.remediation.length, 1, 'durable remediation opened');
});

test('a due remediation is served as a recovery and passing it closes the loop', async () => {
  const store = fakeStore();
  const resolved = [];
  store.resolveRemediation = async (id, patch) => { resolved.push({ id, patch }); return { updated: true }; };
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 5, lastAtomId: 9,
    confusionPairs: [], pending: null, totals: totals(),
    remediation: [{ atomId: 1, remId: 55, confusionPairId: null, dueOrdinal: 6, served: false }],
  });
  await room.kcServeNextCase(client, room.kcShifts.get('s1'));
  const pending = room.kcShifts.get('s1').pending;
  assert.equal(pending.reason, 'remediation');
  assert.equal(pending.isRecovery, true);
  assert.equal(pending.remId, 55);
  await room.handleKcAnswer(client, { questionId: pending.questionId, index: pending.correctIndex, responseMs: 700 });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, 55);
  assert.equal(resolved[0].patch.recoveryPassed, true);
  assert.equal(room.kcShifts.get('s1').totals.recoveryCases, 1);
});

test('kcBuildCase shapes a construct_justification case and grade', () => {
  const room = makeRoom(fakeStore(), { gold: 100 });
  const built = room.kcBuildCase({
    format: 'construct_justification',
    payload: { prompt: 'Justify it', bank: [{ text: 'a', correct: true }, { text: 'b', correct: false }, { text: 'c', correct: true }] },
  });
  assert.equal(built.answers.length, 0);
  assert.equal(built.grade.kind, 'construct');
  assert.equal(built.payload.kind, 'construct_justification');
  assert.equal(built.payload.bank.length, 3);
  assert.deepEqual(built.grade.correctSet.map(i => built.payload.bank[i]).sort(), ['a', 'c']);
});

test('kcBuildCase shapes a repair_diagram case and remaps the solution', () => {
  const room = makeRoom(fakeStore(), { gold: 100 });
  const built = room.kcBuildCase({
    format: 'repair_diagram',
    payload: { prompt: 'Order it', pool: ['sensor', 'processor', 'actuator'], solution: [0, 1, 2] },
  });
  assert.equal(built.grade.kind, 'repair');
  assert.equal(built.payload.slots, 3);
  assert.deepEqual(built.grade.solution.map(i => built.payload.pool[i]), ['sensor', 'processor', 'actuator']);
});

test('construct_justification is graded as a set of selected parts', async () => {
  const room = makeRoom(fakeStore(), { gold: 100 });
  const client = makeClient();
  const base = {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 1, lastAtomId: 1,
    confusionPairs: [], remediation: [], corrective: null, totals: totals(),
  };
  const pending = () => ({ atomId: 1, questionId: 8, format: 'construct_justification', correctIndex: -1, grade: { kind: 'construct', correctSet: [0, 2] }, reason: 'weakness', explanation: 'x', confusionPairId: null, isRecovery: false, remId: null, prompt: '', answers: [], consequence: '' });
  room.kcShifts.set('s1', Object.assign({}, base, { pending: pending() }));
  await room.handleKcAnswer(client, { questionId: 8, selected: [2, 0], responseMs: 900 });
  assert.equal(client.sent.find(s => s.type === 'kcResult').msg.correct, true, 'order-independent set match');

  const client2 = makeClient(); client2.sessionId = 's1';
  room.kcShifts.set('s1', Object.assign({}, base, { pending: pending(), totals: totals() }));
  await room.handleKcAnswer(client2, { questionId: 8, selected: [0], responseMs: 900 });
  assert.equal(client2.sent.find(s => s.type === 'kcResult').msg.correct, false, 'incomplete selection fails');
});

test('repair_diagram is graded as an ordered sequence', async () => {
  const room = makeRoom(fakeStore(), { gold: 100 });
  const client = makeClient();
  const base = {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 1, lastAtomId: 1,
    confusionPairs: [], remediation: [], corrective: null,
  };
  const pending = () => ({ atomId: 1, questionId: 8, format: 'repair_diagram', correctIndex: -1, grade: { kind: 'repair', solution: [1, 0, 2] }, reason: 'weakness', explanation: 'x', confusionPairId: null, isRecovery: false, remId: null, prompt: '', answers: [], consequence: '' });
  room.kcShifts.set('s1', Object.assign({}, base, { totals: totals(), pending: pending() }));
  await room.handleKcAnswer(client, { questionId: 8, order: [1, 0, 2], responseMs: 900 });
  assert.equal(client.sent.find(s => s.type === 'kcResult').msg.correct, true);

  const client2 = makeClient();
  room.kcShifts.set('s1', Object.assign({}, base, { totals: totals(), pending: pending() }));
  await room.handleKcAnswer(client2, { questionId: 8, order: [0, 1, 2], responseMs: 900 });
  assert.equal(client2.sent.find(s => s.type === 'kcResult').msg.correct, false, 'wrong order fails');
});

test('a miss sends an inline reduced-load corrective before continuing', async () => {
  const store = fakeStore();
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 2, lastAtomId: 9,
    confusionPairs: [], remediation: [], corrective: null, totals: totals(),
    pending: {
      atomId: 1, questionId: 8, format: 'multiple_choice', correctIndex: 0, reason: 'weakness',
      explanation: 'Stacks are LIFO.', confusionPairId: null, isRecovery: false, remId: null, startedAt: Date.now(),
      prompt: 'Which order?', answers: ['LIFO', 'FIFO', 'Random', 'Sorted'], consequence: 'Items come out wrong.',
    },
  });
  client.sent.length = 0;
  await room.handleKcAnswer(client, { questionId: 8, index: 1, responseMs: 500 }); // wrong, picked FIFO
  const corr = client.sent.find(s => s.type === 'kcCorrective');
  assert.ok(corr, 'corrective sent');
  assert.equal(corr.msg.decisive, 'Stacks are LIFO.');
  assert.equal(corr.msg.consequence, 'Items come out wrong.');
  assert.equal(corr.msg.answers.length, 2, 'reduced to two options');
  assert.ok(corr.msg.answers.includes('LIFO') && corr.msg.answers.includes('FIFO'), 'correct answer + the option picked');
  assert.ok(room.kcShifts.get('s1').corrective, 'corrective state held server-side');
  assert.equal(client.sent.find(s => s.type === 'kcCase'), undefined, 'no next case until the corrective is answered');
});

test('answering the corrective records it open and continues the shift', async () => {
  const store = fakeStore();
  const resolved = [];
  store.resolveRemediation = async (id, patch) => { resolved.push({ id, patch }); return { updated: true }; };
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 3, lastAtomId: 1,
    confusionPairs: [], remediation: [], pending: null, totals: totals({ completedCases: 3 }),
    corrective: { remId: 55, atomId: 1, correctIndex: 1 },
  });
  await room.handleKcCorrective(client, { index: 1 }); // correct
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, 55);
  assert.equal(resolved[0].patch.correctivePassed, true);
  assert.equal(resolved[0].patch.status, 'open', 'stays open for the later recovery');
  assert.ok(client.sent.find(s => s.type === 'kcCorrectiveResult'));
  assert.equal(room.kcShifts.get('s1').corrective, null);
  assert.ok(client.sent.find(s => s.type === 'kcCase'), 'next case served after the corrective');
});

test('a corrective answer with nothing pending is rejected', async () => {
  const store = fakeStore();
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', { id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 1, corrective: null, remediation: [], pending: null, confusionPairs: [], totals: totals() });
  await room.handleKcCorrective(client, { index: 0 });
  assert.equal(client.sent.find(s => s.type === 'kcReject').msg.reason, 'no_corrective');
});

test('failing a recovery re-schedules the atom instead of closing it', async () => {
  const store = fakeStore();
  const resolved = [];
  store.resolveRemediation = async (id, patch) => { resolved.push({ id, patch }); return { updated: true }; };
  const room = makeRoom(store, { gold: 100 });
  const client = makeClient();
  room.kcShifts.set('s1', {
    id: 77, subjectId: 5, type: 'standard', entry: 40, planned: 20, ordinal: 6, lastAtomId: 9,
    confusionPairs: [], totals: totals(),
    remediation: [{ atomId: 1, remId: 55, confusionPairId: null, dueOrdinal: 6, served: true }],
    pending: { atomId: 1, questionId: 8, format: 'multiple_choice', correctIndex: 0, reason: 'remediation', explanation: 'x', confusionPairId: null, isRecovery: true, remId: 55, startedAt: Date.now() },
  });
  await room.handleKcAnswer(client, { questionId: 8, index: 1, responseMs: 500 }); // wrong recovery
  assert.equal(resolved[0].patch.status, 'failed');
  const reQueued = room.kcShifts.get('s1').remediation.filter(r => !r.served);
  assert.equal(reQueued.length, 1, 'a fresh recovery is queued after a failed one');
});
