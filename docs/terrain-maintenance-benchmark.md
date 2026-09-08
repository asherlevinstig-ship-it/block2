# Terrain maintenance benchmark - 2026-09-08

Measured locally with headless Playwright Chromium at 800x600 using
`e2e/terrain-performance.spec.js`: 61 frame samples per phase, 30 edit rebuilds
and 82 streaming rebuilds. Baseline code: 62dd7ea, plus the pre-existing local
terrain-test change removing artificial CPU throttling. Both runs used the same
workload and separately started E2E server on port 2649 because the standard
2607 global setup timed out before starting the test.

| Metric | Before | After |
| --- | ---: | ---: |
| Streaming total chunk CPU | 507.3 ms | 170.4 ms |
| Streaming mesh CPU | 144.6 ms | 136.7 ms |
| Streaming chunk total p95 | 9.8 ms | 4.4 ms |
| Streaming frame p95 | 32.5 ms | 27.7 ms |
| Editing total chunk CPU | 188.8 ms | 69.5 ms |
| Editing chunk total p95 | 8.5 ms | 3.0 ms |
| Editing frame p95 | 25.0 ms | 25.7 ms |
| Idle frame p95 | 22.9 ms | 23.3 ms |

Chunk maintenance consumed most rebuild CPU. Reconcile removed lights by
examining existing light entries, avoiding a coordinate string allocation for
every voxel. Combine light and incubator discovery into one scan, with X as the
inner loop to match DimensionGrid storage. Preserve the light-only refresh API.

This small optimization precedes worker meshing or draw-call batching because
neither dominated the measured rebuild workload. These are single local runs,
not production/mobile performance guarantees. Editing frame time was effectively
unchanged; other update work remains significant. Repeat profiling in a populated
town and on target devices before choosing the next optimization.

Validation: terrain browser budget test, 170 client-module tests (including light
removal, neighboring chunks, negative/partial bounds and incubator discovery),
ESLint, static client build and formatting checks.
