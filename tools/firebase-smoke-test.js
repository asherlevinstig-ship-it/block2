#!/usr/bin/env node

const admin = require('firebase-admin');
const { parseFirebaseServiceAccountFromEnv } = require('../server/firebase-credentials');

function init() {
  if (admin.apps.length) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  admin.initializeApp(svc
    ? { credential: admin.credential.cert(parseFirebaseServiceAccountFromEnv(process.env)) }
    : {});
}

async function main() {
  init();
  const db = admin.firestore();
  const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '(unknown)';
  const ref = db.collection('setupSmoke').doc('connectivity');
  const payload = { ok: true, at: Date.now(), source: 'blockcraft-firebase-smoke' };

  await ref.set(payload);
  const snap = await ref.get();
  if (!snap.exists || snap.data().source !== payload.source) throw new Error('Firestore smoke read did not match the written document');
  await ref.delete();
  const deleted = await ref.get();
  if (deleted.exists) throw new Error('Firestore smoke cleanup failed');

  console.log('Firestore smoke test passed for project:', projectId);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
