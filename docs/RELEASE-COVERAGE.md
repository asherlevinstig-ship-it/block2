# Release coverage map

This map separates release-blocking checks from retired-feature, visual-review, and
hardware-sensitive coverage. A passing group only supports the claims listed here.

## Release gate

Run `npm run check:release`. It combines the static/unit/integration gate with the
default Playwright browser gate.

| Gate | Command | Release claims |
|---|---|---|
| Code and server behavior | `npm run check` | Lint, formatting, dependency audit at high severity, 1,000+ server/client module tests, persistence failure handling, schemas, transport, progression balance, and world invariants. |
| Active browser journeys | `npm run test:e2e` | Fresh-account training and Mara objectives, early crafting, first Gate and ranked Gate progression, reconnect/reload recovery, transition panels, multiplayer continuity, dungeon variants, and active client boot/render flows. |

The fresh-account coverage is `e2e/mara-opening.spec.js`: it creates a new account
without pre-marking onboarding or progression objectives, visits every training lesson
in order, completes the Town Arrival fountain and Question Portal route, then follows
Mara through First Hands, its reward handoff, Road Ready, reload, and the first Gate objective.
Deterministic E2E action hooks shorten individual gameplay actions, but no objective or
progression stage is skipped.

The following formerly excluded active specs are release-blocking again:

- `mara-opening.spec.js`
- `onboarding-first-gate-polish.spec.js`
- `onboarding-journey.spec.js`
- `player-facing-early-loop.spec.js`
- `progression-reconnect.spec.js`
- `town-tutorial-persistence.spec.js`
- `transition-panel-recovery.spec.js`

## Intentionally non-blocking groups

| Group | Command | Why it is separate |
|---|---|---|
| Retired profession journeys | `npm run test:tutorial-jobs` | Farmer, cook, miner, monk, blacksmith, pet-tamer job tutorial, and job-contract flows cannot be entered while professions are disabled. Keep them for reactivation work; they do not describe the live release. |
| Dungeon visual review | Set `VISUAL_REVIEW=1`, then run `npx playwright test e2e/environment-identity.spec.js` | Screenshot and art-direction review is opt-in and environment-sensitive. |
| Crowded combat benchmark | Set `COMBAT_PERF=1`, then run `npx playwright test e2e/combat-performance.spec.js` | CPU/GPU timing is hardware-sensitive. Record renderer, frame-time percentiles, and machine context with results. |
| Terrain browser benchmark | Set `TERRAIN_PERF=1`, then run `npx playwright test e2e/terrain-performance.spec.js` | Frame and chunk-build timing depends on the browser host's CPU/GPU. The default Playwright gate excludes it; record the machine context with results. |
| Load and performance tools | `npm run test:load`, `npm run test:load:dungeons`, `npm run test:perf`, and the other `test:perf:*` scripts | Synthetic capacity and budget probes are useful evidence but are not browser journey coverage. |

## Explicit limitations

A green release gate does not establish 60 FPS, mobile performance, physical-GPU visual
quality, production cloud capacity, or long-duration soak stability. Those require the
corresponding opt-in benchmark or deployment-environment run. Source-text client tests
and stubbed room tests supplement, but never replace, the active Playwright journeys.
