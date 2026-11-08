# Tower of Beginnings

The current game is in `public/`, hosted by the Worker in `../worker/index.js`. The original Colyseus proxy under `/game/` is retained for the archived Block2 backend. Current social rooms use the `SHARED_ROOMS` Durable Object binding.

## Accounts and rooms

- Guests can play immediately. Account → Create account attaches their existing D1 character, preserving inventory, home, attributes and offline plans.
- Username/password sign-in opens that same character on another device. Passwords use salted native scrypt (N=16384, r=8, p=5). Sessions use hashed random tokens and secure HttpOnly cookies, expire after 30 days, and are limited to ten per account.
- Recovery uses a random single-use code, shown after registration/reset. Reset rotates the code and revokes existing sessions. Generating a replacement code requires the current password. No email provider is required.
- Public lobby, lounge, courtyard and shops share movement, appearance, equipped weapons, seating, waves and room chat, capped at 20 connections per room. A second connection for the same character replaces the first in that room. Chat retains the last 40 messages; no moderation/reporting system is included yet.
- Home room identity is derived from the authenticated player on the server. Other players cannot choose its owner. Previously personal lounge furnishings return to the player's inventory; public lounge layout is fixed.
- Adventure areas remain personal. Economy and active combat still use the existing client snapshot save system; this release does not make those systems authoritative. Movement validation applies to social-room presence.
- Character keys prevent a stale tab from saving into a different account after sign-in. Pending local saves are also tied to the character. Account changes clear local character caches.

## Development and deployment

Use Node 22.17+ for tests (the database tests use `node:sqlite`). Run all `tests/*.test.mjs` with `node --test`, passing their expanded file paths on PowerShell.

Before the first account-enabled deployment, apply the additive D1 migrations using Wrangler with `--config pocket-lobby/wrangler.toml` from the repository root. Use `--local` for a separate development database and `--remote` for production. Deploy the same config; its SQLite Durable Object migration creates the social-room namespace. Do not remove the D1 or Durable Object bindings on later releases.

The current config enables `nodejs_compat` for native password hashing. Test this on the target Workers runtime before changing the password format or compatibility flags. Do not lower password hashing work factors to work around runtime limits.

## Tower job board

The lobby directory and the reception's Job board sign open a unified shift planner. Players choose fishing or woodcutting and 1, 2, 4 or 8 hours. The preview uses the same rod pacing and timber interval as settlement, caps fishing by bait and timber by inventory space, and labels sale values separately from gold earned. Fishing requires a prior visit to the pond; woodcutting requires the woodcutter's axe. Dispatch is validated from `hub` on the server, moves the saved character to its work area, and uses the existing one-plan-at-a-time revision/idempotency checks. Field-started plans remain available. Return reports show elapsed time, supplies, XP, level changes and sale value; the report must be acknowledged before play resumes.

## Saved idle hunting queues

Character rules can queue Hunt boars (up to 20 fights per step), Sell Boar Meat (keeping a chosen quantity), and Rest alongside gathering and trading. Queues start after three minutes without player input, including while the game remains open, and catch up on return after an offline period. The start-health threshold defaults to 60 HP and must exceed the combat flee threshold. Low starting health skips the remaining fights in that step; escape or defeat stops the whole queue. An equipped, usable weapon is required before any queue action spends gold. Automatic spell tactics remain optional; the saved flee threshold applies to queued hunts even when spells are off.

Hunts replay the same server combat clock, damage, respawns and rewards as manual encounters. Returning during an active fight requests a stop after that encounter resolves; it does not cancel attacks or grant an early victory. The combined report records victories, escapes, defeats, combat XP, meat, stones, essence mastery and the stop reason. Bounded cycles, the eight-hour limit, spending limits, gold reserves and revision/idempotency protections continue to apply. Offline progress is settled when the server next reads the character, rather than by a continuously running background combat process.

## Upgrade goals

In Rules → Activity queue → Save for an upgrade, select a purchasable sword or rod. The picker reads actual shop prices and Strength, Agility or Patience requirements. Gold and skill XP progress appear in Rules; the portrait goal button shows overall progress and opens these controls. The queue uses the player's configured activities, including sale steps to convert gathered items into gold. It stops immediately when the target is owned or both money and stat requirements are met.

