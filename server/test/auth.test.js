const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const { AuthService } = require('../auth');
const { MySqlAuthBackend, normalizeBcryptHash } = require('../mysql-auth');
const { MySqlGameQuestionStore } = require('../mysql-game-questions');

test('accounts use scrypt hashes and verified server sessions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-'));
  const auth = new AuthService(dir);
  const account = await auth.register('Test_Hunter', 'correct horse battery', 'Test Hunter');
  assert.match(account.id, /^u_[a-f0-9]{32}$/);
  assert.equal(account.username, 'test_hunter');

  const disk = fs.readFileSync(path.join(dir, 'auth.json'), 'utf8');
  assert.equal(disk.includes('correct horse battery'), false, 'plaintext password reached persistent storage');
  assert.equal(JSON.parse(disk).accounts[0].hash.length >= 40, true);

  await assert.rejects(() => auth.login('test_hunter', 'wrong password'), /Invalid username or password/);
  const verified = await auth.login('TEST_HUNTER', 'correct horse battery');
  assert.equal(verified.id, account.id);

  const sid = await auth.issueSession(verified);
  const req = { headers: { cookie: 'other=x; bc_session=' + encodeURIComponent(sid) } };
  assert.deepEqual(auth.authenticateRequest(req), { id: account.id, username: 'test_hunter', displayName: 'Test Hunter' });
  assert.equal(auth.authenticateRequest({ headers: { cookie: 'bc_session=tampered' } }), false);
  const sessionDisk = fs.readFileSync(path.join(dir, 'auth.json'), 'utf8');
  assert.equal(sessionDisk.includes(sid), false, 'raw session bearer reached persistent storage');
  const restarted = new AuthService(dir);
  assert.deepEqual(restarted.authenticateRequest(req), { id: account.id, username: 'test_hunter', displayName: 'Test Hunter' });
  restarted.stop();
  auth.sessions.delete(auth.sessionKey(sid));
  assert.equal(auth.authenticateRequest(req), false, 'revoked session remained usable');
  auth.stop();
});

test('registration rejects weak credentials and duplicate usernames', async () => {
  const auth = new AuthService(fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-')));
  await assert.rejects(() => auth.register('x', 'long enough password', 'X'), /Username/);
  await assert.rejects(() => auth.register('valid_user', 'short', 'X'), /Password/);
  await auth.register('valid_user', 'long enough password', 'X');
  await assert.rejects(() => auth.register('VALID_USER', 'another good password', 'Y'), /already registered/);
  auth.stop();
});

test('concurrent auth saves are serialized without losing sessions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-'));
  const auth = new AuthService(dir);
  const account = await auth.register('queue_test', 'long enough password', 'Queue Test');
  const sessions = await Promise.all(Array.from({ length: 8 }, () => auth.issueSession(account)));
  const restarted = new AuthService(dir);
  for (const sid of sessions) {
    assert.equal(restarted.authenticateRequest({ headers: { cookie: 'bc_session=' + sid } }).id, account.id);
  }
  restarted.stop();
  auth.stop();
});

test('shared auth storage lets another server process accept a fresh session', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-shared-'));
  const authA = new AuthService(dir, { reloadSessionsOnMiss: true });
  const authB = new AuthService(dir, { reloadSessionsOnMiss: true });
  const account = await authA.register('shared_session', 'long enough password', 'Shared Session');
  const sid = await authA.issueSession(account);
  const req = { headers: { cookie: 'bc_session=' + encodeURIComponent(sid) } };

  assert.deepEqual(authB.authenticateRequest(req), {
    id: account.id,
    username: 'shared_session',
    displayName: 'Shared Session',
  });
  authA.stop();
  authB.stop();
});

function fakeMysqlPool({ teacher, student } = {}) {
  const calls = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/FROM teachers/i.test(sql)) return [[teacher].filter(Boolean)];
      if (/FROM students/i.test(sql)) return [[student].filter(Boolean)];
      return [{ affectedRows: 1 }];
    },
  };
}

