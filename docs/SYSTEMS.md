# Gameplay systems reference

Deep reference for the game's RPG and survival systems. The top-level
[README](../README.md) covers architecture and the authority split; this document
covers the gameplay. Unless noted, every value below lives in
[`server/rooms/constants.js`](../server/rooms/constants.js) and the helper functions
referenced are exported from there.

---

## World, biomes & danger rings

The overworld is a `1000 × 64 × 1000` voxel world generated deterministically from
seeded hash-noise ([`server/world.js`](../server/world.js)); the client runs the
byte-identical generator so only block *edits* are ever synced.

**Biomes** (`biomeAt`) are chosen from two low-frequency noise fields (temperature ×
moisture): Plains, Forest, Desert, Mesa, Snowy, Swamp. Each biome has a signature
animal, a gatherable **collectible** (`BIOME_COLLECTIBLE` — e.g. Forest → Heartwood
Resin, Snowy → Frost Crystal), and its own surface blocks.

**Danger rings** (`DANGER_RINGS`, `dangerRingAt`) scale the world by distance from the
central town:

| Ring | Starts at | Name | HP × | Dmg × | Loot × | Mob families |
|------|-----------|------|------|-------|--------|--------------|
| 0 | 0 | Green Frontier | 1.0 | 1.0 | 1.0 | zombie, skeleton |
| 1 | 90 | Ember March | 1.45 | 1.25 | 1.5 | husk, bone_archer |
| 2 | 180 | Ashen Expanse | 2.05 | 1.65 | 2.15 | raider, ash_archer |
| 3 | 300 | Dreadwild | 2.9 | 2.15 | 3.0 | dreadguard, void_archer |

The town center (`TOWN.TC`, world middle) is safe and build-protected; a lava border
rings the world edge. A separate **Training Meadow** (`TRAINING_MEADOW`) is a resettable
sandbox whose edits are never persisted into the shared world.

---

## Classes, paths & abilities

A hunter picks one **path** (`Player.path`): `shadow`, `mage`, or `guardian`. Each path
has three abilities unlocked at levels **2 / 5 / 8**, costing mana and on cooldown. All
tuning (names, costs, cooldowns, unlock levels) and the damage formulas live in one shared
module, [`shared/ability-system.js`](../shared/ability-system.js), loaded by both the
server and the browser client:

| Path | Ability 1 (Lv2) | Ability 2 (Lv5) | Ability 3 (Lv8) |
|------|-----------------|-----------------|-----------------|
| **shadow** | Shadow Dash (dash) | Umbral Edge (×1.6 dmg buff) | Shadow Soldier (summon) |
| **mage** | Fireball (proj, r3.0) | Frost Nova (slow, r6.5) | Lightning (chain) |
| **guardian** | Iron Skin (armor) | Shockwave (knock, r5.5) | Second Wind (passive revive) |

Abilities are resolved server-side in [`combat.mixin.js`](../server/rooms/combat.mixin.js):
fireballs are simulated projectiles, frost applies a visible slow `state`, lightning
chains to nearby mobs and roots them, and target-snapped casts still require line of sight.
Damage scales with INT/STR **and** hunter level (`abilityDamage`: ×1.0 at level 1 rising
~5%/level to ~×1.95 at 20) so casters keep pace with ranked gates. The **Shadow Soldier**
is a real server-simulated ally: it replicates to every client as a `shadow_soldier` mob,
hunts the nearest hostile within 16 blocks, strikes on its own cadence with kill credit to
its hunter, and fades after 30s. **Second Wind** procs inside the server's `hurtPlayer`
(40% heal below 25% HP, 60s cooldown), so event and dungeon death rules respect it.

---

## Professions

A hunter also has one active **job** (`Player.job`), with **Adventurer** as the always-on
baseline. Definitions, level titles, and perk rules live in
[`shared/job-system.js`](../shared/job-system.js); XP is tracked **per job**
(`jobXpByJob`) so switching professions never loses progress. Profession level rises on
`30 × lvl^1.45` (cap 99); perk strength steps at levels **2 / 5 / 10 / 20**.

