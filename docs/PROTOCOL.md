# Client ↔ server message catalogue

The game is a [Colyseus](https://colyseus.io) room (`blockcraft`,
[`server/rooms/GameRoom.js`](../server/rooms/GameRoom.js)). State that every client needs
to *see* (players, mobs, edits, gates, teams, time of day) lives in the synced
[`State` schema](../server/schema.js) and replicates automatically. Everything else is an
explicit **message**.

- **Client → server** messages are registered with `this.onMessage('name', …)` in
  `onCreate`. Handlers validate, mutate authoritative state, and usually reply.
- **Server → client** messages are `client.send('name', …)` (one client),
  `this.broadcast('name', …)` (everyone), or scoped to a dungeon instance via
  `sendSpace(dgn, …)`.

By convention a request `foo` is answered with `fooResult` on success and `fooReject`
on failure. This catalogue lists names and intent; for exact payload shapes read the
handler — they're short and grouped by system in `rooms/*.mixin.js`.

---

## Synced state (no message — replicated automatically)

`State`: `teams`, `players` (`Player`), `mobs` (`Mob`), `edits` (`"x,y,z" → block id`),
`gate` (legacy first-public mirror), `gates` (`id → Gate`), `tod` (time of day). See
[`server/schema.js`](../server/schema.js) for every field.

---

## Client → server

### Movement & presence
| Message | Purpose |
|---------|---------|
| `move` | position/yaw at ~12 Hz; speed-clamped server-side |
| `meta` | cosmetic/presence updates (held item, armor, familiar, etc.) |
| `sleep` | request to sleep through the night |
| `chat` | global chat |
| `tchat` | team chat |

### Building & survival
| Message | Purpose |
|---------|---------|
| `edit` | place/break a block (overworld); fully validated |
| `dedit` | place/break a block inside a dungeon instance |
| `trainingReset` | reset the Training Meadow sandbox |
| `landClaimBuy` | purchase protection over a tile |
| `useFood` | eat an inventory food item |
| `useRepairKit` | repair the held/selected tool |
| `farm` | till / plant / harvest crops |

### Crafting, economy & storage
| Message | Purpose |
|---------|---------|
| `craft` | craft from the grid (`RECIPES`) |
| `craftLegendary` | spend tokens to craft a legendary weapon |
| `shop` | buy/sell at a town vendor |
| `blacksmithRepair` / `blacksmithUpgrade` | blacksmith services |
| `chestOpen` / `chestDeposit` / `chestWithdraw` | placed-chest storage |
| `furnaceOpen` / `furnaceSmelt` / `furnaceTake` | furnace smelting |

### Combat & abilities
| Message | Purpose |
|---------|---------|
| `attack` | melee swing (range + LoS + rate checked, damage from server inventory) |
| `ability` | cast a class ability (`ABILITY_PATHS`) |
| `blackhole` / `legendaryWeapon` | legendary-weapon casts |
| `dragonAbility` / `dragonBreath` | mounted-dragon attacks |
| `requestAegisBounty` / `pvpBountyHit` | PvP bounty flow |
| `eventHit` | register a hit during a server event |

### Dungeons & gates
| Message | Purpose |
|---------|---------|
| `enterGate` / `exitGate` | enter/leave a gate's instance |
| `dungeonLobbyReady` / `dungeonLobbyLeave` | party-lobby readiness before a run |
| `useGateKey` | open a solo/team keyed gate |
| `attuneShard` | open a sharded (affixed) gate at the pedestal |

### Dragons & familiars
| Message | Purpose |
|---------|---------|
| `hatchDragonEgg` | start incubation on an Egg Insulator |
| `perchDragon` / `recallDragon` | move a dragon to/from a nest |
| `feedDragon` / `feedMountedDragon` | care / love for breeding |
| `renameDragon` | rename a bonded dragon |
| `mount` / `dismount` | mount a horse or unlocked dragon |
| `bindFamiliar` / `summonFamiliar` / `dismissFamiliar` | familiar lifecycle |

### Teams & guilds
| Message | Purpose |
|---------|---------|
| `teamCreate` / `teamJoin` / `teamLeave` | persistent party membership |
| `teamInvite` / `teamKick` / `teamTransfer` | party management |
| `teamPrivacy` / `teamLfg` | privacy + looking-for-group flags |
| `guildCreate` / `guildJoin` / `guildLeave` | guild membership |
| `guildInvite` / `guildKick` / `guildRole` | guild management |
| `guildPrivacy` / `guildFloorBuy` / `guildHallRequest` | guild settings & hall floors |

### World events, skyship & contracts
| Message | Purpose |
|---------|---------|
| `eventJoin` / `eventLeave` | join/leave the active server event |
| `eventReady` | ready-check answer while an event is staging |
| `eventHit` | King-of-the-Hill crown strike |
| `eventDebugStart` | (beta) start an event immediately |
| `banditSpare` | spare a surrendered bandit for bonus standing |
| `roadsideInteract` | resolve a roadside encounter (aid the wounded hunter) |
| `skyshipBoard` / `skyshipSyncRequest` | board the skyship / resync its position |
| `dayCycleSyncRequest` | resync the day/night clock |
| `regionalContracts` / `regionalContractAccept` / `regionalContractAbandon` | contract board |
| `regionalContractClaim` / `regionalContractVisit` | progress & rewards |
| `discoveryInteract` / `discoverySight` | world discoveries |