test('MySQL auth backend validates existing teacher accounts and persists session snapshots', async () => {
  const hash = await bcrypt.hash('correct horse teacher', 10);
  const pool = fakeMysqlPool({
    teacher: { id: 42, name: 'Mara Vale', email: 'Mara@School.test', password_hash: hash, role: 'teacher', is_active: 1, school_id: 7 },
  });
  const backend = new MySqlAuthBackend({ pool });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-auth-mysql-'));
  const auth = new AuthService(dir, { authBackend: backend });

  const account = await auth.login('mara@school.test', 'correct horse teacher');
  assert.deepEqual(account, {
    id: 'teacher_42',
    username: 'mara@school.test',
    displayName: 'Mara Vale',
    accountType: 'teacher',
    role: 'teacher',
    schoolId: '7',
  });
  await assert.rejects(() => auth.register('new_user', 'long enough password', 'New'), /school account system/);

  const sid = await auth.issueSession(account);
  const req = { headers: { cookie: 'bc_session=' + encodeURIComponent(sid) } };
  assert.deepEqual(auth.authenticateRequest(req), {
    id: 'teacher_42',
    username: 'mara@school.test',
    displayName: 'Mara Vale',
    accountType: 'teacher',
    role: 'teacher',
    schoolId: '7',
  });
  const restarted = new AuthService(dir, { authBackend: null });
  assert.equal(restarted.authenticateRequest(req).id, 'teacher_42');
  restarted.stop();
  auth.stop();
});

