'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { MySqlGameQuestionStore } = require('../mysql-game-questions');

const T = 1_000_000_000_000;

// A mock pool that absorbs all ensureSchema() traffic (CREATE/ALTER/SHOW COLUMNS,
// and the atom-type seed count) so each test can focus on one query. `handler`
// may return a result for the query under test, or undefined to fall through.
function kcPool(calls, handler) {
  return {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/^\s*CREATE TABLE/i.test(sql)) return [{ affectedRows: 0 }];
      if (/^\s*ALTER TABLE/i.test(sql)) return [{ affectedRows: 0 }];
      if (/^\s*SHOW COLUMNS/i.test(sql)) return [[]];
      if (/SELECT COUNT\(\*\) AS n FROM kc_atom_type/i.test(sql)) return [[{ n: 9 }]];
      if (handler) { const r = handler(sql, params); if (r !== undefined) return r; }
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: 0, affectedRows: 1 }];
      if (/^\s*UPDATE/i.test(sql)) return [{ affectedRows: 1 }];
      return [[]];
    },
  };
}
const find = (calls, re) => calls.find(c => re.test(c.sql));

test('recordAtomReview runs the stage machine and upserts the advanced state', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({ pool: kcPool(calls) }); // SELECT falls through to [] -> unseen atom
  const res = await store.recordAtomReview({ id: 'student_5' }, {
    subjectId: 5, atomId: 42, now: T,
    event: { correct: true, firstAttemptCorrect: true, format: 'multiple_choice', shiftId: 1 },
  });
  assert.equal(res.recorded, true);
  assert.equal(res.advanced, true);
  assert.equal(res.state.stage, 1, 'independent first-attempt success reaches Retrieve');
  const upsert = find(calls, /INSERT INTO kc_student_atom/i);
  assert.ok(upsert, 'issues an upsert');
  assert.match(upsert.sql, /ON DUPLICATE KEY UPDATE/i);
  // params: [studentId, accountId, subjectId, atomId, stage, attempts, correct, firstAttemptCorrect, ...]
  assert.equal(upsert.params[0], 5, 'student_id derived from student_5');
  assert.equal(upsert.params[1], 'student_5', 'account_id');
  assert.equal(upsert.params[2], 5, 'subject_id');
  assert.equal(upsert.params[3], 42, 'atom_id');
  assert.equal(upsert.params[4], 1, 'stage');
  assert.equal(upsert.params[6], 1, 'correct');
  assert.equal(upsert.params[7], 1, 'first_attempt_correct');
});

test('recordAtomReview refuses without a full context', async () => {
  const store = new MySqlGameQuestionStore({ pool: kcPool([]) });
  const res = await store.recordAtomReview({ id: '' }, { subjectId: 5, atomId: 42 });
  assert.deepEqual(res, { recorded: false, reason: 'context' });
});

test('loadStudentAtoms merges content with per-account fluency and defaults unseen atoms', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({
    pool: kcPool(calls, sql => {
      if (/FROM kc_atom a[\s\S]*LEFT JOIN kc_student_atom/i.test(sql)) return [[
        { atom_id: 1, difficulty: 2, entity_id: 7, stage: 3, attempts: 4, correct: 3, first_attempt_correct: 2, streak: 1, ease: 260, interval_idx: 2, next_due_ms: T + 1000, formats_seen: 5, discriminated: 1, near_transfer_ok: 0, explained: 0, delayed_success: 0, last_shift_id: 9, sessions_seen: 2, last_seen_ms: T },
        { atom_id: 2, difficulty: 1, entity_id: 7, stage: null },
      ]];
    }),
  });
  const out = await store.loadStudentAtoms({ id: 'student_5' }, { subjectId: 5 });
  assert.equal(out.subjectId, 5);
  assert.equal(out.atoms.length, 2);
  assert.equal(out.atoms[0].atomId, 1);
  assert.equal(out.atoms[0].difficulty, 2);
  assert.equal(out.atoms[0].state.stage, 3);
  assert.equal(out.atoms[0].state.discriminated, true);
  assert.equal(out.atoms[0].state.nextDue, T + 1000);
  assert.deepEqual(out.atoms[1].state, {}, 'unseen atom -> engine defaults');
});

test('listOpenRemediation maps open rows', async () => {
  const store = new MySqlGameQuestionStore({
    pool: kcPool([], sql => {
      if (/FROM kc_remediation/i.test(sql) && /status = 'open'/i.test(sql)) return [[
        { id: 3, atom_id: 9, confusion_pair_id: null, reason: 'confusion', stage_of_loop: 1, corrective_passed: 1, recovery_passed: 0, due_after_cases: 4 },
      ]];
    }),
  });
  const list = await store.listOpenRemediation({ id: 'student_5' }, { subjectId: 5 });
  assert.equal(list.length, 1);
  assert.equal(list[0].atomId, 9);
  assert.equal(list[0].reason, 'confusion');
  assert.equal(list[0].correctivePassed, true);
  assert.equal(list[0].dueAfterCases, 4);
});