Automatic buying is off by default. When enabled, purchasing and equipping are atomic with queue settlement, count against the whole-queue spending budget and preserve the configured gold reserve. If either limit prevents buying, the queue stops ready to buy and explains why. Already-owned targets never spend gold or automatically replace current equipment. Completed goals pause further away routines until the player chooses a new goal or clears the old one; resaving the same goal does not repeat the purchase. Choosing a new target or changing automatic-buy mode resets the goal result. Reports and character snapshots cannot duplicate or erase the authoritative completion receipt. Axes currently have only the starter version and are not offered as purchasable goals.

## Tougher idle hunting

Rules → Activity queue now offers Hunt Stoneback Beetles and Sell Shell Fragments. The hunting-ground comparison shows actual enemy HP, combat XP and loot sale value, plus equipment and health recommendations. A manual overworld beetle victory is required to unlock idle hunts; existing saves with the beetle-earned Depths discovery also qualify. The server checks this when saving rules and before dispatch. Shell inventory alone does not prove a trial victory, and snapshots cannot forge the unlock. The route button opens navigation to the Ruins for practice.

Both hunt types use the same combat engine and saved tactics, preserve start-health and flee thresholds, allow at most 20 fights per step, and finish the current encounter before returning. Beetles use their own 45-second respawn clock. Shell sales preserve the selected reserve and never consume meat, Moonwell Shards or other crafting supplies. Reports and recent activity retain per-creature victories, escapes, defeats, combat XP, loot value and actual sale gold so players can compare hunting targets. Dungeon encounters remain outside idle queues.

## Perfect-dodge counters

A manually timed dodge during the existing 350 ms dodge window now opens a 1.8-second counter opportunity, measured from the scheduled enemy strike. The next normal weapon hit gains 50% bonus damage (rounded up after armour or shell exposure), consumes the opportunity once, and keeps the regular weapon and enemy attack clocks. Passive random dodges do not grant counters; idle tactics do not perform manual dodges. Spells neither receive nor consume the physical-hit bonus. Earned openings survive a server reload without extending their deadline, while expired or consumed openings disappear.

The combat overlay shows Perfect dodge / Counter ready and the remaining opening time. Upcoming enemy warnings take priority. A gold enemy marker, brighter counter impact and labeled damage popup distinguish the hit; reduced-motion mode retains static rings and text. Combat recaps record perfect dodges, counterattacks and bonus damage. The existing shell-opening reward for a timed dodge remains active alongside the counter.

Combat warnings, dodge/stamina cooldowns, enemy poses and counter countdowns use a server-synchronised clock. Each player API response anchors that clock; elapsed time comes from the browser's monotonic clock, with bounded network-latency compensation. Device-clock skew or a wall-clock adjustment no longer shifts the displayed dodge window. The server still decides actual input timing and damage.

## Enemy stagger and weak spots

Physical weapon hits build an enemy's visible stagger meter. Fast weapons build 8 base stagger per hit, medium weapons 18, and heavy weapons (interval 1.4 seconds or longer) 36. A counter adds 40 before shell resistance; an intact shell reduces build-up. Overworld enemies break at 80, regular dungeon enemies at 140, and guardians at 160. Killing hits do not trigger a redundant stagger break.

A break resets the meter, cancels the pending attack pattern and delays the next enemy strike until after the stun and a fresh attack warning. Normal enemies are stunned for 1.8 seconds with a 2.4-second weak-spot window; guardians recover after 0.9 seconds with a 1.8-second opening. Weapon hits during the opening gain 25% bonus damage, rounded up, stacking with an earned counter. Shells open for the weak-spot period. The meter cannot rebuild until that opening plus a 3.5-second recovery (5 seconds for guardians) has elapsed, preventing repeated stun locks. Spells do not build stagger or gain the weapon-only weak-spot bonus.

The meter appears above the enemy and in the combat panel, with strain/crack marks, a stunned pose, break particles and a weak-spot banner. New attack warnings take priority after recovery. Reduced-motion mode keeps static feedback. The combat-sound toggle enables a short synthesised break cue; sound is off by default, saved per browser, and never played in hidden tabs. Server settlement and normalisation preserve progress, stun deadlines and recap counts across offline catch-up and reloads.

## Tower training courtyard

