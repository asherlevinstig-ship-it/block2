const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function parseTrustProxy(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) {
    const hops = Number(raw);
    if (hops >= 1 && hops <= 10) return hops;
  }
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return raw;
}

function validateServiceAccount(raw, source) {
  let credential;
  try { credential = JSON.parse(raw); }
  catch (e) { throw new Error(source + ' must contain valid JSON: ' + e.message); }
  for (const field of ['project_id', 'client_email', 'private_key']) {
    if (typeof credential[field] !== 'string' || !credential[field].trim()) throw new Error(source + ' is missing service-account field ' + field);
  }
  if (!credential.private_key.includes('BEGIN PRIVATE KEY')) throw new Error(source + ' does not contain a valid private key');
}

function summarizeStartupEnv(env = process.env) {
  const serviceAccount = String(env.FIREBASE_SERVICE_ACCOUNT || '');
  return {
    NODE_ENV: env.NODE_ENV || '',
    PUBLIC_URL: env.PUBLIC_URL || '',
    TRUST_PROXY: env.TRUST_PROXY || '',
    DATA_DIR: env.DATA_DIR || '',
    STORE: env.STORE || '',
    AUTH_BACKEND: env.AUTH_BACKEND || '',
    MYSQL_HOST: env.MYSQL_HOST || '',
    MYSQL_PORT: env.MYSQL_PORT || '',
    MYSQL_DATABASE: env.MYSQL_DATABASE ? '<set>' : '',
    MYSQL_USER: env.MYSQL_USER ? '<set>' : '',
    MYSQL_PASSWORD: env.MYSQL_PASSWORD ? '<set>' : '',
    CLIENT_ORIGIN: env.CLIENT_ORIGIN || '',
    CLIENT_ORIGINS: env.CLIENT_ORIGINS || '',
    GOOGLE_APPLICATION_CREDENTIALS: env.GOOGLE_APPLICATION_CREDENTIALS ? '<set>' : '',
    FIREBASE_SERVICE_ACCOUNT: serviceAccount ? '<set length=' + serviceAccount.length + '>' : '',
  };
}

async function assertWritableDirectory(dir) {
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (e) {
    throw new Error('DATA_DIR is not writable (' + dir + '): ' + e.message);
  }
  const probe = path.join(dir, '.blockcraft-write-' + crypto.randomBytes(8).toString('hex'));
  const moved = probe + '.renamed';
  try {
    await fs.promises.writeFile(probe, 'ok', { flag: 'wx' });
    await fs.promises.rename(probe, moved);
    await fs.promises.unlink(moved);
  } catch (e) {
    await fs.promises.unlink(probe).catch(() => {});
    await fs.promises.unlink(moved).catch(() => {});
    throw new Error('DATA_DIR is not writable with atomic rename support (' + dir + '): ' + e.message);
  }
}

async function validateStartup(env = process.env) {
  const production = String(env.NODE_ENV || '').toLowerCase() === 'production';
  const storage = String(env.STORE || 'json').toLowerCase();
  if (!['json', 'firebase'].includes(storage)) throw new Error('STORE must be either json or firebase');
  const authBackend = String(env.AUTH_BACKEND || 'file').toLowerCase();
  if (!['file', 'mysql'].includes(authBackend)) throw new Error('AUTH_BACKEND must be either file or mysql');
  const dataDir = path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data'));
  const trustProxy = parseTrustProxy(env.TRUST_PROXY);

  if (production) {
    let publicUrl;
    try { publicUrl = new URL(env.PUBLIC_URL); }
    catch (_) { throw new Error('PUBLIC_URL must be an absolute HTTPS URL in production'); }
    if (publicUrl.protocol !== 'https:') throw new Error('PUBLIC_URL must use HTTPS in production');
    if (!env.TRUST_PROXY || trustProxy === false) throw new Error('TRUST_PROXY must declare the HTTPS reverse proxy in production');
    if (trustProxy === true) throw new Error('TRUST_PROXY=true trusts arbitrary forwarding headers; use a hop count, IP, or subnet');
    if (/^\d+$/.test(String(env.TRUST_PROXY).trim()) && typeof trustProxy !== 'number') throw new Error('TRUST_PROXY hop count must be between 1 and 10');
    if (!env.DATA_DIR) throw new Error('DATA_DIR must be explicitly configured in production');
    for (const flag of ['DEV_CHEATS', 'BLOCKCRAFT_BETA_TEST', 'BLOCKCRAFT_E2E']) {
      if (env[flag] === '1') throw new Error(flag + ' must not be enabled in production');
    }
  }

  if (storage === 'firebase') {
    if (env.FIREBASE_SERVICE_ACCOUNT) validateServiceAccount(env.FIREBASE_SERVICE_ACCOUNT, 'FIREBASE_SERVICE_ACCOUNT');
    else if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      let raw;
      try { raw = await fs.promises.readFile(path.resolve(env.GOOGLE_APPLICATION_CREDENTIALS), 'utf8'); }
      catch (e) { throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not readable: ' + e.message); }
      validateServiceAccount(raw, 'GOOGLE_APPLICATION_CREDENTIALS');
    } else if (production) throw new Error('Firebase production storage requires FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS');
  }

  if (authBackend === 'mysql') {
    for (const field of ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']) {
      if (!String(env[field] || '').trim()) throw new Error('AUTH_BACKEND=mysql requires ' + field);
    }
  }

  // DATA_DIR is still used for auth sessions and JSON storage fallback.
  await assertWritableDirectory(dataDir);
  return { production, storage, dataDir, trustProxy };
}

module.exports = { validateStartup, parseTrustProxy, assertWritableDirectory, validateServiceAccount, summarizeStartupEnv };
