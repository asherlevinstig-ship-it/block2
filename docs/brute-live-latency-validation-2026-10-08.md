# Brute live latency validation — 2026-10-08

Build: `melee-sweep-v46`; room type: `world-melee-sweep-v18`.
Endpoint: existing Cloudflare `/game` proxy to the live Colyseus server.

## Method

Four disposable guests in separate live rooms, with no profile tokens, mining,
equipment changes, or attacks. Script: `tools/validate-live-brute.mjs`.
Guests walked from spawn to the stone brute, then either stood still, walked
sideways on the received aim-lock cue, waited another 200 ms before walking
sideways, or dodged on the received aim-lock cue. Ping/pong measured real RTT.
Walking sideways used a 600 ms command window and a direction perpendicular
to the committed yaw. Arrival was close range, approximately 1.0 block after
the brute's release lunge. These tests do not establish outcomes at all ranges.

## Measurements

All times below are client-observed packet/state receipt intervals, not exact
server execution times. State patches and damage messages have different
scheduling, so intervals should not be treated as server hitbox timings.

| Scenario | Median RTT | Windup to release | Aim lock to release | Release to recovery end | Brute damage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stationary | 297 ms | 1161 ms | 233 ms | 844 ms | 3 |
| Immediate walking sidestep | 294 ms | 1158 ms | 232 ms | 865 ms | 3 |
| Walking sidestep 200 ms later | 296 ms | 1172 ms | 243 ms | 870 ms | 3 |
| Immediate dodge | 302 ms | 1150 ms | 221 ms | 885 ms | 0 |

Isolated room IDs, respectively: `xd4zKuDUC`, `xRRLccEDV`, `Itxa53AqA`,
`O2vfQiexn`. These rooms are no longer joined by the test guests.

The immediate walking trial also took 1 damage from a briar crawler during
approach; its separate brute hit message confirmed 3 brute damage. No combat
balance inference is based on final total health alone.

Committed yaw equalled release yaw in all four encounters. Yaw changed again
after recovery, as expected when the mob resumed tracking the player.

## Findings

- Authoritative telegraph duration and recovery agree with the configured
  1150 ms windup and 850 ms recovery, allowing patch/tick scheduling variation.
- Aim commitment survives until release; no last-moment homing was observed.
- Close-range walking sidesteps on the received aim-lock cue did not evade in
  these two trials at roughly 300 ms RTT. This is not proof that every walking
  sidestep fails, but it fails to validate that cue as a reliable walking escape.
- A dodge on the received aim-lock cue did evade in the single dodge trial.
- The server labels the mob `recover` immediately on release, although its
  damaging strike is still pending. The brute contact window starts 210 ms
  after release and ends 380 ms after release (nominal impact 280 ms).
- The client only shows the warning in `windup`; it therefore disappears while
  the attack can still damage the player.
- `updateMobVisual` starts `createBruteSlamImpact` on receipt of the release
  action sequence: ring, audio, and camera shake fire before blade contact.
- Attack animation starts from packet receipt (`performance.now()`), not an
  authoritative attack timestamp. Its brute peak is 280 ms after that receipt.
  The stationary damage message arrived 179 ms after observed release, while
  the client's nominal animation peak would be 280 ms after observed release.
  Thus the current visual peak can follow the damage message. This comparison
  is code-plus-packet evidence, not a recorded rendered visual playtest.

## RAG and next action

Overall: **Amber**. Authoritative phase timing and committed direction passed
this limited live check. Dodge counterplay passed once. Close-range walking
counterplay remains Amber; contact feedback timing is **Red**.

Recommended next implementation: separate strike-active from recovery, send
authoritative attack-start/contact timestamps with a clock-offset estimate,
retain the directional danger cue through the contact window, and trigger the
slam VFX/audio on contact rather than release. Re-test both sidestep directions,
multiple distances, repeated trials, and higher/jittering RTT afterwards.

No gameplay code was changed or deployed during this validation. Earlier test
controller attempts that fell into the cave or oscillated during navigation
were discarded and are not included in the results.