The Tower Courtyard now contains an interactive practice dummy, reached from the lobby directory or its courtyard sign. The existing main-screen activity guide offers safe practice. A dedicated arena coaches four shared combat mechanics: time a dodge in the last 350 ms of a warning, land the automatic counter, build stagger, then hit the weak spot. Progress and early/perfect/late/missed timing feedback appear with the arena. Reset starts a fresh lesson; weapon selection resets and previews a different fighting style.

Practice runs the same `huntingTurn` / `advanceHunt` engine on a separate cloned session with deterministic rolls. It never writes a combat encounter, reduces real health, consumes items, equips real gear or awards gold, XP, stones, loot or trial unlocks. The dummy refills its own practice health, and missed attacks only produce coaching feedback. The comparison table measures 15 seconds of automatic strikes and time to first stagger with the player's current stats, fittings and enchantments, including clearly labeled preview weapons not yet owned. No spell tactics run in the basic weapon lesson.

Closing, Escape, reset and selecting a preview clean up or replace the practice session. Training pauses while the tab is hidden, cancels its animation loop on close, and closes when a server away routine takes control. Opening is refused during combat, recovery, active work or an unread away report. Both normal and reduced-motion modes show the lesson and its attack warnings; the responsive arena supports Space or the Dodge button.

## Optional rooms after Shell Gallery

After clearing Shell Gallery, choose Explore optional rooms from the main-screen expedition options (or the room sign). The choice window shows current HP, the haul at risk, each enemy's danger/HP and each reward before entry. All branches return to Shell Gallery and do not advance the three main chambers. The earlier safe/dangerous passage and Essence Cache branch remain available under their existing rules.

- Guarded Treasury: a 175 HP Treasury Guardian protects 60 extra unbanked gold and 2 Shell Fragments. Victory adds this reward once per expedition. It is paid only when the haul is banked and is lost on defeat.
- Quiet Shrine: no combat and free entry. The player can choose a one-time blessing restoring up to 30 HP for 15 gold taken from the unbanked haul. The wallet is untouched. A full-health character is never charged. Returning/revisiting does not reset the blessing.
- Sealed Chamber: defeat the 210 HP Rune Sentinel, then approach and claim its Awakening Seal for one guaranteed Awakening Stone. No normal battle-stone roll is made for this fight. Claiming is once per run; a full stone inventory leaves the reward available. Claimed stones and earned XP survive a later defeat, while unbanked expedition spoils do not.

Server actions validate entry, shrine usage, fights, discoveries and returning. Active combat blocks direct retreat; a successful flee returns to Shell Gallery with the surviving health and current haul. Revisiting a defeated guardian cannot respawn or repeat its reward. Save snapshots cannot forge optional victories, shrine payments or stones. Revision checks and idempotent retries protect healing, claiming and banking. Optional rooms use the normal combat, stagger, dodge and spell systems, remain outside idle hunting, and resume in their own rendered layouts after reload.

## Rare Sunken Vault weapons

A server-verified Sunken Vault guardian clear has a 15% chance to award the selected missing relic. Every fifth clear without a relic guarantees that target. Changing targets preserves progress; owned relics are skipped, so the collection has no duplicate drops. Inventory → Dungeon arsenal and the expedition entrance/options show the target, collection and visible guarantee progress. Optional rooms, training, idle hunts, defeats and repeated settlement do not count.

Breaker Spear builds 16 extra stagger per hit, Duelist’s Blade raises timed-dodge counters from 50% to 75%, and Quickfang Dagger trades damage per hit for a 550 ms attack interval. Each has Strength/Agility requirements and distinct carried artwork. These weapons cannot be bought in shops.

Drops enter permanent inventory immediately, independently of the unbanked expedition haul. A comparison window shows the current weapon beside the relic, its requirements and combat traits. Equipping is optional and validates ownership/stats; continuing keeps current equipment. Acknowledgments, progress and ownership survive reload, concurrent settlement and retried requests. Save snapshots cannot forge ownership, guarantee progress or notices.

## Dungeon enemy fighting styles

Three optional guardians now teach distinct weapon choices. The Treasury Guardian halves physical damage after shell armour until its stagger opening; dodging its slam still grants a counter but does not expose its plating. Heavy weapons build stagger sooner. Existing spell-based shell openings remain usable.

