const { defineConfig } = require('@playwright/test');

const PORT = 2607;
const RUN_TERRAIN_PERF = process.env.TERRAIN_PERF === '1';

module.exports = defineConfig({
  testDir: './e2e',
  // The profession/job feature is intentionally disabled for this release.
  // Only retired job-only journeys are excluded. Fresh-account onboarding,
  // reconnect, persistence, early-loop, and transition recovery remain part
  // of the default release browser gate.
  testIgnore: [
    '**/blacksmith-tutorial.spec.js',
    '**/cook-tutorial.spec.js',
    '**/farmer-tutorial.spec.js',
    '**/job-contract-loop.spec.js',
    '**/miner-monk-tutorial.spec.js',
    '**/pet-tamer-tutorial.spec.js',
    // This measures renderer timing, not functional behavior. Keep it out of
    // the blocking release gate unless the benchmark is explicitly requested.
    ...(RUN_TERRAIN_PERF ? [] : ['**/terrain-performance.spec.js']),
  ],
  timeout: 45_000,
  // Connection-readiness polls (`status().connected`) flake under the cumulative
  // load of running every heavy WebGL spec sequentially on one worker: the room
  // and connect handshake are fine in isolation but occasionally exceed the 5s
  // expect default late in the suite. Give polls the same 15s headroom the
  // reconnect/restart specs already use.
  expect: { timeout: 15_000 },
  // The 15s headroom removes most flakes, but the client's *bounded* socket
  // reconnect (4 backoff attempts, ~3.75s) can still exhaust under load, which no
  // poll timeout can rescue. These are load-induced flakes — every spec passes in
  // isolation — so retry them. Deterministic regressions fail all attempts and are
  // still caught; only genuine load flakes are rescued.
  retries: 2,
  workers: 1,
  globalSetup: require.resolve('./e2e/global-setup.cjs'),
  use: { baseURL: `http://127.0.0.1:${PORT}`, headless: true, viewport: { width: 800, height: 600 } },
});
