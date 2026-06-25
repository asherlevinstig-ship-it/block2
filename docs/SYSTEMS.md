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
has three abilities unlocked at levels **2 / 5 / 8** (`ABILITY_UNLOCK`), costing mana and
on cooldown (`ABILITY_PATHS`):

| Path | Ability 1 (Lv2) | Ability 2 (Lv5) | Ability 3 (Lv8) |
|------|-----------------|-----------------|-----------------|
| **shadow** | Shadow Dash (dash) | Umbral Edge (×1.6 dmg buff) | Shadow Soldier (summon) |
| **mage** | Fireball (proj, r3.0) | Frost Nova (slow, r6.5) | Lightning (chain) |
| **guardian** | Iron Skin (armor) | Shockwave (knock, r5.5) | Second Wind (passive revive) |

Abilities are resolved server-side in [`combat.mixin.js`](../server/rooms/combat.mixin.js):
fireballs are simulated projectiles, frost applies a visible slow `state`, lightning
chains to nearby mobs and roots them, and target-snapped casts still require line of sight.

---

## Professions

A hunter also has one **job** (`Player.job`): `adventurer`, `miner`, `farmer`, `cook`,
`blacksmith`, or `monk`. Profession level is derived from `jobXp` on a rising curve
(`jobLevelFromXp`: `30 × lvl^1.45` per level, cap 99). Perk strength steps at levels
**2 / 5 / 10 / 20** (`jobPerkTier` → tiers 1–4); `jobPerkChance` turns a tier into a bonus
proc chance (`base + tier × 0.05`).

Because some XP sources never reach the server, `jobXp` is **rate-capped on save**
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

## Economy: shops, keys & shards

Town vendors trade for **gold** (all server-validated in
[`economy.mixin.js`](../server/rooms/economy.mixin.js)):

- **General shop** (`SHOP_BUY` / `SHOP_SELL`): blocks, ores, basic gear, and dungeon
  keys.
- **Tavern** (`TAVERN_BUY` / `TAVERN_SELL`): potions (ale/stew/mana/swift/stone) and food.
- **Road merchant / guild decor** (`ROAD_MERCHANT_BUY`, `GUILD_DECOR_BUY`): biome
  collectibles, repair kits, and furnishing blocks.

**Gate keys** open private dungeons without waiting for a public gate. Solo keys
(`SOLO_KEYS`, prices `45→800`) and team keys (`TEAM_KEYS`, prices `70→1100`) come in five
ranks E→A. Keys drop from bosses and chests at tuned rates (`KEY_LOOT`).

**Dungeon Shards** (`SHARD_ITEM_IDS`, tiers Minor→Radiant = +1…+5) are attuned at the
plaza pedestal to open a **sharded gate** with rolled **affixes** (`SHARD_MOD_KEYS`,
`rollShardMods` → 1–3 mods). Stat affixes (Empowered/Fortified/Tyrannical/Frenzied) scale
mobs at spawn; the rest are **server-simulated hazards** (`HAZARD_MOD_SET`): Volatile
corpse blasts, Sanguine ichor pools, Spiteful ghosts, Bursting/Grievous bleeds, Quaking
shockwaves, Explosive orbs. Clearing one rewards bonus loot + a Legendary Weapon Token.

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
  town (`LAND_BASE_PRICE`, `LAND_NEAR_TOWN_BONUS`, fading with distance). A radius around
  town is free-to-build (`LAND_FREE_RADIUS`); claimed land rejects edits by others.
- **Teams** ([`teams.mixin.js`](../server/rooms/teams.mixin.js), `TeamManager`): persistent
  parties (create/join/invite/kick/transfer, privacy + LFG flags). Team membership drives
  team-gate entry and shared discoveries.
- **Guilds:** larger persistent orgs with roles (leader/officer), invites, and a **guild
  hall** whose floors are purchased incrementally (`GUILD_FLOOR_MAX` = 6,
  `guildFloorPrice` = `500 + 250×floors`). Guild members may edit their owned floor.

---

## Server events & the skyship

Driven by the room clock in [`events.mixin.js`](../server/rooms/events.mixin.js):

- **Parkour** (`EVENT_PARKOUR`): a generated course; finishing teleports the player back
  and awards tokens (`EVENT_REWARD_TOKENS`).
- **King of the Hill** (`EVENT_KING`, `KING_ACTIVE_MS` = 15m): an arena objective with
  crown-holder scoring per team.

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
persist only for the player's active job.

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