The Rune Sentinel has an unarmoured duelist silhouette and alternates Sentinel Strike with a heavier, clearly warned Sentinel Lunge. A manually earned counter deals an additional 25% damage against it, included in the counter bonus recap. Passive dodges grant no such opening. The Cache Guardian is an unarmoured robed caster: Rune Bolt has a 2.2-second purple warning and a visible three-hit pressure count. Three physical hits within that single warning cancel the bolt and schedule a fresh cast cycle; fast weapons excel. Completing a cast resets pressure and launches a rune projectile. Dodging and existing elemental abilities remain valid responses.

Room entrances and main-screen hints explain the relevant weakness. The caster and duelist have distinct pixel silhouettes and windup poses; the Treasury Guardian has gilded plating. Reduced-motion mode keeps readable static warnings. Saved pressure belongs to one scheduled cast deadline, so delayed/interrupted attacks cannot inherit hits from an earlier cast. Normalisation and authoritative snapshot protection preserve active fights; fine polling and offline catch-up produce the same result. Existing chamber locations, health, progression and rewards remain unchanged, and legacy pending elite attacks can finish before the new patterns begin.

## Three-phase Vault Guardian

New Vault fights use a versioned 240 HP boss encounter. Above 160 HP, Ironclad plating halves physical damage after shell armour; stagger exposes the core. At 160 HP the Guardian becomes Unbound, alternating Vault Cleave and Vault Lunge without armour; manually earned counters exploit the same extra 25% duelist weakness. At 80 HP the Runic Heart alternates a 2.4-second Heart Bolt cast with Runic Blast. Three physical hits during one bolt warning interrupt it; a completed blast remains dodgeable. Existing elemental spells and heavy-weapon stagger remain useful throughout.

Weapon hits, burning ticks and direct spell damage all share phase transitions. A transition cancels the previous pattern and cast pressure, records its timestamp and grants at least 1.5 seconds plus the new attack's full warning without pulling an already delayed attack forward. It does not restore health or grant rewards. High-damage builds can cross a threshold without artificial invulnerability. Saved fights from before this update retain their existing pending attack pattern; new fights receive the phased version.

The Guardian has a larger golem silhouette, gold plating, exposed orange blades and a purple runic heart. Its main-screen health bar marks both thresholds, names the active phase and shows phase-change feedback. Ground warnings, projectile effects and contextual hints explain the current response. Defeat collapses the golem into fragments with a gold rune burst; reduced-motion mode keeps static feedback.

After the defeat animation, a responsive victory window shows the total unbanked expedition haul, the Guardian's added 45 gold/Shell Fragment/Moonwell Shard, combat XP and relic guarantee progress or an awarded weapon. Relics remain optional to equip through the existing comparison. Dismissal persists in the authoritative run, rewards are never re-awarded by the reveal, and banking still pays the held haul only once. Reloads, spell transitions, offline catch-up and retried acknowledgment/bank requests are covered by tests.

## Play / Auto control and nonblocking routines

The header now offers Play / Auto. Auto starts the saved routine immediately, even when automatic idle activation is disabled. The authoritative control mode persists across reconnects; ordinary input and visibility changes do not stop explicit Auto. Idle activation still starts after three minutes when enabled. All three paths use the existing routine/queue engine, timing, health thresholds, spending reserves, goals and eight-hour offline cap.

A compact main-screen panel replaces automatic blocking report windows for rule-driven routines. It shows the current task, location, next task, net gold, gathered items and XP, with readable stop reasons and optional Details. Reports remain available until Return to play acknowledges them; recent routine history is retained. Job-board shifts keep their existing separate work/report flow.

Inventory, Wardrobe and map inspection remain accessible during Auto. Manual movement, equipment mutations and manual combat requests are blocked while a plan/report owns the character. Fishing/chopping poses and queued combat now render in the world. Visible hunts refresh more frequently; hidden tabs use bounded catch-up. Automated travel avoids merchant and equipment tutorial interruptions. Details can be closed without stopping the routine.

