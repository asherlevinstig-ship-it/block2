const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CountingStore, estimateFirestoreCost, getCountingUsageSnapshot,
  resetCountingUsage, subtractUsage,
} = require('../counting-store');

test('CountingStore records Firestore-equivalent profile and packed world operations offline', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-counting-store-'));
  resetCountingUsage();
  const store = new CountingStore(dir, { shardId: 'main' });
  await store.savePlayer('player_1', { name: 'Offline' });
  await store.loadPlayer('player_1');
  await store.saveWorldEditChunks({
    '0_0': { '1,20,1': 3 },
    '8_0': { '129,20,1': 4 },
  });
  const usage = getCountingUsageSnapshot();
  assert.equal(usage.reads, 1);
  assert.equal(usage.writes, 3, 'one profile and two regional pack writes');
  assert.equal(usage.byOperation.saveWorldEditChunks.writes, 2);
  assert.ok(usage.bytesWritten > 0);
});

test('Firestore cost estimate applies the free daily quota before pricing', () => {
  const estimate = estimateFirestoreCost({ reads: 150000, writes: 30000, deletes: 20000 });
  assert.deepEqual(estimate.chargeableDaily, { reads: 100000, writes: 10000, deletes: 0 });
  assert.equal(estimate.dailyUsd, 0.039);
  assert.equal(Math.round(estimate.monthlyUsd * 1000) / 1000, 1.17);
});

test('usage snapshots can be separated into simulation phases', () => {
  assert.deepEqual(
    subtractUsage({ reads: 10, writes: 7, deletes: 1, bytesRead: 50, bytesWritten: 80, calls: 9 },
      { reads: 3, writes: 2, deletes: 0, bytesRead: 20, bytesWritten: 30, calls: 4 }),
    { reads: 7, writes: 5, deletes: 1, bytesRead: 30, bytesWritten: 50, calls: 5 },
  );
});
