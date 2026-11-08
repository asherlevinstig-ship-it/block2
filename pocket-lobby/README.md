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