The early **Progression Director** deliberately introduces systems in order through
`progressionFocus`: finish Mara's First Hands → Road Ready → the first E-rank Gate →
craft a station → claim land → expand to a 3-tile connected base → place storage, light,
and a station inside claimed land → take the first repeatable contract → climb E-rank toward
D-rank promotion prep. Each step advances from
server-validated actions, so doing work early catches the objective up instead of forcing
duplicate chores. The first E-rank Gate clear pays a one-time **First Dungeon Cleared**
bundle of planks, cobble, and torches, unlocks **Feather Step** before the base-building
climb phase, then opens a reward panel pointing directly into the first station objective.
The HUD renders this as a compact path card with the current
step, the next step, and the reason it matters; the server also grants one-time milestone
supplies for the first station, first claim, and first contract. The first land claim also
opens a **First Claim Secured** panel and briefly spotlights the claim outline so the player
sees the protected base tile they just bought.

The first **D-rank preparation** step is an advisory checklist, not a hard gate. The HUD,
compass, Gate prompt, and Gate Lobby all surface the next missing preparation item with a
short acquisition hint: iron-tier weapon, equipped iron armor, three food, a healthy
utility tool, and a D-rank key. If a hunter on the first-D objective joins the D-rank Gate
underprepared, the server sends a one-time warning before allowing them to ready up.

Each profession has signature server-validated perks: **miners** run prospect surveys
(ore sense → deep prospecting, geode finds, durability saves), **farmers** craft compost
fertilizer and cultivate windseed, **cooks** serve timed meal buffs (might/gathering),
**blacksmiths** reforge and eventually Masterwork gear, and **monks** channel auras
(stone skin, regeneration, speed). Job contracts come as refreshing **offer boards** with
quick/balanced/demanding difficulties. Each offer now carries a visible identity line:
its focus, party relevance, and reward hook. This lets Miner, Farmer, Cook, Blacksmith,
Monk, and Adventurer work point at different play rhythms instead of only showing
`do N actions for XP`; the board also previews the next profession milestone so contracts
feel connected to useful unlocks. Milestone unlocks carry concrete reward labels through
server result payloads and the local/offline path; the client shows a rare reward-feed
moment plus a recap line like **Reward: Prospect survey action** when the level is crossed.
Direct activity XP also reports every crossed milestone, so mining, farming, cooking,
smithing, and meditation cannot skip intermediate unlock messaging. Balance tests keep
the first play-changing Lv5 unlock within seven average contracts for every profession,
and material-dependent milestones grant a tiny one-time starter kit: for example
Windseeds at Farmer Lv5, Compost at Farmer Lv10, sample meals for Cook milestones, and
starter iron for Blacksmith Lv2.
Profession moments are intentionally named at the point of use: Monk focus labels the
active blessings and duration, Windseed planting explains the special crop, Compost says
whether the crop advanced or ripened, and Golden Wheat harvests get a distinct rare-crop
message.
Profession UI also includes a compact **Right now** affordance line per job, derived from
current level, equipped profession, selected tool, and relevant inventory. The Jobs board
and profession service screens use this to point at immediate actions such as surveying,
planting Windseeds, crafting Golden Broth, reforging selected gear, or refreshing focus.
The same screens route common actions directly: Farmer can select hotbar Compost,
Windseeds, or seeds; Cook and cook contracts open the Food recipe tab; smith contracts and
Blacksmith services open tool recipes; and the forge can select the first unreforged
hotbar sword, axe, or pick.
The recipe book reinforces that routing by labeling profession recipes with their job and
level, showing whether they are locked by profession/level or missing ingredients, and
calling out unlocked profession recipes that are ready to stage.
Crafting outcomes close the loop: Cook and Blacksmith crafts recap the item made, the
profession XP value, the practical effect such as gate food or repair-kit prep, and any
matching contract progress. Reforge results also state the modifier/masterwork outcome,
material cost, Blacksmith XP, and contract update relevance.
Contract claims use the same reward language: completed title, gold, Hunter XP,
profession XP, profession level movement, milestone starter items, and a next-action hint
based on the profession or first-contract graduation state.
The Jobs board, contract-ready notices, and claim recaps share that next-action hint so
profession guidance stays consistent. Craft-driven contract completion suppresses the
extra standalone "ready" toast because the craft recap already carries that progress beat.