Take control stops gathering at completed work boundaries. An active hunt finishes its current encounter, displays a returning state, then enables Return to play without starting another fight. The finished report clears the returning flag in the presentation. Explicit Auto is ended by completion, limits or deliberate handoff, and normal save snapshots cannot forge its control mode. Revision checks and operation retries protect start/stop actions. Tests cover immediate starts, idle/offline equivalence, cap/reserves, reconnect semantics, report acknowledgment, safe combat handoff and inspection without manual combat polling.

## Combat intelligence and fighting styles

Combat tactics now offer Cautious, Balanced and Aggressive styles. Cautious heals at 90 HP and may attempt retreat before an unprotected warning would cross the saved flee line. Balanced heals at 80 HP and reserves automatic dodges for heavy attacks, charged spells or substantial incoming damage. Aggressive heals at 50 HP and uses defensive moves for lethal threats, avoiding unnecessary defense when the next weapon hit or existing burn will finish the enemy. All styles obey the saved hard retreat threshold; zero disables automatic retreat.

Automatic dodging is an explicit opt-in under Rules → Combat tactics, off for existing saves. It requires enabled combat tactics, real stamina and the normal dodge cooldown. The planner forecasts damage using armour, vest absorption, wards and weakening effects, and schedules a dodge within the existing window only when the style calls for it. Automatic dodges can expose normal shell recovery windows but do not award manual perfect-dodge counters or perfect-dodge credit. Manual dodges still award their existing counters.

Spell choices now prioritise healing and warning interrupts when actions become ready together, avoid redundant protection when a dodge already covers the attack, conserve Storm/dodges when the next physical hit will finish a three-hit cast interrupt, and avoid stamina powers while stamina is high. Actual casts, damage, stamina spending and flee outcomes still use the shared combat engine; flee attempts can fail. Fighting style, dodge flags, reaction clocks and decision timestamps persist through normalization and reloads. Saved snapshots cannot forge the live decision or automatic-dodge state.

The Auto panel and combat panel show the latest reason for defending, interrupting, healing or retreating. Queue hunt history keeps the last decision, combat recaps count successful automatic dodges separately, and the world effect says AUTO DODGE instead of PERFECT DODGE. The same decision timing is replayed online and offline. Dungeon route selection and room progression remain manual; enabled combat tactics assist only encounters the player actually enters.
Control requests settle their own due routine actions in the same revision-checked write as the handoff. This avoids a false conflict when gathering or a combat tactic becomes due between the last heartbeat and Take control; unrelated tab writes still conflict normally.

## Earn gold safely Auto goal

Rules → How Auto chooses work now offers Earn gold safely alongside the existing exact routine. The goal has separate total supply spending, wallet reserve, fish/timber/meat/shell reserves and minimum hunting health. Existing bait reserves and timber targets still apply. Switching back preserves the saved exact queue. The new goal is opt-in and works through explicit Auto, idle activation and offline catch-up with the same eight-hour cap and handoff flow.

The server reassesses after each batch of up to five gathered items, one fight, sale, bait purchase or rest. Surplus is sold first while preserving per-category reserves. Critical health rests; fishing/woodcutting offer safe alternatives when hunting is unsuitable. Candidate work uses conservative income estimates. Hunt previews simulate low weapon rolls, high incoming damage and no lucky evades, spells or automatic dodges; only already unlocked overworld targets can be selected, with minimum starting HP and an ending-health margin above the retreat line. Gear, stats and health are reassessed before another fight. This reduces risk but does not promise invulnerability.

Only one bait pack at a time can be purchased, within the total budget and wallet reserve. Old equipment upgrade goals are ignored by this strategy, so it never unexpectedly buys or equips gear. Only surplus fish, timber, Boar Meat and Shell Fragments are sold; Moonwell Shards, meals and gear are retained. When no safe work remains the routine stops with a readable reason, instead of looping without progress. Escapes/defeats retain the existing stop behaviour. The server reuses the authoritative queue engine for rewards, trade timing, combat, reports and safe stopping. Recent adaptive steps are bounded to 64 entries.

The main-screen Auto panel explains its choice and shows Reassess gear, health and reserves as the next step. Task travel and income remain visible, and onboarding overlays stay out of its way while Auto controls the character. Tests cover settings, preserved exact queues, conservative hunting, item and gold reserves, bait spending, rest, no-work stops, online/offline equivalence, caps, concurrent settlement, no unexpected gear buys and safe handoff.
