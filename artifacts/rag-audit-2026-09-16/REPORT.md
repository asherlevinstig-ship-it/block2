# Blockcraft MP: deep functionality audit

**Date:** 16 September 2026  
**Target:** current working copy based on commit `9c1556b8`, including pre-existing modified and untracked game files.  
**Environment:** Windows, Node 22.17.1, local isolated test servers and temporary test accounts.  
**Overall rating: RED — fix the confirmed item-loss, crafting, and transaction defects before calling this release ready.**

The game has substantial working functionality. Its server-authority checks, multiplayer simulation, ordinary persistence paths, and several complete dungeon journeys have strong automated evidence. However, passing unit tests currently conceal reproducible failures in important player journeys and exceptional conditions. This is a functionality assessment, not a statement that every system is broken.

## How to read the ratings

- **RED:** a reproduced defect blocks an important action, loses player assets/progress, or corrupts progression/accounting. Fix before release.
- **AMBER:** a narrower reproduced issue, a plausible source-backed risk, or a material testing gap. Evidence type is stated explicitly.
- **GREEN:** the specified checks passed and this audit found no blocker in that tested behavior. It does not mean exhaustive proof of correctness.

The audit does not assign an arbitrary percentage to the whole game. A high passing-test percentage cannot offset losing a player's inventory or acknowledging an unsaved transaction.

## 1. Verification results

| Check | Result | Interpretation |
|---|---|---|
| Default automated suite | 999 passed, 0 failed | Strong baseline; includes unit, module, authority and API checks |
| Additional tests omitted from the default command | 5 passed | Firebase credential parsing and Firestore read-budget checks |
| Live two-client integration | 19 checks passed | Real server, WebSockets, replication, authentication and dungeon rooms |
| ESLint | Passed | No configured lint violations |
| Formatting and diff whitespace | Passed | No configured formatting violations at the start of this audit |
| Static delivery budget | Passed | Splash 178 KB; complete client directory 34.02 MB |
| Six-scenario server performance budget | Passed | Load, mob pressure, dungeon replication and 32-client mixed soak |
| Sixteen-player client benchmark | Passed, limited headroom | Median 28 FPS equals the minimum gate; update p90 12.3 ms; render p90 4.1 ms |
| Dependency audit | 18 affected-package entries: 13 moderate, 5 low, 0 high/critical | Plain `npm audit` exits nonzero; the project's high-severity gate is not breached by these results |
| Browser suite | 28 passed, 3 failed, 8 skipped; 9.1 minutes | Two failures share R1; the third is test maintenance, A4 |
| C-to-S diagnostic with result-panel dismissal | Passed in 42.7 seconds | Game source unchanged; original regression test still fails |
| Two-user live event smoke | Passed | Event participation/state flow |
| Pet-tamer live smoke | Passed | Loan, training and return flow |
| Targeted defect probes | 10 isolated scenarios reproduced | Real game methods with controlled in-memory storage/session fixtures |

Evidence is preserved in this directory. `reproduce.cjs` asserts the observed defects; it is deliberately **not** a passing regression suite for the intended behavior. The probes do not modify real player data.

## 2. Functionality map

Ratings apply to the stated slice of behavior. Shared reward and durability faults can affect otherwise working systems.

