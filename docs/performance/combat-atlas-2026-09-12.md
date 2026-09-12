# Crowded combat: atlas pass and corrected benchmark â€” 2026-09-12

Status: AMBER. The 33.3 ms p95 frame-interval target is NOT met. The opt-in benchmark now enforces that target by default, instead of a 100 ms stall threshold.

## Implementation

Zombie and skeleton constructors pack their small Lambert textures into one per-model atlas. UVs preserve individual face textures, and static sibling geometry can now batch across those former material boundaries. Animated pivots remain separate. Combat still controls the model's material list for hit tint and opacity. Basic-material eyes and contact shadows remain separate.

Rigid local transforms are cached after construction; actor roots and animated limbs continue updating. The event HUD's periodic refresh is limited to 10 Hz; existing event-triggered updates remain available.

## Corrected benchmark

The original benchmark used a position inside a town structure and left training-completion UI visible. It also positioned the camera relative to a player whose position could change. Those historical frame intervals should not be treated as representative open-town combat measurements.

The revised test completes and dismisses onboarding, disconnects networking, clears the dimension identifier, fixes the crowd/camera to an open courtyard, sets clear weather and an initial daytime value, and emits effects every 200 ms. Each run renders 24 enemy visuals (16 zombies, 8 skeletons), samples 12 seconds per CPU setting and logs the graphics backend. It supplies enemy yaw and asserts visible models with finite world transforms. The original synthetic payload omitted yaw, producing invalid transforms; earlier runs also counted hidden model records. Those historical timing comparisons are invalid as evidence of rendered-crowd performance.

Fixed-camera canvas captures are taken after timing samples and were visually inspected to confirm the enemies, faces and warning rings render. CPU profiling is optional.

Renderer: ANGLE Vulkan SwiftShader (software rendering), pixel ratio 1, headless Chromium at 800 × 600. CPU throttling on this renderer is not a physical low-end GPU simulation. Run-to-run frame-time variation is substantial.

## Final courtyard comparison

Same corrected fixture with clear weather, valid visible enemies and CPU profiler off. Control disables the atlas through a test-only module route. Both runs retain the small transform/HUD changes, so this comparison isolates the atlas rather than every change in this patch.

| Metric | Atlas disabled | Atlas enabled |
| --- | ---: | ---: |
| Native peak draw calls | 3,451 | 3,034 |
| Native p95 frame interval | 112.0 ms | 91.7 ms |
| Native p95 render submission | 18.3 ms | 15.4 ms |
| 4× CPU peak draw calls | 3,455 | 3,039 |
| 4× CPU p95 frame interval | 306.5 ms | 281.4 ms |
| 4× CPU p95 render submission | 194.4 ms | 170.9 ms |

Native draw calls fell 12.1%. These are individual runs, not statistically established speedups. Both runs fail the 33.3 ms target. Intermediate indoor and courtyard runs had inconsistent weather, camera placement or missing enemy yaw and are superseded by these results. The earlier 74–80 ms claim does not establish crowded-combat performance.

## Validation and reproduction

887 unit tests passed, including triangle-position/UV mapping, animated pivots and combat tint controls. Build, lint and formatting passed. The corrected browser benchmark records results and fails its performance assertion as expected; it is not reported as a passing browser performance gate.

```powershell
$env:COMBAT_PERF='1'
$env:COMBAT_DISABLE_ATLAS='1'
npx playwright test e2e/combat-performance.spec.js --retries=0 --reporter=line
$env:COMBAT_DISABLE_ATLAS='0'
npx playwright test e2e/combat-performance.spec.js --retries=0 --reporter=line
```

COMBAT_CPU_PROFILE=1 records CPU profiles. COMBAT_MAX_FRAME_P95_MS can set a machine-specific threshold; do not use that override to claim the 33.3 ms target passed. Recorded runs used an isolated local E2E server on port 2649.

Next: measure this corrected scene on hardware WebGL, then attribute the remaining town draw calls to scenery categories before changing detail density. Validate sustained real multiplayer separately; this fixture disconnects networking and does not measure server latency or remote-player animation.
