const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { parseFirebaseServiceAccount, normalizePrivateKey } = require('../firebase-credentials');

function serviceAccount(privateKey) {
  return JSON.stringify({
    project_id: 'solo-test',
    client_email: 'firebase-adminsdk@test.iam.gserviceaccount.com',
    private_key: privateKey,
  });
}

test('Firebase service account private keys are normalized from env JSON', () => {
  const privateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const raw = serviceAccount(privateKey.replace(/\n/g, '\\n'));
  const credential = parseFirebaseServiceAccount(raw);
  assert.equal(credential.project_id, 'solo-test');
  assert.equal(credential.private_key, normalizePrivateKey(privateKey));
  assert.doesNotThrow(() => crypto.createPrivateKey({ key: credential.private_key, format: 'pem' }));
});

test('Firebase service account private keys recover from flattened PEM text', () => {
  const privateKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const flattened = privateKey.replace(/\r?\n/g, '');
  const credential = parseFirebaseServiceAccount(serviceAccount(flattened));
  assert.equal(credential.private_key, normalizePrivateKey(privateKey));
  assert.doesNotThrow(() => crypto.createPrivateKey({ key: credential.private_key, format: 'pem' }));
});

test('Firebase service account validation reports missing fields', () => {
  assert.throws(
    () => parseFirebaseServiceAccount('{}', 'FIREBASE_SERVICE_ACCOUNT'),
    /missing service-account field project_id/,
  );
});