| System | RAG | What the evidence supports / what remains |
|---|---|---|
| Account registration, login and authenticated room admission | GREEN | Auth tests and live rejection of unauthenticated matchmaking passed |
| Client module startup | GREEN | Browser boots with runtime modules available |
| Loading/error recovery | GREEN | Loading and queued-terrain recovery browser test passed |
| Combat path selection and persistence | GREEN | Path choice survives reload in browser testing |
| Early quest visibility | GREEN | Core objectives remain focused while optional systems remain discoverable |
| Crafting shortcuts and NPC crafting entry | RED | `player.position` crash, R1 |
| Crafting server validation | GREEN, bounded | Recipe/material/table validation and duplicate-request tests pass; durability caveat R6 applies |
| Chest withdrawal | RED | Full inventory destroys withdrawn items, R2 |
| Chest deposits | AMBER | Durable gear cannot be deposited; misleading “full” rejection, A3 |
| Furnace output collection | GREEN, bounded | Explicit capacity preflight preserves output when full; shared save caveat remains |
| Shops | AMBER | Capacity and price validation exist; durable success can be false, R6 |
| Melee and ability replication | GREEN, bounded | Integration and browser combat checks pass, including added network delay |
| E-rank dungeon entry, boss clear and exit | GREEN | All three named E-rank dungeon journeys passed |
| First-gate failure and retry | GREEN | Failure retains progression and offers a successful retry |
| D-rank progression and failure recovery | GREEN | Browser transition test passed |
| C-to-S progression | AMBER for test maintenance | Diagnostic passes through final S-rank after dismissing the result panel; original release test still fails |
| Dedicated DungeonRoom transition | GREEN | Browser switches into and out of a real DungeonRoom |
| Dungeon spirit/death state | GREEN | Defeated hunter remains a spirit until choosing town |
| Private-gate restart recovery | GREEN | Entry item refunded once and reusable in browser check |
| Shard dungeon loop | GREEN, bounded | Shard drop, entry and completion pass; reward overflow caveat remains |
| Multiplayer presence after refresh | GREEN | Two hunters remain visible and social-ready in shared Taming Land |
| Taming Land portal | GREEN | Travel and return browser test passed |
| Recall questions and recovery | GREEN, bounded | Browser question resume plus recall unit tests pass; live school DB not exercised |
| Knowledge Challenge stakes and scoring | RED | Concurrent start and answer requests race, R4/R5 |
| Knowledge Challenge corrective learning | AMBER | Wrong corrective answer still advances, A2 |
| Exploration discoveries and Ancient Vault rewards | RED | Irrecoverable full-bag claim, R3; vertical-range bypass, A1 |
| Ancient City geography and Warden telegraphs | GREEN, bounded | Rendered entrance-to-core routes and two-player safe/unsafe ring behavior pass |
| Gear recovery | AMBER | Queue is capped at 12; not a guarantee that every future item is retained |
| Dragon/familiar core rules | GREEN, bounded | Server tests cover ownership, breeding, binding, cooldowns and progression; breeding reward overflow shares R3 |
| Land, farming and guild rules | AMBER | Server coverage exists; complete browser lifecycle not verified here; guild reward overflow shares R3 |
| Event participation/state | GREEN, bounded | Dedicated two-user live smoke passed; event rewards share R3 |
| Player trading | RED for durability | In-memory draft validation is useful; gold-only acknowledgement skips intended durable save, R6 |
| Save/reload during normal operation | GREEN, bounded | Integration/restart tests pass under functioning storage |
| Save failure and concurrent-save handling | RED | Success despite failed persistence and lost dirty markers, R6/R7 |
| Day/dusk/night presentation | GREEN, bounded | Atmosphere browser check passed; aesthetic quality not exhaustively reviewed |
| Performance and capacity | AMBER | All measured budgets pass, but the client median sits at its 28 FPS minimum; local tests do not prove unlimited production capacity |

## 3. Confirmed RED findings

### R1 — Crafting shortcuts throw a JavaScript exception

**Priority:** P1. **Evidence:** browser reproduction and source inspection.

`nearestCraftingTableKey()` uses `player.position.x/y/z`. The menu's player reference is `combatState.player`, whose position is held in `player.pos`. Calling a recipe shortcut reaches this function through `openCraftingFromNpc()` and throws before the crafting UI opens.

**Observed:** both `crafting-responsiveness.spec.js` and `early-crafting-loop.spec.js` failed on all three attempts with `TypeError: Cannot read properties of undefined (reading 'x')` at [client/js/menus.mjs:2042](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/client/js/menus.mjs:2042>).

**Player impact:** an early progression recipe shortcut fails, as do NPC crafting actions that take the same path. This does not establish that manually opening every crafting interface is broken.

**Fix:** use the actual player-position field consistently in both the scan origin and distance calculation. Keep the source of truth shared rather than introducing another position object.

**Acceptance:** the Road Ready shortcut opens and stages the recipe; NPC crafting works near and away from a table; delayed/retried crafting browser test reaches its actual retry assertions.

