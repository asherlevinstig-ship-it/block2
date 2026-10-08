# Brute walking counterplay — 2026-10-09

Deployed gameplay commit: `bae77cf5`; server build: `brute-counterplay-v49`;
room type: `world-brute-counterplay-v21`.

## Changes

- Brute aim locks 650 ms before release (previously 250 ms).
- The warning footprint comes from the shared swept melee geometry, expanded
  for the player's body, at the collision-safe projected lunge destination.
- The footprint stays visible through the damaging strike window.
- Damage is unchanged. Walls can block an attack inside this conservative
  warning; the marker is not a promise that every highlighted point takes damage.

## Verification

`npm run check` passes: 302 tests, typechecks, and production builds.
Four deterministic room tests cover left/right walking at close range and
outer reach, with 300 ms RTT and 100 ms reaction delay. All avoid damage.
The outer case starts 3.05 blocks away, leaving 2.6 after the 0.45-block lunge.
Separate tests confirm stationary targets still take damage, predicted lunge
origin matches release, and the warning contains sampled successful body hits.

Live guests use separate rooms, no saved profiles, and no mining or attacks.
They wait 100 ms after receiving aim commitment before sending a perpendicular
walking command. Far scenarios first retreat during windup. These are limited
trials, not proof at every range or network condition. Recorded intervals are
client-observed state receipts, not precise server execution timings.

| Scenario | Room | Approx. encounter RTT | Distance at release receipt | Brute damage |
| --- | --- | ---: | ---: | ---: |
| Walk left, close | `mcR183qBw` | 283 ms | 1.29 | 0 |
| Walk right, close | `FAaM5HCWn` | 278–281 ms | 1.37 | 0 |
| Walk left, farther | `reciqPA7q` | 306–308 ms | 2.40 | 0 |
| Walk right, farther, severe jitter | `vearb_YtS` | 753–1755 ms near encounter | Strike state skipped in received patches | 3 |
| Right-side retry, severe jitter | `3HnaZC-_A` | 786–1520 ms near encounter | 1.23 | 3 |

The three stable-latency guests retained 5 HP, observed strike and recovery
ending, and release yaw matched committed yaw. The severe-jitter guest took
3 brute damage; patches skipped directly from windup to recovery. This does
not validate walking counterplay at approximately one-second RTT, and is not
discarded as a passing result. The farther live trial is not an exact
maximum-range measurement; deterministic tests cover outer reach.
The retry also had sustained high latency: commitment arrived with the first
windup patch, leaving no observed tracking phase. It took 3 brute damage and
did not establish a farther-range starting position before release.

Earlier approaches with network spikes or deaths to forest mobs never reached
the brute and are excluded. The controller now approaches around that forest.
Rendered marker appearance has not been visually verified in a browser.