### Loadout, persistence & onboarding
| Message | Purpose |
|---------|---------|
| `save` | client state snapshot (economy/identity fields ignored; rate-limited) |
| `utilityLoadout` | equip server-earned utilities (compass, minimap, …) |
| `claimFirstQuestReward` | first-quest reward |

### Gear & professions
| Message | Purpose |
|---------|---------|
| `equipWeapon` / `equipArmor` | validated gear equips |
| `gearLock` | lock/unlock an item against salvage |
| `blacksmithReforge` / `blacksmithSalvage` | reforge modifiers and salvage returns |
| `prospect` | miner ore survey (level-gated, on cooldown) |
| `jobContract` | take/claim/abandon contracts from the offer boards |
| `lootRecovery` | reclaim gear banked when the inventory was full |

---

## Server → client

Grouped by intent. `*Result` = success, `*Reject` = rejected/invalid.

- **Identity & loadout:** `profile`, `grant`, `toolSync`, `abilitySync`, `utilityLoadout`,
  `utilityUnlock`, `firstQuestReward`.
- **World & building:** `editReject`, `dedit`, `trainingReset`, `landClaims`,
  `landClaimUpdate`, `landClaimResult`/`landClaimReject`, `mineNoDrop`.
- **Combat & status:** `hurt`, `xp`, `dmgnum`, `loot`/`lootReject`, `hunger`,
  `worldDeath`, `abilityResult`/`abilityReject`, `blackholeReject`, `legendaryReject`,
  `devMana`.
- **PvP:** `pvpBountyAssigned`, `pvpBountyComplete`, `pvpBountyFail`, `pvpBountySlain`,
  `pvpBountyReject`.
- **Economy & storage:** `craftResult`/`craftReject`, `craftLegendaryResult`/
  `craftLegendaryReject`, `shopResult`/`shopReject`, `repairResult`/`repairReject`,
  `blacksmithRepairResult`/`blacksmithUpgradeResult`/`blacksmithReject`,
  `chestState`/`chestTx`/`chestReject`, `furnaceState`/`furnaceStarted`/`furnaceResult`/
  `furnaceReject`, `foodResult`/`foodReject`, `farmResult`/`farmReject`.
- **Dungeons & gates:** `enterDungeon`, `dungeonStatus`, `dungeonLobby`/
  `dungeonLobbyStart`/`dungeonLobbyClosed`, `dungeonDeath`, `dungeonFailed`,
  `gateCleared`, `gateReject`, `gateKeyResult`/`gateKeyReject`,
  `shardAttuneResult`/`shardAttuneReject`.
- **Dragons & familiars:** `dragonIncubationStart`/`Ready`/`Complete`/`Remove`,
  `dragonPerchAdd`/`Remove`/`Love`/`Breed`, `dragonCare`,
  `dragonRenameResult`/`dragonRenameReject`, `hatchDragonReject`,
  `feedDragonResult`/`feedDragonReject`, `perchReject`,
  `dragonAbilityResult`/`dragonAbilityReject`, `familiarBound`/`familiarReject`.
- **Teams & guilds:** `teamResult`, `teamInvite`, `teamLeft`, `guildCreated`,
  `guildJoined`, `guildLeft`, `guildInvite`, `guildResult`/`guildReject`,
  `guildFloorResult`, `guildHallSync`.
- **Events, skyship & world clock:** `eventStatus`, `eventStarted`, `eventJoined`,
  `eventLeft`, `eventComplete`, `eventFailed`, `eventResult`, `eventCancelled`,
  `eventAfk`, `eventCrown`, `eventTeleport`, `eventCheckpoint`, `eventCaravanWave`/
  `eventCaravanDowned`/`eventCaravanRevived`, `eventReject`, `skyshipSync`,
  `skyshipBoardResult`/`skyshipBoardReject`, `dayCycleSync`,
  `sleepComplete`/`sleepWait`/`sleepReject`.
- **Roads & overworld activity:** `overworldActivity`, `roadsideEncounter`,
  `roadsideEncounterResult`/`roadsideEncounterReject`, `roadSafetyChanged`.
- **Weather:** `weather` (kind + rotation deadline, sent on join and on change),
  `weatherBolt` (lightning strike position for the client flash/bolt/thunder).
- **Gear & professions:** `weaponIdentity` (momentum stacks), `armorSync`,
  `gearLockResult`, `blacksmithReforgeResult`/`blacksmithSalvageResult`,
  `prospectResult`/`prospectReject`, `foodBuff`,
  `lootRecoveryState`/`lootRecoveryResult`.
- **Contracts & discoveries:** `regionalContracts`, `regionalContractUpdate`,
  `regionalContractReady`, `regionalContractClaimed`, `regionalContractReject`,
  `discoveryResult`/`discoveryReject`, `discoverySighted`, `biomeFind`.
- **Chat:** `chat`, `tchat`.

> Lightweight visual-only events (`fx`, `arrow`, telegraph rings) ride alongside these;
> the client renders them from `Mob.state` plus these one-shot messages so visuals stay in
> sync with the authoritative simulation.