**Locations:** [client/js/menus.mjs:2041](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/client/js/menus.mjs:2041>), `:6635`; player binding at `:18`.

### R2 — Withdrawing into a full inventory permanently deletes chest items

**Priority:** P1. **Evidence:** real handler reproduction.

`handleChestWithdraw()` removes the requested stack from the chest, calls `addRewardItem()`, ignores its returned remainder, and sends `chestTx` success. The client withdrawal action has no capacity guard either.

**Reproduction:** fill all 36 inventory slots with 64 coal, put five diamonds in a chest, and withdraw the diamonds. The chest slot becomes empty, no diamonds enter the inventory, and success is sent.

Partial capacity is also unsafe: the chest can lose the requested quantity while the bag receives only the quantity that fits.

**Fix:** preflight capacity or transfer only the number actually delivered; leave the remainder in the chest. Treat storage and inventory as one transaction.

**Acceptance:** full bag leaves both sides unchanged and reports “full”; partial capacity preserves every item; repeated requests and two players sharing a chest cannot duplicate or destroy quantities.

**Locations:** [server/rooms/economy.mixin.js:936](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/economy.mixin.js:936>), `:353`; client [client/js/menus.mjs:2135](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/client/js/menus.mjs:2135>).

### R3 — One-time rewards can be consumed without delivering their items

**Priority:** P1. **Evidence:** reproduced Ancient Vault claim; source-backed related callers.

Discovery claims are recorded before their item grants are attempted. `awardGrant()` only recovers overflow explicitly marked as gear; ordinary items that do not fit disappear. A later `discoveryResult` still advertises the original reward list.

**Reproduction:** interact with an unclaimed Ancient Vault while all inventory slots are full. The handler marks the vault claimed, the actual `grant.items` is empty, `discoveryResult` advertises six reward types in the tested vault, and retry returns `claimed`.

**Related paths inspected:** dragon breeding consumes the breeding opportunity/cooldown after a potentially unsuccessful egg grant; guild weekly rewards mark the reward claimed even when the result records overflow. Boss `awardLoot()` additionally includes ordinary items in its delivered list regardless of leftover quantity. These related paths are source-backed, not all individually browser-reproduced.

**Fix:** reserve rewards in persistent pending storage, or reject the entire claim until it fits. Mark a one-time claim complete only once delivery or durable reservation succeeds. Build every reward message from actual delivered/reserved quantities.

**Acceptance:** vaults, boss keys, breeding eggs, event tokens and guild reward items remain claimable after making bag space; partial capacity conserves quantities; relog/restart cannot replay or erase the pending reward.

**Locations:** [server/rooms/GameRoom.js:8959](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/GameRoom.js:8959>), `:9034`; [server/rooms/combat.mixin.js:1194](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/combat.mixin.js:1194>); [server/rooms/dragons.mixin.js:1351](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/dragons.mixin.js:1351>); [server/rooms/events.mixin.js:2357](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/events.mixin.js:2357>).

### R4 — Concurrent Knowledge Challenge starts debit twice and overwrite one shift

**Priority:** P1. **Evidence:** deterministic concurrent-handler reproduction.

`handleKcStart()` checks that no shift is active, then awaits several database operations before inserting the shift in `kcShifts`. A second request can pass the same check before the first inserts its state. The rate limit permits this pair of requests.

**Reproduction:** issue two quick-shift starts concurrently with 100 gold. Both starts run, gold becomes 60, two shifts are created, but only one remains in the per-session map. The earlier shift is overwritten.

The initial affordability check also occurs before those awaits, so it is not a reservation of the entry cost.

**Fix:** synchronously reserve a per-session “starting” state before awaiting, use an idempotent request ID, recheck account/session state at commitment, and release/refund the reservation on error or disconnect.

**Acceptance:** repeated/delayed start requests create one shift and charge once; disconnect during startup does not resurrect a shift or consume an unrecoverable stake.

**Location:** [server/rooms/knowledge-challenge.mixin.js:114](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/knowledge-challenge.mixin.js:114>).

### R5 — Concurrent answers count the same Knowledge Challenge question twice

