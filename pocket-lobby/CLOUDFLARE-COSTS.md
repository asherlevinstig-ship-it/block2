# Cloudflare efficiency

Quiet gambling now resolves up to two minutes of rounds together through the normal server engine. Stakes, total-loss limits, profit targets, reserve gold, maximum rounds and Luck awards remain checked for each round. A player viewing the character or joining its room wakes the actor immediately. Returning to manual play settles due rounds before stopping the plan. Resting wakes at completion instead of polling every two seconds.

Fishing retains its existing reservation-bounded catch batches. Tree cuts and ore strikes stay individually timed and atomically committed against the shared resource revision. These cannot safely be replaced by isolated offline yield estimates: other players can cut the same tree or mine the same deposit. Their preparatory pose updates now avoid a duplicate room-activity request because the actor publishes that pose itself.

Actor storage is written only when its persisted data changes. Duplicate registration reads do not rewrite it or reset the usage clock. Player settlement writes only if the final state changes (or a version migration is required). Purchases, real rewards and shared resource changes still commit immediately.

Room lease renewal persists the lease but does not broadcast an unchanged player. Empty rooms do not load tree snapshots merely to renew an Auto lease. Expiry, shared resource changes, viewer arrival and visual changes still update observers.

## Heartbeats and security

The exact ping/pong exchange uses Cloudflare's hibernation auto-response API. Heartbeats cannot modify game state. Each occupied room checks session validity at least once a minute; gameplay packets also recheck after 15 seconds, and expired sessions are rejected immediately on receipt. Logout/revocation therefore stops passive room updates within at most a minute. Empty rooms have no session-check timer. This bounds security checks without waking once per idle socket every 25 seconds.

Reference: https://developers.cloudflare.com/durable-objects/api/state/#setwebsocketautoresponse

## Player-hour measurements

Auto logs `auto_usage_v1` sampled at 5%, with weight 20, elapsed player milliseconds, previous phase/audience and operation counts. Quiet batches count their full elapsed time. Unchanged sync requests neither rewrite the timer nor erase elapsed time. Manual room sessions emit `player_usage_v1` on the room's minute check, activity or exit, also sampled at 5%. An Auto owner's socket is excluded to prevent double counting. Logs contain no player names, IDs or session credentials.

Manual hours mean connected manual-play time, including the short idle period before Auto activates; they are not a count of input events. Sampling estimates can be noisy at low traffic. Interrupted log exports, abrupt room resets and window edges can omit partial intervals. Do not present a short live tail as a daily player-hour total.

Export the complete matching interval from Workers Logs (the account needs historical observability access). Use aggregate Cloudflare analytics from the same interval. The report tool deliberately omits resource-per-player-hour ratios unless a matching window is explicitly supplied:

```
node pocket-lobby/scripts/usage-report.mjs --logs logs.json --metrics analytics.json --window "2026-11-12 UTC" --output usage-report.json
```

Analytics input accepts the GraphQL account payload with `todayWorker`, `todayObjects`, `todayDuration` and `todayD1` arrays, or the complete GraphQL response containing that account. `--prefix yesterday` selects corresponding previous-day arrays. Reports separate manual and Auto hours, split Auto by phase/audience, and calculate blended requests, GB-seconds and database rows per total player-hour. Resource usage cannot be accurately divided between manual and Auto from these aggregate datasets; the report does not invent that split or an invoice.

## Repeatable scaling check

```
node pocket-lobby/scripts/benchmark-auto.mjs --output auto-benchmark.json
```

This simulates one hour for 1, 10 and 100 gambling players, observed and unobserved, plus resting. It runs the real actor/settlement code against SQLite and counts alarms, reads, writes and room requests. It also returns each player to settle the final partial batch and verifies 120 rounds per hour. Room transport and time are simulated: this is an operation-count regression benchmark, not evidence that Cloudflare supports a given concurrent population or latency.

The recorded run in `benchmarks/auto-2026-11-11.json` completed all three populations. Per gambling player-hour, observed/unbatched mode used 120 alarms and 120 player-state writes; quiet mode used 30 alarms and 31 player-state writes, including final return settlement. All cases resolved 120 rounds per player. The two-minute resting case completed with one alarm. These figures exclude real transport, session checks and contention between shared resources.

Compare production resource units per player-hour over matching windows before projecting a monthly cost. Cloudflare bills Durable Object requests and duration above plan allowances; included usage, rounding, storage and other products affect the final invoice. Pricing reference: https://developers.cloudflare.com/durable-objects/platform/pricing/

## Combat scheduling

Auto combat now uses the same event clock as server combat replay: player/enemy strikes, attack-warning locks, burns, enemy thinking, add waves and add actions, mana/cooldown-based spells, dodges and retreat decisions. It sleeps until the next event instead of checking every 500 ms. A 50 ms delivery window groups closely spaced events; the replay engine still applies each event at its exact original timestamp. Walking boundaries and presence lease renewal still bound long waits.

An expired Auto session cap requests that the current fight finish. It is no longer reused as a past alarm deadline while that fight resolves. Combat player-time measurement includes this finishing period. Manual combat/input and the dungeon's zone transitions are unchanged.

```
node pocket-lobby/scripts/benchmark-combat.mjs --output combat-benchmark.json
```

The recorded local run in `benchmarks/combat-2026-11-11.json` compares real actor/SQLite settlement with the previous 500 ms schedule. The starter boar used 8 rather than 10 alarms and 9 rather than 11 state reads, with identical health, combat outcome, XP and loot. Actor storage writes fell from 11 to 9; player-state writes were 8 rather than 7 because events are delivered more promptly. Safety retreat delivery took 200 rather than 500 ms with the same logical action time and outcome. Tests also compare exact combat-event sequences for seven enemy types, including reinforcement waves and the final guardian, and enforce an operation-count budget for starter combat.

This is not a promise that every encounter is cheaper: a busy boss may have meaningful events more frequently than the old poll. Production combat cost must be measured separately from other phases over a comparable traffic window. These local counts are not an invoice or an Internet latency measurement.