Because some XP sources never reach the server, job XP is **rate-capped on save**
(`clampJobXpGain` in [`store.js`](../server/store.js)) — a forged save can't claim an
instant max profession. Job level shows on nameplates (`Player.jobLvl`).

---

## Mining, tools, crafting & smelting

- **Tools** (`TOOL_INFO`): four classes (pick/axe/shovel/sword) plus hoe, in four tiers
  (wood → diamond) with durability `60 / 132 / 251 / 1562`. `MINE_REQUIRE` gates which
  block a tool class+tier can break; `MINE_DROPS` defines yields and mining XP.
- **Melee feel** (`meleeProfile`): swords swing fast and steady; axes swing slower but
  hit much harder. Damage is computed from the *server* inventory, never the cosmetic
  `heldId`, then scaled by level and any active buffs (`serverDamageFor`).
- **Crafting** (`RECIPES`): a shaped/shapeless grid matcher (`matchRecipe`) covers the
  full progression — planks, sticks, table, furnace, all tool/armor tiers, torches,
  beds, chests, food, and biome-collectible recipes. Crafting consumes the real
  server-side ingredients and grants the recipe output.
- **Smelting** (`SMELT`, `FUEL`, `SMELT_MS` = 5s): furnaces are placed blocks with
  persistent state; smelts complete lazily (a 1s sweep + on-open) so the server doesn't
  hold a timer per furnace. Sand→glass, cobble→stone, iron ore→ingot, meat/fish→cooked.
- **Food & hunger** (`FOOD_VALUES`, `MAX_HUNGER` = 100): eating restores hunger and a
  little HP; hunger drains over time and starvation damages the player.

---

## Gear & loot economy

Weapons and armor carry a **gear rank** (E→S) and **rarity** (Common→Mythic), combined
into a power score (`rank×10 + rarity`). The tables and profiles live in
[`shared/gear-system.js`](../shared/gear-system.js) / [`shared/loot-economy.js`](../shared/loot-economy.js)
(one file for server and client); the server rolls all drops authoritatively in
[`loot-progression.js`](../server/loot-progression.js):

- **Sources:** bandits drop gear rarely (≈4%, low ranks, thematically axe-biased), bandit
  captains always drop a ranked weapon (12% armor chance), and gate clears always pay out
  (35% armor chance, rank scales with gate tier and shard `+N`). The guaranteed sources —
  gates and captains — personalize the weapon archetype to whichever of the killer's
  sword/axe power scores is behind (`gateWeaponArchetype`); only anonymous rolls fall back
  to the thematic table bias.
- **Weapon identity:** swords build **momentum** stacks on repeated hits for a damage
  multiplier; axes hit slower and harder.
- **Blacksmith services:** classic repair/upgrade plus **reforging** (e.g. Keen = +damage,
  Swift = faster swings) and, at blacksmith level 20, **Masterwork** perfection — which
  also lifts the piece to S-rank. Items can be **locked** against accidental salvage.
- **Loot recovery:** gear that would drop into a full inventory is banked server-side and
  reclaimable later — nothing is ever lost (`lootRecovery*` messages).
- **Balance harness:** `npm run balance:loot` runs a deterministic simulator
  ([`tools/loot-progression-sim.js`](../tools/loot-progression-sim.js)) reporting the
  rarity distribution, weapon mix, and full-inventory recovery safety; the
  `progression-balance` test suite pins the same expectations in CI.

---

## Economy: shops, keys & shards

Town vendors trade for **gold** (all server-validated in
[`economy.mixin.js`](../server/rooms/economy.mixin.js)):

- **General shop** (`SHOP_BUY` / `SHOP_SELL`): blocks, ores, basic gear, and dungeon
  keys.
- **Tavern** (`TAVERN_BUY` / `TAVERN_SELL`): potions (ale/stew/mana/swift/stone) and food.
- **Road merchant / guild decor** (`ROAD_MERCHANT_BUY`, `GUILD_DECOR_BUY`): biome
  collectibles, repair kits, and furnishing blocks.