**Priority:** P1. **Evidence:** deterministic concurrent-handler reproduction.

`handleKcAnswer()` retains `shift.pending` while awaiting review and activity writes. Another answer request can read the same pending question. Both update the review records, completed-case count and streak/progression totals before the pending field is cleared.

**Reproduction:** submit the same correct answer twice concurrently. One presented question produces two completed cases and two review calls. This can distort learning records and reward calculations; the audit did not measure a complete payout exploit against a live school database.

**Fix:** claim the pending case synchronously before the first await. Use a unique case/attempt token rather than only question ID, since a question may recur. Make database writes idempotent on shift plus case ordinal.

**Acceptance:** duplicate answers create one review, one result, one progression increment, and at most one payout contribution. Stale answers cannot consume the next case.

**Location:** [server/rooms/knowledge-challenge.mixin.js:292](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/knowledge-challenge.mixin.js:292>).

### R6 — “Durable” success messages do not guarantee a successful save

**Priority:** P1. **Evidence:** injected failure and gold-only transaction reproductions.

Two independently reproduced paths break the intended save-before-message barrier:

1. `flushDirtyPlayers()` catches the save error and re-adds the dirty token without rejecting the flush. `protectDurableInventoryMessages()` awaits that fulfilled flush and sends the successful shop/craft/chest/trade response anyway.
2. A dirty, gold-only change enters the immediate-message queue, but the inner condition checks only inventory/armor/loot-recovery signatures. With those unchanged, `tradeResult` is sent with zero save calls.

**Player impact:** a confirmed transaction can be lost on a process failure or later reload from durable storage. An ordinary same-process reconnect may retain the in-memory value; that does not make the acknowledgement durable. Separately saved chest/player or two-player trade records also require an explicit recovery strategy for partial persistence failures.

**Fix:** have the transaction barrier observe an explicit persistence outcome covering all changed records and fields. On failure, report pending/failed persistence and retain recoverable state; do not silently acknowledge a durable commit. Use a transaction or journal for multi-record transfers.

**Acceptance:** inject failure into each side of a transfer, restart, and verify conservation. Gold-only trades must be durable before success; no success should claim committed persistence after a failed write.

**Locations:** [server/rooms/GameRoom.js:1637](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/GameRoom.js:1637>), `:1852`, `:5984`.

### R7 — An in-flight immediate save clears newer non-inventory changes

**Priority:** P1. **Evidence:** controlled deferred-write reproduction.

`savePlayerProfileNow()` captures a full-profile snapshot, but after its write finishes it decides whether to clear the dirty token using only the inventory signature. A gold, XP, quest, social or position change that happened during the write can therefore lose its dirty marker when inventory is unchanged.

**Reproduction:** start saving `{gold:100, inv:[]}`; delay the write; change gold to 200 and mark the token dirty; finish the first write. Durable data still contains 100, live data contains 200, and the token is no longer dirty.

**Impact:** the newer change is omitted from the next dirty-player flush unless another event dirties the profile again. This is a real persistence race, not proof that every later logout loses progress.

**Fix:** track a per-profile mutation revision. Clear dirty state only when the saved revision is still current; otherwise keep it dirty and save the newer snapshot. An inventory-only comparison cannot establish whole-profile freshness.

**Acceptance:** repeat with gold, XP, quest completion and position changes during a delayed save; the later revision remains dirty or is subsequently written.

**Location:** [server/rooms/GameRoom.js:1883](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/GameRoom.js:1883>).

## 4. AMBER findings and limits

### A1 — Several interactions check horizontal distance but not height

**Confirmed:** the Ancient Vault handler accepts a request from 30 blocks above the vault at the same X/Z. `handleDiscoveryInteract()` uses horizontal distance for tablets/vaults; the Ancient Core has its own stronger vertical check. Chest and furnace range checks also omit height.

The standard client usually selects nearby targets, so this reproduction demonstrates a server validation gap, not normal automatic vault collection from the surface. A modified request can skip physical access requirements.

**Fix:** consistent three-dimensional distance and dimension checks, plus line of sight where physical access is intended. Add “same X/Z, different floor” tests.

