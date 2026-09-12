# Crowded combat: atlas pass and corrected benchmark â€” 2026-09-12

Status: AMBER. The corrected SwiftShader fixture now meets the 33.3 ms native p95 frame-interval target, but representative physical-device validation is still outstanding.

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

## Crowded-combat focus pass

The client now enters a hysteretic combat-focus tier at 12 hostile mobs within 24 m and exits below eight. It requests the high-performance WebGL context, reduces internal resolution to 0.5, moves ambient-only simulation and presentation to 15 Hz, limits ordinary labels and ground rings, and distance-culls ordinary villagers outside 12 m. Combat simulation, networking, projectiles, particles, damage numbers, health bars, boss UI data, and ground telegraphs remain active.

Mara, the Aegis Guardian, shrine, building signs, and portal arches now use emissive-compatible texture atlases and rigid batching. Ordinary enemies retain their full animated model outside crowded combat and use an atlas-backed merged voxel silhouette inside it. Warning circles use a preallocated 32-ring pool, avoiding geometry allocation during attacks.

Latest corrected 24-mob run on the same headless SwiftShader fixture:

| Metric | Before focus pass | Latest |
| --- | ---: | ---: |
| Native p95 frame interval | 66.6 ms | **31.2 ms** |
| Native peak draw calls | ~1,679 | **577** |
| Native p95 render submission | 8.5 ms | **6.4 ms** |
| 4× CPU p95 frame interval | 227.2 ms | **155.7 ms** |

The native target passed in that run. SwiftShader's 4× mode throttles both game code and the software renderer, so it is retained as a 200 ms regression guard rather than treated as a physical-device 33.3 ms acceptance result.

## Validation and reproduction

907 unit tests passed, including triangle-position/UV mapping, animated pivots, the crowded-model proxy, and combat tint controls. Build, lint and formatting passed. The corrected browser performance gate passes its 33.3 ms native target and 200 ms artificial-stress regression guard on the recorded run.

```powershell
$env:COMBAT_PERF='1'
$env:COMBAT_DISABLE_ATLAS='1'
npx playwright test e2e/combat-performance.spec.js --retries=0 --reporter=line
$env:COMBAT_DISABLE_ATLAS='0'
npx playwright test e2e/combat-performance.spec.js --retries=0 --reporter=line
```

COMBAT_CPU_PROFILE=1 records CPU profiles. COMBAT_MAX_FRAME_P95_MS changes the native threshold and COMBAT_STRESS_MAX_FRAME_P95_MS changes the artificial 4× SwiftShader regression guard; do not use either override to claim a physical-device pass. Recorded runs used an isolated local E2E server on port 2649.

Next: measure this corrected scene on hardware WebGL, then attribute the remaining town draw calls to scenery categories before changing detail density. Validate sustained real multiplayer separately; this fixture disconnects networking and does not measure server latency or remote-player animation.
