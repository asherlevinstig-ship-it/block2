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
    + ' rejects=' + (totals.rejectedMessages || 0)
    + ' disconnects=' + (totals.disconnects || 0)
    + ' loopP99Ms=' + (eventLoop.p99Ms || 0)
    + ' heapUsedMb=' + (memory.heapUsedMb || 0);
}

function run(label, script, env, metricsPort) {
  return new Promise((resolve, reject) => {
    console.log('\n=== ' + label + ' ===');
    let peakMetrics = null;
    const poll = setInterval(async () => {
      const snapshot = await fetchMetrics(metricsPort);
      if (snapshot && snapshot.totals && snapshot.totals.rooms > 0) {
        const score = (snapshot.totals.clients || 0) * 1000 + (snapshot.totals.rooms || 0);
        const peakScore = peakMetrics ? (peakMetrics.totals.clients || 0) * 1000 + (peakMetrics.totals.rooms || 0) : -1;
        if (score >= peakScore) peakMetrics = snapshot;
      }
    }, 1000);
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
      console.log('Peak metrics snapshot: ' + summarizeMetrics(peakMetrics));
      if (code !== 0) return reject(new Error(label + ' failed with exit code ' + code));
      if (!peakMetrics) return reject(new Error(label + ' did not expose performance metrics'));
      resolve();
    });
  });
}

async function main() {
  const maxP99Ms = envNumber('PERF_MAX_P99_MS', 75);
  const maxHeapMb = envNumber('PERF_MAX_HEAP_MB', 96);
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

  for (const [label, script, env, metricsPort] of checks) await run(label, script, env, metricsPort);
  console.log('\nPerformance budget suite passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