The economy balance target is that the opening quest can still fund a first land claim,
while repeated land, tavern, and profession loops have real pressure. Tavern buy/sell
spreads prevent no-loss food flips, and profession contracts lean toward job XP plus
modest gold instead of replacing dungeon clears as the best cash source.

Server gold movement is also recorded in a bounded in-memory telemetry ledger by
category/source (`quest_faucet`, `contract_faucet`, `loot_faucet`, `shop_sink`,
`land_sink`, `blacksmith_sink`, etc.). It is operational balance data, not player save
data, and lets balance tests/admin tools summarize faucets, sinks, and net flow.

**Gate keys** open private dungeons without waiting for a public gate. Solo keys
(`SOLO_KEYS`, prices `45→800`) and team keys (`TEAM_KEYS`, prices `70→1100`) come in five
ranks E→A. Keys drop from bosses and chests at tuned rates (`KEY_LOOT`).

**Dungeon Shards** (`SHARD_ITEM_IDS`, tiers Minor→Radiant = +1…+5) are attuned at the
plaza pedestal to open a **sharded gate** with rolled **affixes** (`SHARD_MOD_KEYS`,
`rollShardMods` → 1–3 mods). Stat affixes (Empowered/Fortified/Tyrannical/Frenzied) scale
mobs at spawn; the rest are **server-simulated hazards** (`HAZARD_MOD_SET`): Volatile
corpse blasts, Sanguine ichor pools, Spiteful ghosts, Bursting/Grievous bleeds, Quaking
shockwaves, Explosive orbs, and Bolstering (each trash death empowers surviving trash
nearby, stacking). Clearing one rewards bonus loot + a Legendary Weapon Token.

---

## Dungeons & gates

Gates ([`dungeon.mixin.js`](../server/rooms/dungeon.mixin.js)) carry an `id`, a `seed`, a
`rank` (E→A), and a `kind`:

| Kind | How it opens | Party |
|------|--------------|-------|
| `public` | spawns on the room timer at a rank-banded distance (`GATE_DISTANCE_BANDS`) | anyone who enters shares the instance |
| `solo` | a solo key | just you |
| `team` | a team key | your team |
| `shard` | attuning a Dungeon Shard at the pedestal | the attuner's team |

Entering creates or joins the **instance** for that gate: the server spawns its mobs and
boss into shared state tagged with the instance id and replies `{seed, rank, edits}`. The
client regenerates the identical dungeon from the seed and applies the edit log to catch
up on party mining. Players and mobs filter visibility by instance tag; mining syncs
party-wide via `dedit`. The **boss** runs a five-pattern state machine (slam, charge with
a wall-crash stun window, shadow-bolt volley, ground spikes at C+, plus threshold summons
and enrage) in [`spawning.mixin.js`](../server/rooms/spawning.mixin.js). Killing it sends
`gateCleared` + a `loot` payload to every contributing hunter; the last one out collapses
the instance.

Boss/chest rewards scale by rank (`BOSS_REWARD_BY_RANK`, `CHEST_REWARD_BY_RANK`).
First-clear of a new highest rank grants a bonus (`firstClearBonusItems`) and bumps the
persisted `worldProgress.highestGateRankCleared`.

---

## Legendary weapons

Tokens earned from shard clears craft one of ~15 **legendary weapons** (`LEGENDARY_CRAFTS`,
cost 1–3 tokens). Each has a fully **server-simulated** effect resolved in
[`combat.mixin.js`](../server/rooms/combat.mixin.js) — e.g. Meteor Staff drops delayed
impacts, Blackhole Staff suspends mobs, Soul Reaper / Warden chain and cleave, Phoenix
Sword revives once, Gravity Bow pulls, Chrono Dagger and others scale/pierce. The cast
validates the *selected* item against the server inventory and applies effects on a
per-weapon cooldown.

---

## Dragons

A full breeding/mount loop in [`dragons.mixin.js`](../server/rooms/dragons.mixin.js).
Five species form an upward ladder: **ember → verdant → frost → storm → void**
(`DRAGON_TYPES`).

