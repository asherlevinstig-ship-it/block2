const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AuthService } = require('../auth');

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

  const sid = auth.issueSession(verified);
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