test('openRemediation inserts and returns the new id', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({
    pool: kcPool(calls, sql => { if (/INSERT INTO kc_remediation/i.test(sql)) return [{ insertId: 55 }]; }),
  });
  const res = await store.openRemediation({ id: 'student_5' }, { subjectId: 5, atomId: 9, reason: 'wrong' });
  assert.deepEqual(res, { opened: true, id: 55 });
});

test('startShift opens an active shift row', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({
    pool: kcPool(calls, sql => { if (/INSERT INTO kc_shift\b/i.test(sql)) return [{ insertId: 77 }]; }),
  });
  const res = await store.startShift({ id: 'student_5', schoolId: '12' }, { subjectId: 5, shiftType: 'quick', plannedCases: 10, entryCostGold: 20 });
  assert.equal(res.started, true);
  assert.equal(res.id, 77);
  const ins = find(calls, /INSERT INTO kc_shift\b/i);
  assert.match(ins.sql, /'active'/);
  assert.equal(ins.params[0], 'student_5'); // account_id
  assert.equal(ins.params[1], 5);           // student_id
  assert.equal(ins.params[4], 'quick');     // shift_type
  assert.equal(ins.params[6], 20);          // entry_cost_gold
});

test('startShift clamps an unknown type back to standard', async () => {
  const store = new MySqlGameQuestionStore({
    pool: kcPool([], sql => { if (/INSERT INTO kc_shift\b/i.test(sql)) return [{ insertId: 1 }]; }),
  });
  const res = await store.startShift({ id: 'student_5' }, { subjectId: 5, shiftType: 'jackpot' });
  assert.equal(res.shiftType, 'standard');
});

test('recordShiftCase writes a case row', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({ pool: kcPool(calls) });
  const res = await store.recordShiftCase({ shiftId: 77, ordinal: 3, questionId: 8, atomId: 9, format: 'compare', selectorReason: 'confusion', firstAttemptCorrect: true, independent: true, responseMs: 1200, goldDelta: 2 });
  assert.equal(res.recorded, true);
  const ins = find(calls, /INSERT INTO kc_shift_case/i);
  assert.ok(ins);
  assert.equal(ins.params[0], 77);          // shift_id
  assert.equal(ins.params[5], 'confusion'); // selector_reason
  assert.equal(ins.params[6], 1);           // first_attempt_correct
});

test('endShift only finalises an active shift and reports the outcome', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({
    pool: kcPool(calls, sql => { if (/UPDATE kc_shift SET/i.test(sql)) return [{ affectedRows: 1 }]; }),
  });
  const res = await store.endShift(77, { status: 'ended', payoutGold: 34, totals: { completedCases: 10, firstAttemptCorrect: 8, bestStreak: 5 } });
  assert.equal(res.ended, true);
  assert.equal(res.status, 'ended');
  const upd = find(calls, /UPDATE kc_shift SET/i);
  assert.match(upd.sql, /WHERE id = \? AND status = 'active'/);
  assert.equal(upd.params[1], 34); // payout_gold
});

test('endShift reports not-ended when no active shift matched', async () => {
  const store = new MySqlGameQuestionStore({
    pool: kcPool([], sql => { if (/UPDATE kc_shift SET/i.test(sql)) return [{ affectedRows: 0 }]; }),
  });
  const res = await store.endShift(77, { status: 'ended' });
  assert.equal(res.ended, false);
});

function importMockPool(calls) {
  let atomSeq = 200;
  return kcPool(calls, sql => {
    if (/SELECT id, code, subject_id FROM kc_atom_type/i.test(sql)) return [[
      { id: 1, code: 'purpose', subject_id: null }, { id: 2, code: 'use', subject_id: null },
      { id: 3, code: 'system_role', subject_id: null },
    ]];
    if (/INSERT INTO kc_entity/i.test(sql)) return [{ insertId: 100 }];
    if (/INSERT INTO kc_atom\b/i.test(sql)) return [{ insertId: ++atomSeq }];
    if (/SELECT id FROM game_question WHERE subject_id/i.test(sql)) return [[]];
    if (/INSERT INTO game_question/i.test(sql)) return [{ insertId: 300 }];
  });
}