- **Eggs** drop from dungeon chests/bosses by rank (`DRAGON_EGG_CHEST_CHANCE`,
  `DRAGON_EGG_BOSS_CHANCE`; none at E-rank), favoring species the player hasn't hatched.
- **Incubation:** place an egg on an **Egg Insulator** (nest block); incubation time
  scales by species (`DRAGON_INCUBATION_MS_BY_TYPE`, 30s ember → 90s void) and persists
  across restarts.
- **Perch & care:** a nest holds `DRAGON_PERCH_SLOTS` (2) dragons; feeding Dragon Treats
  raises happiness and puts a dragon "in love" (`DRAGON_LOVE_MS`).
- **Breeding:** two in-love dragons nesting together lay an egg (`DRAGON_BREED_MS`,
  cooldown `DRAGON_BREED_CD_MS`). Pairings (`DRAGON_BREEDING`) climb toward the apex; Void
  pairs are sterile.
- **Mounts:** bonded species become unlockable mounts (`dragon:<id>`); the horse is always
  available. Mount unlocks persist and are never revoked by a client save.
- **Breath weapon** (`DRAGON_BREATH`): species-flavored projectile (fire/spores/frost/
  lightning/void) — combat only, breaks no blocks, on a `DRAGON_BREATH_CD_MS` cooldown.

---

## Familiars

Four bindable companions (`FAMILIAR_KINDS`), each consuming a bind item
(`FAMILIAR_BIND_ITEM`) and gated server-side; power scales with hunter level in five rank
bands (`SHADE_RANK_LVLS`, `famTier`):

| Familiar | Role | Effect |
|----------|------|--------|
| **Shade** | defense | Guarding Shade soaks 10–25% of incoming damage (`shadeMitigation`) |
| **Fang** | offense | bites the nearest hostile for 3–13 on a cooldown (`fangDamage`, `FANG_CD_MS`) |
| **Mote** | restoration | regenerates 0.6–2.2 HP/s, plus an emergency burst heal at higher ranks (`moteRegen`, `moteBurst`) |
| **Sprite** | forage | 12–32% chance of a bonus drop when gathering (`spriteForageChance`) |

---

## Land, teams & guilds

- **Land claims** ([`economy`](../server/rooms/economy.mixin.js) /
  [`GameRoom`](../server/rooms/GameRoom.js)): buy protection over a tile; price rises near
  town (`LAND_BASE_PRICE`, `LAND_NEAR_TOWN_BONUS`, fading with distance). Adjacent expansion
  receives a small discount so protected bases naturally grow as connected areas. A radius around
  town is free-to-build (`LAND_FREE_RADIUS`). The early base-setup goal only completes when
  storage, light, and a station are placed inside editable claimed land. Unclaimed wilderness is editable by anyone;
  claimed land rejects edits by untrusted players while still allowing the owner and
  permitted tokens. Claim owners manage trusted hunters from the claim panel, which labels the
  current tile as Owner, Trusted, Visitor, Wilderness, or Reclaimable so blocked building has an
  obvious social cause. Grants can target online players, trusted players receive a notice, and
  removals persist by account token. Claim activity is refreshed when
  the owner or a trusted hunter visits; inactive claims become **Dormant** after
  `LAND_DORMANT_DAYS` real days, then **Abandoned** and reclaimable after
  `LAND_ABANDONED_DAYS` real days. The land manager shows active/dormant/abandoned
  countdowns, dormant claims pulse amber in claim views, and visiting dormant land sends
  a refresh notice before protection loss can feel surprising. Owning a connected
  3-tile area upgrades the claim panel into a **Homestead** manager with small work
  orders: the server only accepts them while the owner stands inside that connected
  land, consumes supplies from personal chests physically placed inside the Homestead,
  and pays modest gold plus profession XP. Owners can mark a personal Homestead chest as
  **Homestead Supply**; trusted hunters can deposit into those chests but only the owner can
  withdraw, and Work Orders consume Supply Chests before other eligible Homestead storage.
  Trusted hunters standing in the Homestead can also contribute from their own accessible
  Homestead chests; the owner keeps the claim reward, while helpers receive small immediate
  profession-assist XP and appear on the order's contributor list.