**Locations:** [server/rooms/GameRoom.js:8959](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/GameRoom.js:8959>); [server/rooms/economy.mixin.js:775](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/economy.mixin.js:775>), `:970`.

### A2 — Incorrect corrective answers still advance

**Confirmed:** `handleKcCorrective()` clears the corrective state, sends `correct:false`, and serves the next case. This conflicts with the method's stated rule that the reduced-load question must be passed before continuing.

**Impact:** the learning loop permits moving on without successfully correcting the error. This is a pedagogical/functionality mismatch, not evidence that the answer was marked correct.

**Fix:** retain/reissue correction until passed, or explicitly change the intended design and documentation. Test wrong, wrong, correct progression and delayed submissions.

**Location:** [server/rooms/knowledge-challenge.mixin.js:400](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/knowledge-challenge.mixin.js:400>).

### A3 — Gear deposit says an empty chest is full

**Confirmed:** a held sword with durability is excluded by `countItem()`, so depositing it into an empty chest produces `chestReject:{reason:'full'}`. The item remains safe in the bag. The audit explicitly ruled out the initial suspicion of gear metadata loss for this ordinary path.

**Fix:** if gear storage is intentionally unsupported, return a clear unsupported-item message and disable that action. If gear storage is intended, transfer the whole stack metadata and selected slot.

**Locations:** [server/rooms/economy.mixin.js:609](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/economy.mixin.js:609>), `:917`; [client/js/menus.mjs:2118](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/client/js/menus.mjs:2118>).

### A4 — The default late-rank test does not dismiss the dungeon result panel

**Confirmed test failure, not yet an independent gameplay blocker:** after C-rank clear and return, the test expects `choose_spec` but sees `continue_panel`. Its helper dismisses gear rewards only. The captured page shows a Dungeon Cleared panel with a Close button.

A separate diagnostic copy added result-panel dismissal without editing the game or original test. **It passed the complete C-to-S journey in 42.7 seconds.** This is a confirmed test-maintenance issue, not evidence of a blocked specialization feature. The original failure still prevents the normal gate from validating later B/A/S steps.

**Locations:** [e2e/c-rank-specialization.spec.js:26](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/e2e/c-rank-specialization.spec.js:26>), `:83`; [client/js/frame-loop.mjs:1543](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/client/js/frame-loop.mjs:1543>).

### A5 — Reward recovery has finite capacity

**Source-confirmed limitation:** `pruneLootRecovery()` retains at most 12 entries. When the queue is full, `queueGearRecovery()` only replaces an unlocked weaker item; it can return null. Ordinary unprotected entries also expire after seven days.

This makes the documentation's claim that nothing is ever lost too broad. A full queue of protected items can prevent recovery of another valuable drop.

**Fix:** provide explicit queue-full behavior, persist rejected valuable rewards elsewhere, and describe expiration/limits honestly in the UI and docs.

**Location:** [server/rooms/economy.mixin.js:113](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/server/rooms/economy.mixin.js:113>).

### A6 — Current automated gates leave important coverage gaps

The browser configuration ignores 13 test files. Some are retired profession flows; others include broad opening, onboarding, reconnect and transition-panel journeys. Those exclusions should be reviewed individually rather than assumed irrelevant because professions are disabled.

Visual-review and crowded-combat performance tests are opt-in, so default-suite skips do not validate those behaviors. Many authority tests use stubbed rooms and some client tests inspect source text; they cannot replace a complete browser journey, as the crafting crash demonstrates.

Two additional server test files are absent from the explicit default `npm test` list. Their five checks passed when run separately here.

**Fix:** maintain a release coverage map; retain active onboarding/reconnect coverage independently of retired jobs; run at least one real fresh-account journey without bypassing objectives.

**Locations:** `playwright.config.cjs:8`; `package.json:14`; [e2e/environment-identity.spec.js](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/e2e/environment-identity.spec.js>); [e2e/combat-performance.spec.js](<C:/Users/asher/Downloads/blockcraft-mp (2)/blockcraft-mp/e2e/combat-performance.spec.js>).

### A7 — Moderate/low dependency findings need triage