test('importContentPack seeds entities, atoms, atom-linked questions and confusion pairs', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({ pool: importMockPool(calls) });
  const pack = {
    entities: [{
      code: 'e', name: 'E', topic: 'T', stage: 'GCSE', summary: 's', atoms: [
        { type: 'purpose', difficulty: 1, statement: 'p', questions: [{ format: 'multiple_choice', prompt: 'Prompt one?', answers: ['a', 'b', 'c', 'd'], correct: 0, explanation: 'because it is so' }] },
        { type: 'use', difficulty: 2, statement: 'u', questions: [{ format: 'multiple_choice', prompt: 'Prompt two?', answers: ['a', 'b', 'c', 'd'], correct: 1, explanation: 'because of that' }] },
      ],
    }],
    confusionPairs: [{ a: 'e.purpose', b: 'e.use', note: 'distinct' }],
  };
  const counts = await store.importContentPack(5, pack, { schoolId: 0 });
  assert.deepEqual(counts, { atomTypes: 0, entities: 1, atoms: 2, questions: 2, pairs: 1 });
  const q = find(calls, /INSERT INTO game_question/i);
  assert.match(q.sql, /primary_atom_id/);
  assert.equal(q.params[11], 201, 'question links to its atom id');
  const pair = find(calls, /INSERT INTO kc_confusion_pair/i);
  assert.deepEqual(pair.params.slice(0, 3), [5, 201, 202]);
});

test('importContentPack updates a question in place when the prompt already exists', async () => {
  const calls = [];
  const pool = kcPool(calls, sql => {
    if (/SELECT id, code, subject_id FROM kc_atom_type/i.test(sql)) return [[{ id: 1, code: 'purpose', subject_id: null }]];
    if (/INSERT INTO kc_entity/i.test(sql)) return [{ insertId: 100 }];
    if (/INSERT INTO kc_atom\b/i.test(sql)) return [{ insertId: 201 }];
    if (/SELECT id FROM game_question WHERE subject_id/i.test(sql)) return [[{ id: 42 }]]; // already exists
  });
  const store = new MySqlGameQuestionStore({ pool });
  await store.importContentPack(5, {
    entities: [{ code: 'e', name: 'E', atoms: [{ type: 'purpose', questions: [{ prompt: 'Existing prompt?', answers: ['a', 'b', 'c', 'd'], correct: 0, explanation: 'kept' }] }] }],
  });
  const upd = find(calls, /UPDATE game_question SET/i);
  assert.ok(upd, 'updates instead of inserting');
  assert.equal(upd.params[upd.params.length - 1], 42, 'targets the existing question id');
});

test('the shipped sample pack imports cleanly', async () => {
  const pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'content', 'knowledge-challenge', 'sample-pack.json'), 'utf8'));
  const store = new MySqlGameQuestionStore({ pool: importMockPool([]) });
  const counts = await store.importContentPack(5, pack, {});
  assert.equal(counts.entities, 3);
  assert.equal(counts.atoms, 5);
  assert.equal(counts.questions, 6);
  assert.equal(counts.pairs, 1);
});

test('loadChallengeForAtom returns a parsed, servable challenge or null', async () => {
  const store = new MySqlGameQuestionStore({
    pool: kcPool([], sql => {
      if (/FROM game_question[\s\S]*primary_atom_id = \?/i.test(sql)) return [[
        { id: 8, format: 'multiple_choice', prompt: 'Q', answers: JSON.stringify(['a', 'b', 'c', 'd']), correct_index: 2, explanation: 'why', payload_json: null, entity_id: 3, primary_atom_id: 1, confusion_pair_id: null, difficulty: 2 },
      ]];
    }),
  });
  const ch = await store.loadChallengeForAtom(5, 1);
  assert.equal(ch.questionId, 8);
  assert.equal(ch.format, 'multiple_choice');
  assert.deepEqual(ch.answers, ['a', 'b', 'c', 'd']);
  assert.equal(ch.correctIndex, 2);
  assert.equal(ch.difficulty, 2);

  const none = new MySqlGameQuestionStore({ pool: kcPool([], sql => { if (/FROM game_question/i.test(sql)) return [[]]; }) });
  assert.equal(await none.loadChallengeForAtom(5, 999), null);
});

test('logChallengeAttempt writes the extended attempt columns', async () => {
  const calls = [];
  const store = new MySqlGameQuestionStore({ pool: kcPool(calls) });
  const res = await store.logChallengeAttempt({ id: 'student_5', schoolId: '12' }, {
    subjectId: 5, questionId: 8, atomId: 9, format: 'compare', shiftId: 77, caseOrdinal: 3,
    answerIndex: 1, correct: true, durationMs: 1500, firstAttempt: true, independent: true,
    selectorReason: 'confusion', source: 'knowledge_challenge',
  });
  assert.equal(res.recorded, true);
  const ins = find(calls, /INSERT INTO game_question_attempt/i);
  assert.ok(ins);
  assert.match(ins.sql, /atom_id, format, shift_id, case_ordinal, first_attempt/);
  assert.match(ins.sql, /selector_reason/);
  assert.equal(ins.params.length, 20);
});
