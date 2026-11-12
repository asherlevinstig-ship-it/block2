# Cloudflare efficiency

## Action Points and disconnected Auto

Characters have a separate 100-point Action Point meter. Manual and Auto play use the same budget: one point per catch, timber cut, ore award, exploration stop, table round, crafting/rest action, player attack or ability. Travelling into another area costs one point; walking within an area is free. Attacks and abilities replace the former one-point-per-fight charge. Shopping, selling, menus and equipment changes remain free. Auto journeys debit on actual server-driven door crossings, with a saved receipt preventing repeat charges after actor retries. The last affordable action keeps its reward; batches cannot process extra actions after depletion.

When Auto reaches zero, the server cancels unfinished work, saves rewards, moves the character to a walkable home tile, removes its room presence and fishing reservation, and closes its room connection. Auto actors delete their alarms and the director excludes disconnected characters. The browser stops polling and reconnecting until the player chooses Return to game. Earning points never restarts Auto while disconnected. Manual players remain connected at zero, but cannot perform paid actions until they earn another point. Enemy actions and defensive movement, dodges and fleeing remain free.

Points are earned only by submitting in-game MCQs: one point per submitted attempt, whether correct or incorrect, capped at 100. There is no timed refill or refill alarm. New characters start at zero; existing balances are retained. Question creation and answer submission use explicit player requests, with no question polling. Attempts and rewards are server-owned, revision checked, and cannot be replayed or minted through save snapshots. Earning points while disconnected does not restart Auto. Historical benchmark reports below predate this budget. The current repeatable gambling benchmark uses a half-hour window (60 rounds), so it measures running Auto without crossing the new 100-point limit.

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

## Unobserved solo hunts

Queued solo Wild Boar and Stoneback Beetle hunts can now settle three seconds of combat together when the character is stationary and its room has confirmed that no player is watching. The normal combat engine processes every due action in timestamp order, including damage, mana, spell cooldowns, dodges, retreat attempts, defeat and victory rewards. No damage or loot is estimated from a rate.

The actor publishes the batch deadline through the existing room-observer protocol. A returning owner or a player entering the room wakes it immediately, settles only actions already due, and restores event scheduling. Recovery reads preserve the deadline instead of extending it. Taking control catches up due combat before requesting the current hunt to finish. A time cap interrupts batching; the finishing fight remains on event scheduling.

Only the encounter owned by the matching active queued hunt is eligible. Dungeon encounters, guardians, reinforcements, mining battles, other enemy types, travel, unknown audience, food trips and requested returns do not batch. This does not enable batching for future shared multiplayer battles. An unobserved result may reach storage up to three seconds later than its logical event time; returning or observing forces an immediate catch-up.

```
node pocket-lobby/scripts/benchmark-quiet-hunting.mjs --output quiet-hunting-benchmark.json
```

The recorded local comparison in `benchmarks/quiet-hunting-2026-11-12.json` checks identical outcomes, HP, XP, loot, spell cooldowns and mana between watched and unobserved runs. Starter boar alarms/player-state writes fall from 8/8 to 3/3; the spell build falls from 8/8 to 2/2; the beetle falls from 5/5 to 3/3. Immediate retreat remains 1/1 and reaching the time cap retains live scheduling. These are per-fixture operation counts, not measured production bill savings. Tests also cover room entry/exit, owner return, taking control, actor recovery, scarce mana, failed escapes, defeat and repeated hunts separated by rest.

## Shared gathering

Tree cuts now increment the current cut count atomically within the expected tree generation. The same database batch pays its player only if that cut's token belongs to that player and the player revision still matches. The player save uses the committed cut count to set the felling receipt and clear pending swings on a felled tree. This replaces repeated read/rebase/retry transactions when many valid cuts finish together. A rejected player revision cannot consume a hit; a failed transaction rolls back both the resource and player reward.

Existing trees and rocks no longer execute an initialization INSERT on every read. Ore strikes read the targeted deposit rather than returning every deposit; full area snapshots are still used for choosing a deposit and for viewers.

Safe quarry mining can prepare the next swing in the accepted strike's player save. Its original two-second pause and swing duration remain intact. The next hit still reads the shared deposit and checks its exact revision before paying; it is discarded if another miner changes the rock. Preparation stops for depletion, completed steps, hunger/food decisions, random-job decisions, goals, time caps and returns. Guarded/deep mining retains the intervening checks. Timestamped poses reach viewers in advance, and the player's sprite waits until the recorded start time to animate.

This batches preparation and resource/player commits, not unverified offline yields. Every awarded tree cut and ore strike still has an individual shared-resource transaction. Viewer arrival reads current resource snapshots. Tree regrowth and rock recovery remain shared.

```
node pocket-lobby/scripts/benchmark-gathering.mjs --output gathering-benchmark.json
```

`benchmarks/gathering-2026-11-12.json` compares an isolated archive of commit `8b718831` with the new code using identical fixtures:

- Twenty Auto woodcutters, including a regrowth/stale-swing check: 484 → 134 write queries, 404 → 188 read queries, 114 → 40 transaction batches; six timber and 60 XP in both runs. A mixed manual/Auto case also preserves all rewards.
- Twenty Auto miners across depletion and regrowth: 1,688 → 456 returned rows by targeting the struck deposit; ore and XP totals match. Returned rows are not Cloudflare's billed rows scanned.
- One mining actor completing three strikes: 5 → 3 alarms, 13 → 7 read queries, 10 → 6 write queries; the cycle remains 17.5 seconds, three ore, 30 XP and three hunger consumed.

Twenty simultaneous HTTP cuts also passed through the local Cloudflare runtime: three accepted, 17 stale rejections, three timber, 30 XP and one felling receipt, with no server errors. The installed emulator required a local compatibility override to 2026-09-25; deployment retains 2026-09-30. These simulations and local checks are not a production capacity test or an invoice estimate.