The registry audit reports 18 affected-package entries, including transitive chains. These are not necessarily 18 distinct exploitable vulnerabilities in the deployed application. There are no high or critical entries in this result.

**Action:** inspect exposure and update compatible dependencies deliberately. Some suggested fixes involve major-version changes or a Colyseus downgrade; a blind force-fix is inappropriate. Preserve auth, transport and persistence regression coverage during upgrades.

**Evidence:** `dependencies.json` in this directory. No packages were changed.

### A8 — Client performance passes with little FPS margin

**Measured:** with 15 visible remote players, the sixteen-player browser test sampled a median of 28 FPS, exactly its configured minimum. Minimum sampled FPS was 27 and frame-time p95 was 37.2 ms. Update/render work stayed within the test budgets.

This is not a failed benchmark or proof of bad performance on physical GPUs. It is limited headroom in the measured local headless environment. A sixty-FPS experience, mobile smoothness and heavier combat are not established by this result.

**Action:** keep the default thresholds, profile slow frames on representative player hardware, and include the currently opt-in crowded-combat benchmark before declaring performance complete. Production CI accepts a much lower client FPS threshold of 5, so a green CI performance job alone is not a player-experience target.

**Locations:** `tools/client-overworld-perf-test.js:16`; `.github/workflows/ci.yml:84`.

## 5. What looks sound

The following are concrete positive findings, with bounded scope:

- **Authority boundaries:** forged client progression saves are ignored; melee/tool and ability rules are predominantly server-controlled. Real unauthenticated matchmaking is rejected.
- **Craft request deduplication:** the server registers a pending request before awaiting execution and reuses completed request results. This is a useful pattern for the Knowledge Challenge fixes.
- **Furnace collection:** the server checks output capacity before clearing the furnace. This is a useful model for chest withdrawal.
- **Recall async handling:** starts have an explicit pending set, and the handler rechecks player identity and dimension after awaited question loading. This is stronger than the current Knowledge Challenge start path.
- **Normal persistence behavior:** corrupt-save protection, atomic JSON replacement, serialization and failure bookkeeping have meaningful tests. The remaining findings concern what completion/dirty flags promise, not an absence of persistence infrastructure.
- **Dungeons:** live shared instances, replicated damage, gate entry/exit, low-rank progression, failure/retry and spirit state have passing execution evidence.
- **World presentation:** rendering, atmosphere and Ancient City traversal checks show the client is more than an unverified collection of systems.

## 6. Recommended fix order

1. **Repair the crafting position reference (R1).** Small scope, direct early-player blocker. Rerun the two failing crafting browser tests.
2. **Make chest withdrawals and one-time rewards conserve items (R2/R3).** Add capacity, partial-capacity and restart tests around actual ownership transitions.
3. **Serialize Knowledge Challenge starts/answers (R4/R5).** Protect stakes and learning records with per-request idempotency and case identity.
4. **Repair durable acknowledgements and profile revision tracking (R6/R7).** Test delayed writes, failed writes, gold-only changes and multi-record transactions.
5. **Close spatial/corrective/UI gaps (A1–A3), then repair the late-rank browser test.** Keep observed test failures distinct from game defects.
6. **Review skipped coverage, dependency exposure and production-scale behavior.** Run the final full gates on the fixed version.

### Minimum release acceptance scenarios

| Scenario | Required outcome |
|---|---|
| Fresh account to Road Ready crafting | Shortcut opens; actual server craft succeeds; reload retains it |
| Full/partially full bag, chest withdrawal | No lost or duplicated items; remainder stays in chest |
| Full bag at vault/boss/breeding/guild reward | Durable pending reward or rejected claim, never silent loss |
| Two identical start packets | One shift and one stake debit |
| Two identical answer packets | One review and one completed case |
| Storage unavailable at transaction completion | No false durable success; recoverable state remains |
| Gold/XP changes during delayed save | New revision remains dirty or is saved |
| Storage transfer interrupted between writes | No item or currency creation/destruction after restart |
| C-rank result dismissed, specialization, B/A/S progression | Entire browser journey reaches its final assertions |
| Packet targets another floor/dimension | Server rejects interaction |

