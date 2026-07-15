const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFirebaseServiceAccount } = require('../firebase-credentials');

test('Firebase service account private keys are normalized from env JSON', () => {
  const raw = JSON.stringify({
    project_id: 'solo-test',
    client_email: 'firebase-adminsdk@test.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n',
  });
  const credential = parseFirebaseServiceAccount(raw);
  assert.equal(credential.project_id, 'solo-test');
  assert.equal(credential.private_key, '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n');
});

test('Firebase service account validation reports missing fields', () => {
  assert.throws(
    () => parseFirebaseServiceAccount('{}', 'FIREBASE_SERVICE_ACCOUNT'),
    /missing service-account field project_id/,
  );
});
