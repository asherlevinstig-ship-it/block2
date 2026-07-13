const { spawn } = require('node:child_process');
const http = require('node:http');

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return String(Number.isFinite(value) && value > 0 ? value : fallback);
}

function fetchMetrics(port) {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path: '/__metrics', timeout: 750 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(response.statusCode === 200 ? JSON.parse(body) : null); }
        catch (_) { resolve(null); }
      });
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
  });
}

function summarizeMetrics(snapshot) {
  if (!snapshot) return 'no metrics snapshot captured';
  const totals = snapshot.totals || {};
  const eventLoop = snapshot.eventLoop || {};
  const memory = snapshot.memory || {};
  return 'rooms=' + (totals.rooms || 0)
    + ' clients=' + (totals.clients || 0)
    + ' inbound=' + (totals.inboundMessages || 0)
    + ' outbound=' + (totals.outboundMessages || 0)
    + ' outboundKBps=' + Math.round(((totals.outboundBytesPerSecond || 0) / 1024) * 100) / 100
    + ' peakClientKBps=' + Math.round(((totals.outboundPeakClientBytesPerSecond || 0) / 1024) * 100) / 100
    + ' rejects=' + (totals.rejectedMessages || 0)
    + ' disconnects=' + (totals.disconnects || 0)
    + ' visibleMobLinks=' + (totals.visibleMobLinks || 0)
    + ' hiddenMobLinksAvoided=' + (totals.hiddenMobLinksAvoided || 0)
    + ' avgVisibleMobs=' + (totals.avgVisibleMobsPerDungeonClient || 0)
    + ' viewChurn=' + ((totals.interestViewAdds || 0) + (totals.interestViewRemoves || 0))
    + ' fxSent=' + (totals.dungeonFxSent || 0)
    + ' fxSkipped=' + (totals.dungeonFxSkipped || 0)
    + ' loopP99Ms=' + (eventLoop.p99Ms || 0)
    + ' heapUsedMb=' + (memory.heapUsedMb || 0);
}

function mergePeakMetrics(loadSnapshot, interestSnapshot, bandwidthSnapshot) {
  if (!loadSnapshot || !interestSnapshot && !bandwidthSnapshot) return loadSnapshot || interestSnapshot || bandwidthSnapshot;
  const loadTotals = loadSnapshot && loadSnapshot.totals || {};
  const interestTotals = interestSnapshot && interestSnapshot.totals || {};
  const bandwidthTotals = bandwidthSnapshot && bandwidthSnapshot.totals || {};
  return {
    ...loadSnapshot,
    totals: {
      ...loadTotals,
      visibleMobLinks: interestTotals.visibleMobLinks || 0,
      hiddenMobLinksAvoided: interestTotals.hiddenMobLinksAvoided || 0,
      avgVisibleMobsPerDungeonClient: interestTotals.avgVisibleMobsPerDungeonClient || 0,
      interestViewAdds: interestTotals.interestViewAdds || 0,
      interestViewRemoves: interestTotals.interestViewRemoves || 0,
      dungeonFxSent: interestTotals.dungeonFxSent || 0,
      dungeonFxSkipped: interestTotals.dungeonFxSkipped || 0,
      outboundBytesPerSecond: bandwidthTotals.outboundBytesPerSecond || loadTotals.outboundBytesPerSecond || 0,
      outboundPeakClientBytesPerSecond: bandwidthTotals.outboundPeakClientBytesPerSecond || loadTotals.outboundPeakClientBytesPerSecond || 0,
    },
  };
}

