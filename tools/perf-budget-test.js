const { spawn } = require('node:child_process');

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return String(Number.isFinite(value) && value > 0 ? value : fallback);
}

function run(label, script, env) {
  return new Promise((resolve, reject) => {
    console.log('\n=== ' + label + ' ===');
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(label + ' failed with exit code ' + code));
    });
  });
}

async function main() {
  const maxP99Ms = envNumber('PERF_MAX_P99_MS', 75);
  const maxHeapMb = envNumber('PERF_MAX_HEAP_MB', 96);
  const checks = [
    ['Shard load budget', 'tools/shard-load-test.js', {
      SHARD_LOAD_PORT: envNumber('PERF_SHARD_PORT', 2631),
      SHARD_LOAD_DURATION_MS: envNumber('PERF_SHARD_DURATION_MS', 8_000),
      SHARD_LOAD_MAX_P99_MS: envNumber('PERF_SHARD_MAX_P99_MS', maxP99Ms),
      SHARD_LOAD_MAX_HEAP_MB: envNumber('PERF_SHARD_MAX_HEAP_MB', maxHeapMb),
    }],
    ['Dungeon load budget', 'tools/dungeon-load-test.js', {
      DUNGEON_LOAD_PORT: envNumber('PERF_DUNGEON_PORT', 2632),
      DUNGEON_LOAD_DURATION_MS: envNumber('PERF_DUNGEON_DURATION_MS', 8_000),
      DUNGEON_LOAD_MAX_P99_MS: envNumber('PERF_DUNGEON_MAX_P99_MS', maxP99Ms),
      DUNGEON_LOAD_MAX_HEAP_MB: envNumber('PERF_DUNGEON_MAX_HEAP_MB', maxHeapMb),
    }],
    ['Mixed online soak budget', 'tools/online-soak-test.js', {
      SOAK_PORT: envNumber('PERF_SOAK_PORT', 2633),
      SOAK_DURATION_MS: envNumber('PERF_SOAK_DURATION_MS', 20_000),
      SOAK_MAX_P99_MS: envNumber('PERF_SOAK_MAX_P99_MS', maxP99Ms),
      SOAK_MAX_HEAP_MB: envNumber('PERF_SOAK_MAX_HEAP_MB', 160),
    }],
  ];

  for (const [label, script, env] of checks) await run(label, script, env);
  console.log('\nPerformance budget suite passed');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