## 7. Scope and evidence limits

This audit combines source review, existing automated tests, browser execution and targeted reproductions. It does not claim every line or every possible item combination was examined. Several browser journeys use `__BLOCKCRAFT_E2E__` helpers to prepare state or defeat bosses; they validate integration and UI behavior, not full manual combat balance.

No live production deployment, real school MySQL database, live Firebase account, email delivery, mobile device, long-duration public load or actual player accounts were exercised. Local performance is not a production capacity promise. Node 22.17.1 was used locally, while the deployment documentation and CI specify Node 20; production parity should be checked on that runtime too. Existing uncommitted work was audited as found; findings are not attributed to a particular author or commit.

Game source was left unchanged. Audit artifacts, diagnostic copies and test outputs were created. The normal browser command also wrote its configured `test-results` output.

## 8. Final verification addendum

### Browser outcomes

The normal suite completed in **9.1 minutes: 28 passed, 3 failed, 8 skipped**. Every failing test exhausted its two retries.

| Failed test | Diagnosis | Additional evidence |
|---|---|---|
| `crafting-responsiveness.spec.js` | R1, crafting shortcut exception | Fails before it can validate delayed-reply behavior |
| `early-crafting-loop.spec.js` | R1, same exception | Actual early crafting journey blocked |
| `c-rank-specialization.spec.js` | A4, result-panel dismissal missing from helper | Diagnostic adding dismissal passed entire C-to-S journey; no game code changed |

The passing browser cases also include team-gate reconnect/restart refunds, town landmarks, tutorial milestones restored in a fresh browser, and terrain performance. Eight skipped cases are the opt-in combat benchmark and visual-review checks; the 13 excluded files are separate from those eight skips.

### Server performance

All scenarios below passed their configured budgets. Values are the per-scenario summary event-loop p99, rather than the separate peak-metrics sampler. The soak duration is a short test, not a long-running production stability claim.

| Scenario | Event-loop p99 |
|---|---:|
| Shard load | 50.76 ms |
| Full 16-client overworld | 47.64 ms |
| 16-client overworld mob pressure | 59.21 ms |
| Dungeon load | 40.67 ms |
| Spread dungeon bandwidth | 42.47 ms |
| 32-client mixed online soak | 53.25 ms |

Mixed-soak summary: **0 unexpected leaves**, 28.98 MB heap growth. Intended room transitions are not unexpected disconnects. The independent peak snapshot reached approximately 236.28 KB/s aggregate outbound traffic and 10.53 KB/s for the peak client in that sample.

Terrain browser p95 measured frame work: **21.1 ms idle, 22.9 ms editing, 27.3 ms streaming**. These are measured update/render-work metrics, not a claim about every player's display FPS. Streaming chunk total-build p95 was approximately 5.9 ms.

The separate sixteen-player browser benchmark **passed** with 16 samples, 15 visible remotes, median **28 FPS**, minimum 27 FPS, frame-time p95 **37.2 ms**, update-work p90 **12.3 ms**, and render-work p90 **4.1 ms**. Peak scene counts were 443 draws and 121,848 triangles. Its median-FPS budget is 28, so passing has little FPS margin in this environment (A8).

### Reproduce or inspect

Run the following from the repository root. Tests create isolated temporary data; the defect probes use in-memory fixtures. The last diagnostic intentionally changes only its copied test behavior.

```powershell
npm test
node --test server/test/firestore-read-budget.test.js server/test/firebase-credentials.test.js
npm run test:integration
npm run test:e2e
node artifacts/rag-audit-2026-09-16/reproduce.cjs
npm run test:event
npm run test:pet-tamer
npm run test:perf
npm run test:perf:client
node node_modules/@playwright/test/cli.js test --config=artifacts/rag-audit-2026-09-16/diagnostic.config.cjs
```

Preserved evidence: `unit.log`, `extra-tests.log`, `integration.log`, `browser.log`, `browser-evidence/`, `reproductions.log`, `late-rank-diagnostic.log`, `events.log`, `pet-tamer.log`, `performance.log`, `client-performance.log`, `dependencies.json`, `assets.log`, `lint.log`, and `format.log`.