test('MySQL auth backend preserves admin teacher role and resolves linked school', async () => {
  const hash = await bcrypt.hash('correct horse admin', 10);
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/FROM teachers/i.test(sql)) return [[{
        id: 7,
        name: 'School Admin',
        email: 'admin.personal@gmail.com',
        password_hash: hash,
        role: 'admin',
        is_active: 1,
        school_id: 12,
        domain: null,
      }]];
      if (/FROM schools WHERE id = \?/i.test(sql)) return [[{ id: 12, name: 'Town Academy', domain: 'town.ac.uk' }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.login('admin.personal@gmail.com', 'correct horse admin');
  assert.equal(account.id, 'teacher_7');
  assert.equal(account.accountType, 'teacher');
  assert.equal(account.role, 'admin');
  assert.equal(account.schoolId, '12');
  assert.equal(account.schoolName, 'Town Academy');
  assert.equal(calls.some(call => /FROM schools WHERE id = \?/i.test(call.sql) && call.params[0] === 12), true);
});

test('MySQL auth backend resolves teacher school from teacher domain when school_id is blank', async () => {
  const hash = await bcrypt.hash('correct horse domain admin', 10);
  const pool = {
    async execute(sql, params) {
      if (/FROM teachers/i.test(sql)) return [[{
        id: 8,
        name: 'Domain Admin',
        email: 'domain.admin@gmail.com',
        password_hash: hash,
        role: 'admin',
        is_active: 1,
        school_id: null,
        domain: 'town.ac.uk',
      }]];
      if (/FROM schools WHERE id = \?/i.test(sql)) return [[]];
      if (/FROM schools WHERE LOWER\(domain\) = \?/i.test(sql) && params[0] === 'town.ac.uk') return [[{ id: 12, name: 'Town Academy', domain: 'town.ac.uk' }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.login('domain.admin@gmail.com', 'correct horse domain admin');
  assert.equal(account.id, 'teacher_8');
  assert.equal(account.role, 'admin');
  assert.equal(account.schoolId, '12');
  assert.equal(account.schoolName, 'Town Academy');
});

test('MySQL auth backend falls through to students and rejects inactive teachers', async () => {
  const studentHash = await bcrypt.hash('correct horse student', 10);
  const pool = fakeMysqlPool({
    teacher: { id: 2, name: 'Inactive', email: 'shared@test.school', password_hash: await bcrypt.hash('teacher password', 10), role: 'teacher', is_active: 0, school_id: 1 },
    student: { id: 9, name: 'Kirito', email: 'Shared@Test.school', password_hash: studentHash, school_id: 1 },
  });
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.login('shared@test.school', 'correct horse student');
  assert.equal(account.id, 'student_9');
  assert.equal(account.accountType, 'student');
  assert.equal(account.role, 'student');
});

test('MySQL auth backend accepts PHP 2y bcrypt hashes', async () => {
  const hash = (await bcrypt.hash('correct horse php', 10)).replace('$2b$', '$2y$');
  assert.equal(normalizeBcryptHash(hash).startsWith('$2b$'), true);
  const backend = new MySqlAuthBackend({
    pool: fakeMysqlPool({
      student: { id: 3, name: 'PHP User', email: 'php@test.school', password_hash: hash, school_id: null },
    }),
  });
  const account = await backend.login('php@test.school', 'correct horse php');
  assert.equal(account.id, 'student_3');
});

test('MySQL auth backend resolves existing personal-email students through their school row', async () => {
  const hash = await bcrypt.hash('correct horse personal', 10);
  const calls = [];
  const pool = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (/FROM teachers/i.test(sql)) return [[]];
      if (/FROM students/i.test(sql)) return [[{
        id: 17,
        name: 'Legacy Learner',
        email: 'learner.personal@gmail.com',
        password_hash: hash,
        school_id: 12,
      }]];
      if (/FROM schools WHERE id = \?/i.test(sql)) return [[{ id: 12, name: 'Town Academy', domain: 'town.ac.uk' }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.login('learner.personal@gmail.com', 'correct horse personal');
  assert.equal(account.id, 'student_17');
  assert.equal(account.username, 'learner.personal@gmail.com');
  assert.equal(account.schoolId, '12');
  assert.equal(account.schoolName, 'Town Academy');
  assert.equal(calls.some(call => /FROM schools WHERE id = \?/i.test(call.sql) && call.params[0] === 12), true);
});

test('MySQL auth backend falls back to school email domain when student school_id is blank', async () => {
  const hash = await bcrypt.hash('correct horse domain', 10);
  const pool = {
    async execute(sql) {
      if (/FROM teachers/i.test(sql)) return [[]];
      if (/FROM students/i.test(sql)) return [[{
        id: 18,
        name: 'Domain Learner',
        email: 'learner@town.ac.uk',
        password_hash: hash,
        school_id: null,
      }]];
      if (/FROM schools WHERE id = \?/i.test(sql)) return [[]];
      if (/FROM schools WHERE LOWER\(domain\) = \?/i.test(sql)) return [[{ id: 12, name: 'Town Academy', domain: 'town.ac.uk' }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.login('learner@town.ac.uk', 'correct horse domain');
  assert.equal(account.id, 'student_18');
  assert.equal(account.schoolId, '12');
  assert.equal(account.schoolName, 'Town Academy');
});

test('MySQL student registration inserts a bcrypt student account with optional year group', async () => {
  const inserts = [];
  const pool = {
    async execute(sql, params) {
      if (/^SHOW COLUMNS FROM students/i.test(sql)) return [[
        { Field: 'id' }, { Field: 'name' }, { Field: 'email' }, { Field: 'password_hash' },
        { Field: 'school_id' }, { Field: 'year_group' }, { Field: 'last_active' },
      ]];
      if (/FROM teachers/i.test(sql)) return [[]];
      if (/FROM students/i.test(sql)) return [[]];
      if (/FROM schools/i.test(sql)) return [[{ id: 12, name: 'Test School', domain: 'school.test' }]];
      if (/^INSERT INTO students/i.test(sql)) {
        inserts.push({ sql, params });
        return [{ insertId: 77 }];
      }
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.registerStudent({
    email: 'new.player@school.test',
    yearGroup: 'Year 8',
    password: 'correct horse student',
  });
  assert.equal(account.id, 'student_77');
  assert.equal(account.username, 'new.player@school.test');
  assert.equal(account.schoolId, '12');
  assert.equal(account.yearGroup, 'Year 8');
  assert.equal(account.yearGroupSaved, true);
  assert.match(inserts[0].sql, /`year_group`/);
  assert.match(inserts[0].sql, /`last_active`/);
  assert.equal(inserts[0].params[0], 'New Player');
  assert.equal(inserts[0].params[1], 'new.player@school.test');
  assert.equal(await bcrypt.compare('correct horse student', inserts[0].params[2]), true);
  assert.equal(inserts[0].params[3], 12);
  assert.equal(inserts[0].params[4], 'Year 8');
});

test('MySQL student registration works when students has no year_group column', async () => {
  let insert = null;
  const pool = {
    async execute(sql, params) {
      if (/^SHOW COLUMNS FROM students/i.test(sql)) return [[
        { Field: 'id' }, { Field: 'name' }, { Field: 'email' }, { Field: 'password_hash' }, { Field: 'school_id' },
      ]];
      if (/FROM teachers/i.test(sql)) return [[]];
      if (/FROM students/i.test(sql)) return [[]];
      if (/FROM schools/i.test(sql)) return [[{ id: 9, name: 'Yearless School', domain: 'school.test' }]];
      if (/^INSERT INTO students/i.test(sql)) {
        insert = { sql, params };
        return [{ insertId: 78 }];
      }
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  const account = await backend.registerStudent({
    email: 'yearless@school.test',
    yearGroup: 'Year 7',
    password: 'correct horse student',
  });
  assert.equal(account.id, 'student_78');
  assert.equal(account.yearGroupSaved, false);
  assert.doesNotMatch(insert.sql, /year_group/);
});

test('MySQL student registration rejects email domains without a matching school', async () => {
  const pool = {
    async execute(sql) {
      if (/FROM teachers/i.test(sql)) return [[]];
      if (/FROM students/i.test(sql)) return [[]];
      if (/FROM schools/i.test(sql)) return [[]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const backend = new MySqlAuthBackend({ pool });
  await assert.rejects(() => backend.registerStudent({
    email: 'new.player@unknown.test',
    yearGroup: 'Year 8',
    password: 'correct horse student',
  }), /could not find a school/);
});

function teacherSubjectRows(sql, subject = { id: 5, name: 'Computer Science', code: 'CS', school_id: 12 }) {
  if (/FROM subjects s/i.test(sql) || /FROM subjects\s/i.test(sql)) return [[subject]];
  return null;
}

test('MySQL game question store creates the game_question table and teacher-owned questions', async () => {
  const calls = [];
  let inserted = null;
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      const subjectRows = teacherSubjectRows(sql);
      if (subjectRows) return subjectRows;
      if (/^INSERT INTO game_question/i.test(sql)) {
        inserted = { sql, params };
        return [{ insertId: 44 }];
      }
      if (/FROM game_question gq/i.test(sql) && /WHERE gq\.id = \?/i.test(sql)) return [[{
        id: 44,
        school_id: 12,
        subject_id: 5,
        subject_name: 'Computer Science',
        subject_code: 'CS',
        teacher_id: 7,
        topic: 'Algorithms',
        stage: 'KS3',
        difficulty: 2,
        spec: 'game-recall',
        prompt: 'Which step should an algorithm make clear?',
        answers: JSON.stringify(['Input', 'Decoration', 'Luck', 'Noise']),
        correct_index: 0,
        explanation: 'Algorithms need clear inputs and steps so they can be followed.',
        review_status: 'teacher-reviewed',
        is_active: 1,
      }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const account = { id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' };
  const question = await store.createQuestion(account, {
    subjectId: 5,
    topic: 'Algorithms',
    stage: 'KS3',
    difficulty: 2,
    spec: 'game-recall',
    prompt: 'Which step should an algorithm make clear?',
    answers: ['Input', 'Decoration', 'Luck', 'Noise'],
    correct: 0,
    explanation: 'Algorithms need clear inputs and steps so they can be followed.',
    reviewStatus: 'teacher-reviewed',
  });
  assert.equal(question.id, 44);
  assert.equal(question.subjectId, 5);
  assert.equal(question.reviewStatus, 'teacher-reviewed');
  assert.deepEqual(question.answers, ['Input', 'Decoration', 'Luck', 'Noise']);
  assert.match(calls[0].sql, /CREATE TABLE IF NOT EXISTS game_question/);
  assert.match(inserted.sql, /INSERT INTO game_question/);
  assert.equal(inserted.params[0], 12);
  assert.equal(inserted.params[1], 5);
  assert.equal(inserted.params[2], 7);
});

test('MySQL game question store lists a shared subject question bank', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_question_attempt/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      const subjectRows = teacherSubjectRows(sql);
      if (subjectRows) return subjectRows;
      if (/FROM game_question gq/i.test(sql) && /LEFT JOIN teachers t/i.test(sql)) return [[{
        id: 45,
        school_id: 12,
        subject_id: 5,
        subject_name: 'Computer Science',
        subject_code: 'CS',
        teacher_id: 9,
        creator_name: 'Other Teacher',
        creator_email: 'other@example.com',
        topic: 'Networks',
        stage: 'KS3',
        difficulty: 1,
        spec: 'routers',
        prompt: 'What forwards packets between networks?',
        answers: JSON.stringify(['Router', 'Printer', 'Speaker', 'Mouse']),
        correct_index: 0,
        explanation: 'Routers forward packets between networks.',
        review_status: 'approved',
        is_active: 1,
      }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const account = { id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' };
  const questions = await store.listQuestions(account, { subjectId: 5 });
  const listCall = calls.find(call => /FROM game_question gq/i.test(call.sql) && /ORDER BY gq\.updated_at/i.test(call.sql));
  assert.ok(listCall);
  assert.doesNotMatch(listCall.sql, /gq\.teacher_id\s*=\s*\?/i);
  assert.match(listCall.sql, /gq\.subject_id = \?/);
  assert.match(listCall.sql, /gq\.school_id IS NULL OR gq\.school_id = \?/);
  assert.equal(questions[0].teacherId, 9);
  assert.equal(questions[0].creatorName, 'Other Teacher');
});

test('MySQL game question store records Recall attempts for student analytics', async () => {
  const inserts = [];
  const pool = {
    async execute(sql, params = []) {
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      if (/SELECT id, school_id FROM subjects/i.test(sql)) return [[{ id: 5, school_id: 12 }]];
      if (/SELECT id FROM game_question/i.test(sql)) return [[]];
      if (/SELECT class_id FROM students/i.test(sql)) return [[]];
      if (/SELECT class_id FROM student_classes/i.test(sql)) return [[]];
      if (/SELECT class_id FROM class_students/i.test(sql)) return [[]];
      if (/FROM game_homework gh/i.test(sql)) return [[]];
      if (/^INSERT INTO game_question_attempt/i.test(sql)) {
        inserts.push({ kind: 'attempt', sql, params });
        return [{ insertId: 88 }];
      }
      if (/^INSERT INTO game_question/i.test(sql)) {
        inserts.push({ kind: 'question', sql, params });
        return [{ insertId: 44 }];
      }
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const result = await store.recordRecallAttempt(
    { id: 'student_9', accountType: 'student', role: 'student', schoolId: '12' },
    {
      subject: 'Computer Science',
      stage: 'KS3',
      topic: 'Algorithms',
      difficulty: 1,
      spec: 'DfE-KS3-algorithms',
      prompt: 'What is an algorithm?',
      answers: ['Steps', 'Code', 'A wire', 'A password'],
      correctIndex: 0,
      answerIndex: 1,
      correct: false,
      durationMs: 4200,
      source: 'recall',
    },
  );
  assert.equal(result.recorded, true);
  assert.equal(result.questionId, 44);
  assert.equal(inserts[0].kind, 'question');
  assert.equal(inserts[0].params[0], 12);
  assert.equal(inserts[0].params[1], 5);
  assert.equal(inserts[1].kind, 'attempt');
  assert.equal(inserts[1].params[2], 44);
  assert.equal(inserts[1].params[3], 9);
  assert.equal(inserts[1].params[5], 1);
  assert.equal(inserts[1].params[6], 0);
});

test('MySQL game question store counts Recall attempts toward active homework', async () => {
  const progressWrites = [];
  const pool = {
    async execute(sql, params = []) {
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      if (/SELECT id, school_id FROM subjects/i.test(sql)) return [[{ id: 5, school_id: 12 }]];
      if (/SELECT id FROM game_question/i.test(sql)) return [[{ id: 44 }]];
      if (/SELECT class_id FROM students/i.test(sql)) return [[{ class_id: 3 }]];
      if (/SELECT class_id FROM student_classes/i.test(sql)) return [[]];
      if (/SELECT class_id FROM class_students/i.test(sql)) return [[]];
      if (/^INSERT INTO game_question_attempt/i.test(sql)) return [{ insertId: 88 }];
      if (/^INSERT INTO game_homework_progress/i.test(sql)) {
        progressWrites.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
      if (/FROM game_homework_progress/i.test(sql)) return [[{
        homework_id: 12,
        period_key: 'day:2026-07-29',
        answered_count: 1,
        completed_at: null,
        last_answered_at: null,
      }]];
      if (/FROM game_homework gh/i.test(sql)) return [[{
        id: 12,
        school_id: 12,
        subject_id: 5,
        subject_name: 'Computer Science',
        subject_code: 'CS',
        teacher_id: 7,
        class_id: 3,
        class_name: '8A',
        title: 'Binary practice',
        cadence: 'daily',
        due_date: null,
        weekly_day: null,
        question_count: 5,
        status: 'live',
        notes: '',
      }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const result = await store.recordRecallAttempt(
    { id: 'student_9', accountType: 'student', role: 'student', schoolId: '12' },
    {
      subject: 'Computer Science',
      stage: 'KS3',
      topic: 'Binary',
      difficulty: 1,
      prompt: 'What is binary?',
      answers: ['Base two', 'Base ten', 'A wire', 'A password'],
      correctIndex: 0,
      answerIndex: 0,
      correct: true,
      durationMs: 1800,
      source: 'recall',
    },
  );
  assert.equal(result.recorded, true);
  assert.equal(progressWrites.length, 1);
  assert.equal(progressWrites[0].params[0], 12);
  assert.equal(progressWrites[0].params[4], 9);
  assert.equal(result.homeworkObjectives.length, 1);
  assert.equal(result.homeworkObjectives[0].title, 'Binary practice');
  assert.equal(result.homeworkObjectives[0].answeredCount, 1);
  assert.equal(result.homeworkObjectives[0].questionCount, 5);
});

test('MySQL game question store credits active homework when tutorial Recall subject differs', async () => {
  const progressWrites = [];
  let homeworkQueries = 0;
  const pool = {
    async execute(sql, params = []) {
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      if (/SELECT id, school_id FROM subjects/i.test(sql)) return [[{ id: 8, school_id: 12 }]];
      if (/SELECT id FROM game_question/i.test(sql)) return [[{ id: 55 }]];
      if (/SELECT class_id FROM students/i.test(sql)) return [[{ class_id: 3 }]];
      if (/SELECT class_id FROM student_classes/i.test(sql)) return [[]];
      if (/SELECT class_id FROM class_students/i.test(sql)) return [[]];
      if (/^INSERT INTO game_question_attempt/i.test(sql)) return [{ insertId: 89 }];
      if (/^INSERT INTO game_homework_progress/i.test(sql)) {
        progressWrites.push({ sql, params });
        return [{ affectedRows: 1 }];
      }
      if (/FROM game_homework_progress/i.test(sql)) return [[{
        homework_id: 12,
        period_key: 'day:2026-07-29',
        answered_count: 1,
        completed_at: null,
        last_answered_at: null,
      }]];
      if (/FROM game_homework gh/i.test(sql)) {
        homeworkQueries++;
        const isSubjectFiltered = params.includes(8);
        if (isSubjectFiltered) return [[]];
        return [[{
          id: 12,
          school_id: 12,
          subject_id: 5,
          subject_name: 'Computer Science',
          subject_code: 'CS',
          teacher_id: 7,
          class_id: 3,
          class_name: '8A',
          title: 'Binary practice',
          cadence: 'daily',
          due_date: null,
          weekly_day: null,
          question_count: 5,
          status: 'live',
          notes: '',
        }]];
      }
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const result = await store.recordRecallAttempt(
    { id: 'student_9', accountType: 'student', role: 'student', schoolId: '12' },
    {
      subject: 'English',
      stage: 'KS3',
      topic: 'Reading',
      difficulty: 1,
      prompt: 'What does infer mean?',
      answers: ['Work out from clues', 'Copy exactly', 'Spell aloud', 'Draw a map'],
      correctIndex: 0,
      answerIndex: 0,
      correct: true,
      durationMs: 1800,
      source: 'tutorial',
    },
  );
  assert.equal(result.recorded, true);
  assert.equal(homeworkQueries >= 3, true);
  assert.equal(progressWrites.length, 1);
  assert.equal(progressWrites[0].params[0], 12);
  assert.equal(progressWrites[0].params[2], 5);
  assert.equal(result.homeworkObjectives[0].answeredCount, 1);
});

test('MySQL game question store creates scheduled homework for teacher classes', async () => {
  let inserted = null;
  const pool = {
    async execute(sql, params = []) {
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      const subjectRows = teacherSubjectRows(sql);
      if (subjectRows) return subjectRows;
      if (/^INSERT INTO game_homework/i.test(sql)) {
        inserted = { sql, params };
        return [{ insertId: 12 }];
      }
      if (/FROM game_homework gh/i.test(sql) && /WHERE gh\.id = \?/i.test(sql)) return [[{
        id: 12,
        school_id: 12,
        subject_id: 5,
        subject_name: 'Computer Science',
        subject_code: 'CS',
        teacher_id: 7,
        class_id: 3,
        class_name: '8A',
        title: 'Networks retrieval',
        cadence: 'weekly',
        due_date: null,
        weekly_day: 2,
        question_count: 12,
        status: 'scheduled',
        notes: 'Focus on routers and DNS.',
      }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const homework = await store.createHomework(
    { id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' },
    { subjectId: 5, classId: 3, title: 'Networks retrieval', cadence: 'weekly', weeklyDay: 2, questionCount: 12, notes: 'Focus on routers and DNS.' },
  );
  assert.equal(homework.id, 12);
  assert.equal(homework.cadence, 'weekly');
  assert.equal(homework.weeklyDay, 2);
  assert.equal(homework.questionCount, 12);
  assert.match(inserted.sql, /INSERT INTO game_homework/);
  assert.equal(inserted.params[3], 3);
  assert.equal(inserted.params[6], null);
  assert.equal(inserted.params[7], 2);
  assert.equal(inserted.params[8], 12);
});

test('MySQL game question store discovers subjects and classes through class teacher ownership', async () => {
  const pool = {
    async execute(sql, params = []) {
      if (/SELECT DISTINCT s\.id/i.test(sql) && /JOIN classes c ON c\.id = cs\.class_id AND c\.teacher_id = \?/i.test(sql)) {
        assert.equal(params[0], 7);
        return [[{ id: 5, name: 'Computer Science', code: 'CS', school_id: 12 }]];
      }
      if (/SELECT DISTINCT c\.id/i.test(sql) && /WHERE c\.teacher_id = \?/i.test(sql)) {
        assert.equal(params[0], 5);
        assert.equal(params[1], 7);
        return [[{ id: 3, name: '8A', join_code: 'JOIN8A', is_active: 1 }]];
      }
      return [[]];
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const account = { id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' };
  const subjects = await store.listSubjects(account);
  assert.deepEqual(subjects, [{ id: 5, name: 'Computer Science', code: 'CS', schoolId: 12 }]);
  const classes = await store.listClasses(account, 5);
  assert.deepEqual(classes, [{ id: 3, name: '8A', joinCode: 'JOIN8A', active: true }]);
});

test('MySQL game question store discovers multiple subjects through class_teachers ownership', async () => {
  const queries = [];
  const pool = {
    async execute(sql, params = []) {
      queries.push({ sql, params });
      if (/JOIN class_teachers ct ON ct\.class_id = cs\.class_id AND ct\.teacher_id = \?/i.test(sql)) {
        assert.equal(params[0], 7);
        return [[
          { id: 5, name: 'Computer Science', code: 'CS', school_id: 12 },
          { id: 6, name: 'Mathematics', code: 'MATH', school_id: 12 },
        ]];
      }
      return [[]];
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const subjects = await store.listSubjects({ id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' });
  assert.deepEqual(subjects, [
    { id: 5, name: 'Computer Science', code: 'CS', schoolId: 12 },
    { id: 6, name: 'Mathematics', code: 'MATH', schoolId: 12 },
  ]);
  assert.ok(queries.some(q => /class_teachers/i.test(q.sql)));
});

test('MySQL game question store does not fall back to unrelated classes for subject filters', async () => {
  const queries = [];
  const pool = {
    async execute(sql, params = []) {
      queries.push({ sql, params });
      if (/SELECT DISTINCT s\.id/i.test(sql) && /FROM subjects s/i.test(sql)) {
        return [[{ id: 5, name: 'Computer Science', code: 'CS', school_id: 12 }]];
      }
      if (/SELECT DISTINCT c\.id/i.test(sql) && /FROM classes c/i.test(sql)) return [[]];
      return [[]];
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const classes = await store.listClasses({ id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' }, 5);
  assert.deepEqual(classes, []);
  assert.equal(queries.some(q => /FROM classes c\s+WHERE \(c\.school_id IS NULL OR \? = 0 OR c\.school_id = \?\)/i.test(q.sql)), false);
});

test('MySQL game question store lists student subjects from assigned classes', async () => {
  const queries = [];
  const pool = {
    async execute(sql, params = []) {
      queries.push({ sql, params });
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      if (/SELECT class_id FROM students/i.test(sql)) return [[{ class_id: 3 }]];
      if (/SELECT class_id FROM student_classes/i.test(sql)) return [[]];
      if (/SELECT class_id FROM class_students/i.test(sql)) return [[]];
      if (/JOIN class_subjects cs ON cs.subject_id = s.id/i.test(sql)) return [[
        { id: 5, name: 'Computer Science', code: 'CS', school_id: 12 },
        { id: 6, name: 'Maths', code: 'MATH', school_id: 12 },
      ]];
      if (/JOIN classes c ON c.subject_id = s.id/i.test(sql)) return [[]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const subjects = await store.listStudentSubjects({ id: 'student_9', accountType: 'student', role: 'student', schoolId: '12' });
  assert.deepEqual(subjects, [
    { id: 5, name: 'Computer Science', code: 'CS', schoolId: 12 },
    { id: 6, name: 'Maths', code: 'MATH', schoolId: 12 },
  ]);
  assert.ok(queries.some(q => /class_subjects/i.test(q.sql)));
});

test('MySQL game question analytics includes class students with zero attempts', async () => {
  const pool = {
    async execute(sql, params = []) {
      if (/CREATE TABLE IF NOT EXISTS game_question/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS teacher_curriculum_request/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework/i.test(sql)) return [{ affectedRows: 0 }];
      if (/CREATE TABLE IF NOT EXISTS game_homework_progress/i.test(sql)) return [{ affectedRows: 0 }];
      const subjectRows = teacherSubjectRows(sql);
      if (subjectRows) return subjectRows;
      if (/FROM students s WHERE s\.class_id = \?/i.test(sql)) {
        assert.equal(params[0], 3);
        return [[
          { id: 9, name: 'Learner One', email: 'one@example.test', school_id: 12 },
          { id: 10, name: 'Learner Zero', email: 'zero@example.test', school_id: 12 },
        ]];
      }
      if (/FROM students s JOIN student_classes/i.test(sql)) return [[]];
      if (/FROM students s JOIN class_students/i.test(sql)) return [[]];
      if (/gqa\.id AS attempt_id/i.test(sql)) return [[{
        attempt_id: 101,
        student_id: 9,
        student_name: 'Learner One',
        student_email: 'one@example.test',
        account_id: 'student_9',
        answer_index: 1,
        correct: 0,
        duration_ms: 4200,
        source: 'recall',
        created_at: '2026-07-27 10:00:00',
        question_id: 44,
        topic: 'Binary',
        stage: 'KS3',
        prompt: 'What is binary?',
        answers: JSON.stringify(['Base two', 'Base ten', 'A wire', 'A password']),
        correct_index: 0,
      }, {
        attempt_id: 102,
        student_id: 9,
        student_name: 'Learner One',
        student_email: 'one@example.test',
        account_id: 'student_9',
        answer_index: 0,
        correct: 1,
        duration_ms: 2500,
        source: 'recall',
        created_at: '2026-07-27 09:00:00',
        question_id: 44,
        topic: 'Binary',
        stage: 'KS3',
        prompt: 'What is binary?',
        answers: JSON.stringify(['Base two', 'Base ten', 'A wire', 'A password']),
        correct_index: 0,
      }]];
      if (/LEFT JOIN schools sc ON sc\.id = gqa\.school_id/i.test(sql)) return [[{
        school_id: 12,
        school_name: 'Town Academy',
        attempts: 2,
        correct: 1,
      }, {
        school_id: 14,
        school_name: 'River School',
        attempts: 4,
        correct: 3,
      }]];
      if (/FROM game_question_attempt gqa/i.test(sql)) return [[{
        student_id: 9,
        student_name: 'Learner One',
        student_email: 'one@example.test',
        attempts: 2,
        correct: 1,
        last_attempt_at: '2026-07-27 10:00:00',
      }]];
      if (/FROM game_question gq/i.test(sql)) return [[{
        id: 44,
        topic: 'Binary',
        stage: 'KS3',
        prompt: 'What is binary?',
        review_status: 'approved',
        attempts: 2,
        correct: 1,
      }]];
      throw new Error('unexpected SQL: ' + sql);
    },
  };
  const store = new MySqlGameQuestionStore({ pool });
  const analytics = await store.analytics(
    { id: 'teacher_7', accountType: 'teacher', role: 'teacher', schoolId: '12' },
    { subjectId: 5, classId: 3, days: 30 },
  );
  assert.equal(analytics.students.length, 2);
  const zero = analytics.students.find(row => row.id === 10);
  assert.equal(zero.name, 'Learner Zero');
  assert.equal(zero.attempts, 0);
  assert.equal(zero.accuracy, 0);
  assert.equal(analytics.totals.attempts, 2);
  assert.equal(analytics.totals.correct, 1);
  assert.equal(analytics.totals.wrong, 1);
  assert.deepEqual(analytics.topicSummaries.map(row => ({ name: row.name, correct: row.correct, wrong: row.wrong, accuracy: row.accuracy })), [
    { name: 'Binary', correct: 1, wrong: 1, accuracy: 50 },
  ]);
  assert.equal(analytics.studentTopicSummaries[0].topic, 'Binary');
  assert.equal(analytics.attempts[0].answerText, 'Base ten');
  assert.equal(analytics.attempts[0].correctAnswer, 'Base two');
  assert.equal(analytics.schoolComparisons.length, 2);
  assert.equal(analytics.schoolComparisons.find(row => row.id === 12).ownSchool, true);
});

test('MySQL game question store rejects non-teacher accounts and malformed answers', async () => {
  const store = new MySqlGameQuestionStore({ pool: { async execute() { return [[]]; } } });
  await assert.rejects(
    () => store.listSubjects({ id: 'student_9', accountType: 'student', role: 'student', schoolId: '12' }),
    /Teacher account required/,
  );
  assert.throws(
    () => store.normalizeQuestionPatch({
      prompt: 'What is a good test question?',
      answers: ['A', 'A', 'B', 'C'],
      explanation: 'Duplicate answers should not pass validation.',
    }),
    /four unique answers/,
  );
});
