#!/usr/bin/env node

const admin = require('firebase-admin');

const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log([
    'Usage: node tools/wipe-firestore.js [--dry-run] [--only=a,b,c] [--force]',
    '',
    'Environment:',
    '  GOOGLE_APPLICATION_CREDENTIALS=path-to-service-account.json',
    '  or FIREBASE_SERVICE_ACCOUNT=service-account-json',
    '',
    'Deletion requires:',
    '  CONFIRM_FIRESTORE_DELETE=DELETE_<projectId> and --force',
  ].join('\n'));
  process.exit(0);
}
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const onlyArg = process.argv.find(arg => arg.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map(s => s.trim()).filter(Boolean)) : null;

function init() {
  if (admin.apps.length) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  admin.initializeApp(svc
    ? { credential: admin.credential.cert(JSON.parse(svc)) }
    : {});
}

async function deleteQueryBatch(db, query, batchSize, stats) {
  const snap = await query.limit(batchSize).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach(doc => {
    batch.delete(doc.ref);
    stats.deleted++;
  });
  await batch.commit();
  return snap.size;
}

async function deleteCollection(db, collectionRef, stats, batchSize = 250) {
  const subcollections = new Map();
  const docs = await collectionRef.limit(batchSize).get();
  for (const doc of docs.docs) {
    for (const sub of await doc.ref.listCollections()) subcollections.set(sub.path, sub);
  }
  for (const sub of subcollections.values()) await deleteCollection(db, sub, stats, batchSize);
  while (await deleteQueryBatch(db, collectionRef.orderBy('__name__'), batchSize, stats)) {}
}

async function countCollection(collectionRef, stats, batchSize = 500) {
  let cursor = null;
  for (;;) {
    let query = collectionRef.orderBy('__name__').limit(batchSize);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    if (snap.empty) break;
    stats.documents += snap.size;
    for (const doc of snap.docs) {
      cursor = doc;
      for (const sub of await doc.ref.listCollections()) await countCollection(sub, stats, batchSize);
    }
    if (snap.size < batchSize) break;
  }
}

async function main() {
  init();
  const db = admin.firestore();
  const projectId = admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
  const collections = (await db.listCollections()).filter(col => !only || only.has(col.id));

  if (!collections.length) {
    console.log(only ? 'No matching root collections found.' : 'No root collections found.');
    return;
  }

  console.log('Firestore project:', projectId || '(unknown)');
  console.log('Collections:', collections.map(col => col.id).join(', '));

  if (dryRun) {
    const stats = { documents: 0 };
    for (const col of collections) await countCollection(col, stats);
    console.log('Dry run only. Matching documents:', stats.documents);
    return;
  }

  const expected = 'DELETE_' + projectId;
  if (!force || !projectId || process.env.CONFIRM_FIRESTORE_DELETE !== expected) {
    console.error('Refusing to delete Firestore data.');
    console.error('Run the dry-run first, then set CONFIRM_FIRESTORE_DELETE=' + expected + ' and pass --force.');
    process.exitCode = 1;
    return;
  }

  const stats = { deleted: 0 };
  for (const col of collections) {
    console.log('Deleting collection:', col.id);
    await deleteCollection(db, col, stats);
  }
  console.log('Deleted documents:', stats.deleted);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
