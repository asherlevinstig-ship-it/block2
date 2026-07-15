function parseFirebaseServiceAccount(raw, source = 'FIREBASE_SERVICE_ACCOUNT') {
  let credential;
  try { credential = JSON.parse(String(raw || '').trim()); }
  catch (e) { throw new Error(source + ' must contain valid JSON: ' + e.message); }
  for (const field of ['project_id', 'client_email', 'private_key']) {
    if (typeof credential[field] !== 'string' || !credential[field].trim()) throw new Error(source + ' is missing service-account field ' + field);
  }
  credential.private_key = credential.private_key
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!credential.private_key.includes('BEGIN PRIVATE KEY')) throw new Error(source + ' does not contain a valid private key');
  if (!credential.private_key.endsWith('\n')) credential.private_key += '\n';
  return credential;
}

module.exports = { parseFirebaseServiceAccount };