- **Teams** ([`teams.mixin.js`](../server/rooms/teams.mixin.js), `TeamManager`): persistent
  parties (create/join/invite/kick/transfer, privacy + LFG flags). Team membership drives
  team-gate entry and shared discoveries.
- **Guilds:** larger persistent orgs with roles (leader/officer), invites, and a **guild
  hall** whose floors are purchased incrementally (`GUILD_FLOOR_MAX` = 6,
  `guildFloorPrice` = `500 + 250×floors`). Guild members may edit their owned floor.

---

## Weather

Server-owned like the day cycle (`state.weather`, driven in [`events.mixin.js`](../server/rooms/events.mixin.js)):
**clear → rain → storm** rotate on randomized timers (`WEATHER_DURATION_MS`, `WEATHER_NEXT`),
broadcast to every client and sent on join; solo mode runs a local machine with the same feel.

- **Rain** waters the fields — crop stage timers halve (`cropGrowMs`) — and animals shelter
  (reduced animal spawn budget). The world dims, fog closes in, and rain falls around the camera.
- **Storms** embolden hostiles away from town (+spawn budget), pause road caravans and
  roadside encounters, and hurl **lightning**: every 6–13s a bolt lands near a random surface
  hunter (`LIGHTNING_RADIUS`, damages hunters and fries mobs — friendlies immune, dungeons
  untouched, and the town is a sanctuary). Clients render the jagged bolt, a sky-flood flash,
  camera shake, and distance-delayed thunder.
- **Snowy biomes** render drifting snow instead of rain.

---

## Server events & the skyship

Driven by the room clock in [`events.mixin.js`](../server/rooms/events.mixin.js):

- **Parkour** (`EVENT_PARKOUR`): a generated course with three checkpoints; falls respawn
  at the last checkpoint, split times are tracked per checkpoint, finishing teleports the
  player back and awards tokens (`EVENT_REWARD_TOKENS`). The best finish persists on the
  profile (`parkourBestMs`) and new personal bests are called out in the results.
- **King of the Hill** (`EVENT_KING`, `KING_ACTIVE_MS` = 15m): an arena objective with
  crown-holder scoring per team.
- **Caravan Defence** (`EVENT_CARAVAN`, `CARAVAN_ACTIVE_MS` = 10m): a co-op escort (min 2
  hunters) through four bandit waves plus a captain. The wagon's HP scales with party size;
  bandit archers fire genuine dodgeable server arrows. Downed hunters are revived by a
  teammate standing close for 2s (or respawn at the wagon after 10s). Success pays 1–3
  Legendary Tokens by remaining wagon health (≥80% → 3, ≥50% → 2).

Events queue and run on `EVENT_QUEUE_MS` / `EVENT_ACTIVE_MS` cycles with an idle gap
(`EVENT_IDLE_MIN_MS` + jitter). The **skyship** is a roaming structure on a fixed
dock→travel→away cycle (`skyshipSnapshot`, `SKYSHIP_*`); S-rank hunters can board for a
gold fee (`SKYSHIP_BOARD_RANK`, `SKYSHIP_BOARD_GOLD`). **Sleeping** in a bed
(`handleSleep`) lets the party skip the night.

---

## Regional contracts

