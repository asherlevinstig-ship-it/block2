const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');
const { AuthService } = require('../auth');
const { MySqlAuthBackend, normalizeBcryptHash } = require('../mysql-auth');

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
