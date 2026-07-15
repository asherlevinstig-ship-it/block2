const crypto = require('crypto');

function normalizePrivateKey(value) {
  let key = String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
  const match = key.match(/-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/);
  if (!match) return key;
  const body = match[1].replace(/[^A-Za-z0-9+/=]/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  key = '-----BEGIN PRIVATE KEY-----\n' + lines.join('\n') + '\n-----END PRIVATE KEY-----\n';
  return key;
}

function parseFirebaseServiceAccount(raw, source = 'FIREBASE_SERVICE_ACCOUNT') {
  let credential;
  try { credential = JSON.parse(String(raw || '').trim()); }
  catch (e) { throw new Error(source + ' must contain valid JSON: ' + e.message); }
  for (const field of ['project_id', 'client_email', 'private_key']) {
    if (typeof credential[field] !== 'string' || !credential[field].trim()) throw new Error(source + ' is missing service-account field ' + field);
  }
  credential.private_key = normalizePrivateKey(credential.private_key);
  if (!credential.private_key.includes('BEGIN PRIVATE KEY')) throw new Error(source + ' does not contain a valid private key');
  try { crypto.createPrivateKey({ key: credential.private_key, format: 'pem' }); }
  catch (e) { throw new Error(source + ' private_key is not a parseable PEM key: ' + e.message); }
  return credential;
}

module.exports = { parseFirebaseServiceAccount, normalizePrivateKey };