Repeatable objectives from the guild board (`REGIONAL_CONTRACT_TYPES`): scout a landmark,
clear an elite camp, collect a biome resource, recover a buried cache, solve a puzzle
shrine, or visit the road merchant. Contracts are validated and credited server-side and
persist only for the player's active job. Road-flavored contracts (`road_*`) additionally
build **Road Warden reputation** with milestones at 3 (Trail Sense + iron in the road
merchant's stock), 6 (cooked provisions + permanent price cuts), and 9 (maximum discount).
Trail Sense can also unlock from the Trailblazer exploration milestone after 10 mapped
discoveries, so road scouts and cartographers both get an active tracking utility.
Utility feedback is deliberately in-world as well as textual: Trail Sense paints a short-lived
track marker and activity card, Party Compass adds distance-bearing HUD states plus urgent
markers for downed/spirit allies, and Feather Step flashes at the landing point when it absorbs
or softens a hard fall.

---

## Roads: caravans, bandits & road safety

Daytime overworld life along the road network ([`spawning.mixin.js`](../server/rooms/spawning.mixin.js)):

- **Road caravans** are friendly convoys (wagon, merchant, mule, guards) that travel the
  roads and can be ambushed by bandit patrols; escorting one earns credit and a temporary
  road-merchant discount. Friendly actors can never be damaged by players.
- **Roadside encounters** spawn near travelling players: a *wounded hunter* to aid (aim +
  secondary action), a *merchant rescue* (kill the attackers before the merchant falls),
  or a *supply pursuit* (catch fleeing scouts before they escape). All expire on a timer
  and at nightfall.
- **Road safety** is a persisted 0–100 world meter (`worldProgress.roadSafety`) that
  drifts back toward 50 by one point per 20 minutes. Warden contracts and encounter
  successes raise it; failures lower it. It tunes bandit camp garrisons and patrol
  sizes, the encounter mix, and grants regional road-merchant discounts (5% at 60+,
  10% plus bonus stock at 80+). Tiers: overrun / dangerous / contested / patrolled /
  secure, surfaced in the client's activity tracker.

---

## PvP & threat model

PvP is a **light, opt-in side feature**, not the focus — and the authority split reflects
that deliberately.

**Movement is client-trusted.** The server never simulates positions; the `move` handler
([`GameRoom.js`](../server/rooms/GameRoom.js)) only *clamps* what the client reports — per-tick
step distance and velocity (anti-teleport), plus world/lava-border bounds. It does **not**
verify the path between two positions is unobstructed, so a modified client can effectively
**noclip** through terrain as long as it moves at a believable speed. This is an accepted
trade-off: full server-authoritative collision adds latency and complexity that would hurt
the cooperative play the game is built around, and there is no open-world PvP for it to
protect.

**Players cannot damage each other except through the consensual Aegis bounty.** There is no
free-for-all PvP. The *only* hostile player-vs-player channel is `pvpBountyHit`
([`events.mixin.js`](../server/rooms/events.mixin.js)): you take out a bounty contract on a
specific hunter, and only then can you strike them. That strike is fully server-validated, in
order:

1. a valid, unexpired bounty naming this exact target;
2. both hunters overworld (not in a dungeon), neither in town-protected ground, neither a
   King-of-the-Hill participant;
3. within `AEGIS_BOUNTY_RANGE` (4.6 blocks);
4. the **attacker is not embedded in terrain** (anti-noclip: body cells must be non-solid);
5. **clear line of sight** to the target (the same `AI.losClear` check melee uses — a wall
   blocks the strike);
6. a 450 ms per-hit cadence cap.

Damage itself is `serverDamageFor` (derived from the *server* inventory, never the cosmetic
`heldId`). So the historically exploitable surface — hitting a bounty target through a wall,
or noclipping next to one to line up the hit — is closed; the residual client trust (faster
traversal/escape via noclip) is bounded to opt-in 1v1 bounty duels and never reaches
cooperative play.

> The bounty path is covered by `server/test/authority.test.js` (line-of-sight and
> anti-noclip rejection tests); melee and ability casts carry their own line-of-sight tests.

---

## Persistence summary

A storage adapter (`server/store.js`) sits behind a fixed interface
(`loadWorldEdits`/`saveWorldEdits`, `loadPlayer`/`savePlayer`, plus chests, furnaces,
gates, land claims, incubations, nests, teams, guilds, world progress). Two backends:
**JsonStore** (default, atomic writes under `./data`, relocate with `DATA_DIR`) and
**FirebaseStore** (`STORE=firebase`). Every persisted field is sanitized on the way in;
the client `save` is rate-limited, size-capped, and never trusted for economy/identity.
See the README's **Persistence** section for the full boot/join/save flow.
Operational requirements and disaster recovery procedures live in
[`docs/DEPLOYMENT.md`](DEPLOYMENT.md).
