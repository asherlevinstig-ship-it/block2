# Blockcraft MP — multiplayer voxel RPG on Colyseus

A Solo-Leveling-flavored voxel survival RPG (mining, crafting, smelting, classes,
abilities, dungeon gates) running as a multiplayer game on a
[Colyseus](https://colyseus.io) authoritative server.

## Quick start

```bash
npm install
npm start
# open http://localhost:2567 in two browser windows
```

Create an account (or sign in), choose a hunter name, and hit PLAY. Multiplayer
requires an authenticated server session; the standalone client still supports
solo mode when the Colyseus SDK is not present.

## Project layout

```
package.json            zero-build plain JS (defineTypes, no decorators)
server/
  index.js              express static host + colyseus.js browser SDK (vendored) + server bootstrap
  schema.js             synced state: teams, players, mobs, block-edit map, gates, time of day
  world.js              deterministic overworld generator (terrain, biomes, town, trees) + height/biome queries
  dungeon.js            deterministic dungeon generator (byte-identical on client and server, test-verified)
  ai.js                 shared mob brain helpers (voxel line-of-sight, solid lookups)
  teams.js              TeamManager — persistent party bookkeeping
  store.js              storage adapter (JsonStore / FirebaseStore) + profile sanitizers and anti-cheat merges
  rooms/
    GameRoom.js         the room: onCreate/onJoin/onLeave, 80+ message handlers, 10 Hz sim loop
    constants.js        all tuning tables, item ids, recipes, drop tables, and pure gameplay helpers
    mixin.js            copies a method group onto GameRoom.prototype (keeps call sites + tests unchanged)
    combat.mixin.js     melee, abilities, legendary weapons, projectiles, loot, mob kills
    dungeon.mixin.js    gates, party/solo/team/shard instances, dungeon hazards, clears
    dungeonInstance.js  DungeonInstance class — per-instance state (world/edits/roster/hazards)
    economy.mixin.js    crafting, smelting, shops, chests, furnaces, inventory mutation
    spawning.mixin.js   overworld density spawning, elite camps, boss brain, gate placement
    events.mixin.js     server events (parkour, King of the Hill, Caravan Defence), skyship, day cycle, sleep
    teams.mixin.js      persistent teams: create/join/invite/kick/transfer/LFG
    metrics.mixin.js    behaviour-free load metrics (instances, dungeon mob-sync waste, tick ms)
    dragons.mixin.js    dragons (hatch/incubate/breed/perch/mount/breath) and familiars
  test/
    authority.test.js   156 unit tests, mostly anti-cheat and server-authority assertions
    integration.test.js boots a room and exercises the join → play → save round-trip
client/
  index.html            rendering/gameplay shell and module composition root
  js/auth.mjs           account/session UI controller
  js/inventory.mjs      inventory stacking/removal and equipment profile model
  js/network.mjs        join/resume/reconnect lifecycle controller
  js/progression.mjs    authoritative progression message reconciliation
  js/quests-jobs.mjs    quest progress and profession XP/contract rules
  js/reconnect.mjs      bounded WebSocket reconnect policy
  js/rendering.mjs      Three.js renderer/camera lifecycle
  styles.css            UI/HUD stylesheet (extracted from index.html, linked + served statically)
  vendor/colyseus.browser.js   prebuilt standalone Colyseus browser SDK (served at /colyseus.js)
data/                   default JsonStore output (world.json, players/, chests, furnaces, gates, …)
```

`GameRoom` is split across `rooms/*.mixin.js` purely for file size: each mixin is a
plain object whose methods are copied onto `GameRoom.prototype` at load time, so every
method still lives on one class and the test harness (`Object.create(GameRoom.prototype)`)
sees them all. All tuning lives in `rooms/constants.js`.

## Architecture

**Deterministic world, delta edits.** Client and server generate the identical
world from the same seeded hash-noise, so the 1MB voxel array is never sent.
Only block *edits* live in synced state (`edits: MapSchema<"x,y,z" -> id>`);
joining players receive the full edit history automatically and deltas
broadcast live. The server validates every edit: world bounds, valid block id,
no bedrock, and a 10-block reach check from the editing player.

**Authority split.**

| System            | Authority | Notes |
|-------------------|-----------|-------|
| Movement          | client    | position relayed at ~12 Hz, speed-clamped server-side (mounted clamp is looser); no anti-noclip |
| Block edits       | server    | validated (bounds, block id, reach, town/land/event protection), then synced to everyone |
| Overworld mobs    | server    | 10 Hz AI: local-density spawning by danger ring, chase/attack (`hurt` msg), die (`xp` msg to killer) |
| Animals           | server    | biome-flavored passive spawns; hunting drops meat + biome collectibles |
| Time of day       | server    | clients render sun/moon/fog from the shared clock (`tod`); sleeping skips the night |
| Weather           | server    | clear/rain/storm rotates on the server clock (`state.weather`); rain waters crops, storms embolden hostiles, shelter animals, pause caravans, and hurl damaging lightning (town is a sanctuary) |
| Gates             | server    | id + seed + rank broadcast; public gates open on a timer, keyed/shard gates on demand |
| Dungeons          | server    | **party instances**: everyone entering the same gate shares one instance, mobs/boss/hazards simulated |
| Inventory / gold / crafting / shops | server | validated server-side; the `save` message ignores client-sent inventory, gold, level, XP and stats |
| Melee & abilities | server    | damage derived from the *server* inventory (not the cosmetic `heldId`), line-of-sight + range + rate checked |
| Legendary weapons | server    | each weapon's effect (meteors, chains, blackholes, revives…) is fully simulated server-side |
| Dragons & familiars | server  | hatching, breeding, mounts, breath, and familiar binds are all server-gated per species/item |
| Profession XP     | server    | `jobXp` is server-owned: the save channel ignores client-sent profession XP entirely, and only validated server handlers (mining, kills, quests, contracts, meditation…) grant it, each clamped per event, so a forged save can't claim an instant max profession |
| Land / guilds / teams | server | claims, guild-hall floors, and persistent parties are owned and persisted server-side |
| Server events     | server    | parkour, King of the Hill, and Caravan Defence instances, scoring, and the roaming skyship run on the server clock |
| Roads & road safety | server  | road caravans, roadside encounters, and the persisted road-safety meter are simulated and rewarded server-side |

See [docs/SYSTEMS.md](docs/SYSTEMS.md) for the full gameplay-system reference (professions,
classes & abilities, biomes, economy, dragons, familiars, events…) and
[docs/PROTOCOL.md](docs/PROTOCOL.md) for the client↔server message catalogue.

**Party dungeons.** Gates carry an `id` and a random `seed`. Right-clicking a
gate sends `enterGate`; the server creates (or joins you into) the instance for
that gate, spawns its monsters and boss into shared state tagged with the
instance id, and replies with `{seed, rank, edits}` — the client rebuilds the
*identical* dungeon locally from the seed (the generator is byte-identical on
both sides, verified by test), then applies the edit log to catch up on any
mining the party already did. Players and mobs filter visibility by instance
tag, mining inside syncs party-wide via `dedit`, the boss has extended reach
and rank-scaled stats, and killing it sends `gateCleared` + a `loot` payload to
every hunter inside. The last one out collapses the instance. The HUD shows
"party of N" while you're raiding together.

**Remote players** render as block avatars with floating name tags showing
`Name LvN` tinted by class path, interpolated between updates, with walk
animation driven by velocity. Press **Enter** to chat.

**Scaling note.** One `GameRoom` = one 16-player world. Colyseus will spin up
additional rooms automatically as more players join; party dungeons are a
natural next step as a `DungeonRoom` joined by gate id.

**Server-side AI.** Mob brains run on the server at 10 Hz (`server/rooms/GameRoom.js`
+ `server/ai.js`): dungeon trash sleeps and patrols its room until it gains
voxel line-of-sight on a hunter (or the pack is alerted by combat — waking one
wakes everything within 9 blocks); zombies approach on individual flank angles
with separation steering and attack via a telegraphed rooted lunge; skeletons
kite to their range band, strafe, require line-of-sight to fire, visibly draw
for half a second, and lead their shots using server-tracked player velocity.
Arrows and bolts are genuine server-simulated projectiles (3 physics substeps
per tick, so they're dodgeable), validated against the correct world buffer per
dungeon instance. The boss runs a five-pattern state machine — slam, charge
(wall-crash stuns it and opens a +50% damage window), shadow-bolt volley,
ground spikes at C-rank+, plus threshold summons and enrage that hastens
everything. Clients render all of it from a synced `Mob.state` field (windup
poses, warning rings) plus lightweight `fx`/`arrow` events; the client is
regenerated from the single-player source by a patch pipeline so visuals,
audio, and models always match the latest game.

**Party-capable sharded gates.** Attuning a Dungeon Shard at the plaza pedestal
opens a server-authoritative *sharded gate* (`kind: 'shard'`): the attuner owns
it and their **team** parties in (inviting = `team join`). The server rolls the
affixes, scales mobs at spawn (Empowered/Fortified/Tyrannical plus a per-`+N`
bump, Frenzied at runtime), and simulates all environmental hazards — Volatile
corpse blasts, Sanguine ichor pools, Spiteful ghosts, Bursting/Grievous bleed
DoTs, Quaking shockwaves, Explosive orbs, and Bolstering (each trash death
empowers nearby survivors, stacking) — (orbs and ghosts ride the normal
`Mob` sync; everything else is driven by `fx` events the client renders). On a
clear every eligible hunter receives bonus loot and a Legendary Weapon Token.

**Persistence.** The overworld is deliberately **one global world**, not one
world per Colyseus room. Exactly one `GameRoom` may own its persistence lease
in a server process. At the 16-player capacity, matchmaking fails closed
instead of creating a second, unsynchronized writer. World state (edits,
claims, containers, gates, teams, and guilds) lives in the single `main`
namespace; profiles remain isolated by verified account ID. Run one
game-server process; horizontal replicas require a shared simulation or
elected leader, not additional Colyseus rooms.

The world and every Hunter survive restarts. A storage
adapter (`server/store.js`) sits behind four calls — `loadWorldEdits`,
`saveWorldEdits`, `loadPlayer`, `savePlayer` — with two backends:

- **JsonStore** (default): atomic writes to `./data/world.json`, account records
  in `./data/auth.json`, and profiles in `./data/players/{accountId}.json`.
  Set `DATA_DIR` to relocate.
- **FirebaseStore**: `npm i firebase-admin`, then run with `STORE=firebase`
  and either `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account
  key or `FIREBASE_SERVICE_ACCOUNT` containing the JSON inline. World edits
  are sharded into `worlds/main/chunks/{cx_cz}` documents (never near the
  1MB Firestore limit); profiles live at `players/{accountId}`.

Identity uses first-party accounts with scrypt-hashed passwords. Successful
login creates a random server-side session referenced by an HttpOnly,
`SameSite=Strict` cookie. Colyseus verifies the cookie during matchmaking and
uses the server-issued account ID as the profile key; clients cannot select or
forge profile ownership. Sessions last seven days and are invalidated by a
server restart or explicit logout.

Flow: on boot the room replays saved edits into the deterministic world; on
join the server loads your profile, spawns you at your last overworld
position, and sends a `profile` message the client restores from (stats,
class, inventory with tool durability). The client snapshots itself every
10s when something changed; the server sanitizes every field (rate-limited,
size-capped, dungeon coordinates never persisted), flushes dirty state every
30s, on each departure, and on shutdown. Failed writes stay dirty and retry.

## Tuning

Nearly all tunables live in [`server/rooms/constants.js`](server/rooms/constants.js); room size
and the sim rate live in `GameRoom.js`.

- **Day length:** `DAY_LEN` (600s) — must match the client's copy.
- **Weather:** `WEATHER_DURATION_MS` / `WEATHER_NEXT` (rotation), `LIGHTNING_INTERVAL_MS`,
  `LIGHTNING_RADIUS`, `LIGHTNING_PLAYER_DMG` / `LIGHTNING_MOB_DMG`, `weatherSpawnMods`.
- **Overworld spawning:** `hostileBudgetFor` / `animalBudgetFor` (per-player, per-ring budgets),
  `LOCAL_HOSTILE_COUNT_RADIUS`, `HOSTILE_DESPAWN_RADIUS`, `HOSTILE_SPAWN_INTERVAL`; `MOB_CAP`/`ANIMAL_CAP`
  remain as fallbacks.
- **Danger rings:** `DANGER_RINGS` (hp/dmg/loot multipliers + mob families by distance from town).
- **Gates:** `GATE_DISTANCE_BANDS` (spawn distance per rank), `gateTimer` (public cadence),
  `SOLO_KEY_PRICES` / `TEAM_KEY_PRICES`, `KEY_LOOT` (key drop rates).
- **Dungeon rewards:** `BOSS_REWARD_BY_RANK`, `CHEST_REWARD_BY_RANK`, `BOSS_CONTRIB_MS`.
- **Dragons:** `DRAGON_TYPES`, `DRAGON_BREEDING`, `DRAGON_INCUBATION_MS_BY_TYPE`,
  `DRAGON_EGG_CHEST_CHANCE` / `DRAGON_EGG_BOSS_CHANCE`, `DRAGON_BREATH`.
- **Server events:** `EVENT_QUEUE_MS`, `EVENT_ACTIVE_MS`, `EVENT_IDLE_MIN_MS`, `EVENT_REWARD_TOKENS`,
  `KING_ACTIVE_MS`, `CARAVAN_ACTIVE_MS`, skyship `SKYSHIP_*`.
- **Economy:** `SHOP_BUY` / `SHOP_SELL`, `TAVERN_BUY` / `TAVERN_SELL`, `LAND_BASE_PRICE`,
  `guildFloorPrice`, `RECIPES`, `SMELT`, `TOOL_INFO` (durability).
- **Room size & sim rate:** the single global room has a hard `maxClients` of
  16 and the `setSimulationInterval(…, 100)` 10 Hz tick in `GameRoom.js`.

> **Dev/test affordances** in `constants.js` — `BETA_LEGENDARY_TEST`, `BETA_FARM_TEST`, `BETA_EVENT_TEST`
> (legendary `testWeapon` casts without owning the weapon, the auto-granted farm starter kit, and the
> event debug-start shortcut) — are **off in production**. They derive from `BETA_TEST`, which is enabled
> only when `BLOCKCRAFT_BETA_TEST=1`; the test suite sets it before requiring the server. To exercise the
> beta paths locally, run with that env var set.

## Tests

```bash
npm test               # authority, authentication, and client-module unit tests
npm run test:e2e       # browser progression, socket reconnect, and reload restoration
npm run test:integration   # boots a room and runs the join → play → save round-trip
```

The unit suite is overwhelmingly **anti-cheat and authority** coverage: forged saves can't grant
gold/XP/items, melee damage is validated against the real inventory, mounts/dragons/familiars are
server-gated, rate limiters throttle floods, PvP bounty strikes are range/line-of-sight/terrain
validated, shard affix hazards (Volatile/Explosive/Quaking/Sanguine/Bursting/Grievous/Bolstering) deal the
right damage in the right radius, and the dungeon generator is asserted byte-identical to the client's.

Both suites run on every push and pull request via [GitHub Actions](.github/workflows/ci.yml).
