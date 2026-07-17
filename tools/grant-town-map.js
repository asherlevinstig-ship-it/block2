#!/usr/bin/env node

const admin = require('firebase-admin');
const { parseFirebaseServiceAccountFromEnv } = require('../server/firebase-credentials');

const TOWN_MAP_ID = 217;
const INV_MAX = 36;

function init() {
  if (admin.apps.length) return;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  admin.initializeApp(svc
    ? { credential: admin.credential.cert(parseFirebaseServiceAccountFromEnv(process.env)) }
    : {});
}

function hasTownMap(inv) {
  return Array.isArray(inv) && inv.some(slot => slot && (slot.id | 0) === TOWN_MAP_ID && (slot.count | 0) > 0);
}

function addTownMap(inv) {
  const next = Array.isArray(inv) ? inv.slice(0, INV_MAX) : [];
  if (hasTownMap(next)) return { inv: next, added: false, full: false };
  for (let i = 0; i < next.length; i++) {
    if (next[i]) continue;
    next[i] = { id: TOWN_MAP_ID, count: 1 };
    return { inv: next, added: true, full: false };
  }
  if (next.length < INV_MAX) {
    next.push({ id: TOWN_MAP_ID, count: 1 });
    return { inv: next, added: true, full: false };
  }
  return { inv: next, added: false, full: true };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  init();
  const db = admin.firestore();
  const snap = await db.collection('players').get();
  const writer = dryRun ? null : db.bulkWriter();
  let scanned = 0, alreadyHad = 0, updated = 0, full = 0;

  for (const doc of snap.docs) {
    scanned++;
    const profile = doc.data() || {};
    const result = addTownMap(profile.inv);
    if (!result.added && !result.full) { alreadyHad++; continue; }
    if (result.full) {
      full++;
      continue;
    }
    updated++;
    if (writer) {
      writer.update(doc.ref, {
        inv: result.inv,
        townMapClaimed: true,
        savedAt: Date.now(),
      });
    }
  }

  if (writer) await writer.close();
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    scanned,
    updated,
    alreadyHad,
    full,
  }, null, 2));
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