function run(label, script, env, metricsPort, budgets) {
  return new Promise((resolve, reject) => {
    console.log('\n=== ' + label + ' ===');
    let peakMetrics = null;
    let peakInterestMetrics = null;
    let peakBandwidthMetrics = null;
    const poll = setInterval(async () => {
      const snapshot = await fetchMetrics(metricsPort);
      if (snapshot && snapshot.totals && snapshot.totals.rooms > 0) {
        const score = (snapshot.totals.clients || 0) * 1000 + (snapshot.totals.rooms || 0);
        const peakScore = peakMetrics ? (peakMetrics.totals.clients || 0) * 1000 + (peakMetrics.totals.rooms || 0) : -1;
        if (score >= peakScore) peakMetrics = snapshot;
        const interestScore = (snapshot.totals.hiddenMobLinksAvoided || 0) + (snapshot.totals.visibleMobLinks || 0) + (snapshot.totals.dungeonFxSkipped || 0);
        const peakInterestScore = peakInterestMetrics ? (peakInterestMetrics.totals.hiddenMobLinksAvoided || 0) + (peakInterestMetrics.totals.visibleMobLinks || 0) + (peakInterestMetrics.totals.dungeonFxSkipped || 0) : -1;
        if (interestScore >= peakInterestScore) peakInterestMetrics = snapshot;
        const bandwidthScore = snapshot.totals.outboundBytesPerSecond || 0;
        const peakBandwidthScore = peakBandwidthMetrics ? peakBandwidthMetrics.totals.outboundBytesPerSecond || 0 : -1;
        if (bandwidthScore >= peakBandwidthScore) peakBandwidthMetrics = snapshot;
      }
    }, 500);
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, BLOCKCRAFT_METRICS: '1', ...env },
    });
    child.on('error', error => {
      clearInterval(poll);
      reject(error);
    });
    child.on('exit', code => {
      clearInterval(poll);
      const merged = mergePeakMetrics(peakMetrics, peakInterestMetrics, peakBandwidthMetrics);
      console.log('Peak metrics snapshot: ' + summarizeMetrics(merged));
      if (code !== 0) return reject(new Error(label + ' failed with exit code ' + code));
      if (!peakMetrics) return reject(new Error(label + ' did not expose performance metrics'));
      const kbps = ((peakBandwidthMetrics && peakBandwidthMetrics.totals && peakBandwidthMetrics.totals.outboundBytesPerSecond) || 0) / 1024;
      const peakClientKbps = ((peakBandwidthMetrics && peakBandwidthMetrics.totals && peakBandwidthMetrics.totals.outboundPeakClientBytesPerSecond) || 0) / 1024;
      if (kbps > budgets.maxOutboundKbps) return reject(new Error(label + ' outbound bandwidth ' + kbps.toFixed(2) + ' KB/s exceeded budget ' + budgets.maxOutboundKbps + ' KB/s'));
      if (peakClientKbps > budgets.maxOutboundClientKbps) return reject(new Error(label + ' peak client bandwidth ' + peakClientKbps.toFixed(2) + ' KB/s exceeded budget ' + budgets.maxOutboundClientKbps + ' KB/s'));
      resolve();
    });
  });
}

async function main() {
  const maxP99Ms = envNumber('PERF_MAX_P99_MS', 75);
  const maxHeapMb = envNumber('PERF_MAX_HEAP_MB', 96);
  const bandwidthBudgets = {
    maxOutboundKbps: Number(envNumber('PERF_MAX_OUTBOUND_KBPS', 2048)),
    maxOutboundClientKbps: Number(envNumber('PERF_MAX_OUTBOUND_CLIENT_KBPS', 96)),
  };
  const shardPort = envNumber('PERF_SHARD_PORT', 2631);
  const dungeonPort = envNumber('PERF_DUNGEON_PORT', 2632);
  const soakPort = envNumber('PERF_SOAK_PORT', 2633);
  const checks = [
    ['Shard load budget', 'tools/shard-load-test.js', {
      SHARD_LOAD_PORT: shardPort,
      SHARD_LOAD_DURATION_MS: envNumber('PERF_SHARD_DURATION_MS', 8_000),
      SHARD_LOAD_MAX_P99_MS: envNumber('PERF_SHARD_MAX_P99_MS', maxP99Ms),
      SHARD_LOAD_MAX_HEAP_MB: envNumber('PERF_SHARD_MAX_HEAP_MB', maxHeapMb),
    }, Number(shardPort)],
    ['Dungeon load budget', 'tools/dungeon-load-test.js', {
      DUNGEON_LOAD_PORT: dungeonPort,
      DUNGEON_LOAD_DURATION_MS: envNumber('PERF_DUNGEON_DURATION_MS', 8_000),
      DUNGEON_LOAD_MAX_P99_MS: envNumber('PERF_DUNGEON_MAX_P99_MS', maxP99Ms),
      DUNGEON_LOAD_MAX_HEAP_MB: envNumber('PERF_DUNGEON_MAX_HEAP_MB', maxHeapMb),
    }, Number(dungeonPort)],
    ['Mixed online soak budget', 'tools/online-soak-test.js', {
      SOAK_PORT: soakPort,
      SOAK_DURATION_MS: envNumber('PERF_SOAK_DURATION_MS', 20_000),
      SOAK_MAX_P99_MS: envNumber('PERF_SOAK_MAX_P99_MS', maxP99Ms),
      SOAK_MAX_HEAP_MB: envNumber('PERF_SOAK_MAX_HEAP_MB', 160),
    }, Number(soakPort)],
  ];

  for (const [label, script, env, metricsPort] of checks) await run(label, script, env, metricsPort, bandwidthBudgets);
  console.log('\nPerformance budget suite passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
