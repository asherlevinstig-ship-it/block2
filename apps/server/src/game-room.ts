import { Client, Room } from "@colyseus/core";
import { CHAMPION_CHARGE, ChatSendSchema, PlayerNameSchema, type NearbyChatMessage } from "@blockcraft/protocol";
import { cleanChatText, hearsNearbyChat } from "./nearby-chat.js";
import { PartyRequestSchema } from "@blockcraft/protocol";
import { Parties } from "./parties.js";
import { TradeRequestSchema } from "@blockcraft/protocol";
import { Trading } from "./trading.js";
import { BLACKSMITH_STOCK, BlacksmithBuySchema, ITEM_DEFINITIONS, ArmourEquipSchema, armourStats, armouredDamage } from "@blockcraft/protocol";
import { weaponPurchase } from "./blacksmith.js";
import { awareMobTarget, createMobAwareness, provokeMob, type MobAwareness } from "./mob-awareness.js";
import { spacedMobDesired } from "./mob-spacing.js";
import { turnBruteAim } from "./brute-aim.js";
import { meleeSlotsFull, meleeWaitingGoal } from "./melee-coordination.js";
import { checkMobProgress, type MobProgress } from "./mob-progress.js";
import { mobAssistants, MOB_ASSIST_COOLDOWN_MS } from "./mob-assist.js";
import { circleCrawler, createCrawlerPositioning, type CrawlerPositioning } from "./crawler-positioning.js";
import { FRONTIER_CHAMPION_ID, SILVER_CHAMPION_ID, championPattern, spitterChampionShots, combatMobDefinition, moveChampionCharge, championChargeHits } from "./frontier-champion.js";
import { WildernessEventCycle, WILDERNESS_EVENT_ID, WILDERNESS_EVENT_POSITION } from "./wilderness-event.js";
import { equipmentForItem, armourForItem, isEquipmentItem, EQUIPMENT_LOOT_RANGE, LootCollectRequestSchema, type LootCollectResult } from "@blockcraft/protocol";
import { WILDERNESS_ENCOUNTERS } from "./wilderness-encounters.js";
import { ROAMING_PACKS, roamingMemberId, roamingMembership, roamingPackAllows, roamingGoal,
  createRoamingRouteState, advanceRoamingRoute, type RoamingRouteState } from "./roaming-packs.js";
import { BRUTE_SLAM, bruteSlamCenter, FRONTIER_BRUTE, frontierBrutePattern, bruteSmashHits, CRAWLER_RUSH_MS, crawlerRushDistance } from "@blockcraft/protocol";
import { createSpitterPositioning, positionSpitter, type SpitterPositioning } from "./spitter-positioning.js";
import { HEALING_POTION, type PotionUpdate } from "@blockcraft/protocol";
import { canBuyPotionAtKeeper, potionBuyError, potionUseError } from "./healing-potions.js";
import { MINERAL_REGROWTH_MS, type MineralDepositStatus } from "@blockcraft/protocol";
import { RENEWABLE_MINERAL_DEPOSITS, authoredMineralAt, SURFACE_HEIGHT, CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME } from "@blockcraft/voxel-world";
import { mineralCellOccupied } from "./mineral-regrowth.js";
import { CAVE_ENCOUNTERS, caveEncounterAllows } from "./cave-encounters.js";
import { miningDurationMs, miningLineClear } from "@blockcraft/voxel-world";
import type { MineBlockRequest } from "@blockcraft/protocol";
import {
  AttackRequestSchema,
  playerMeleeStrike,
  mobMeleeStrike,
  mobMeleeImpactMs,
  mobAimCommitMs,
  BLACKSMITH_UPGRADES,
  BlacksmithForgeSchema,
  ChunkRegionRequestSchema,
  IRON_ORE_GOLD_PRICE,
  BRAMBLE_SNARE,
  DodgeRequestSchema,
  DefenseRequestSchema,
  HUNTERS_MARK,
  MAIN_HAND_DEFINITIONS,
  MainHandEquipRequestSchema,
  MineBlockRequestSchema,
  MoveRequestSchema,
  POWER_DEFINITIONS,
  PlayerProfileTokenSchema,
  WEAPON_ATTACK_DEFINITIONS,
  PowerCancelRequestSchema,
  PowerEquipRequestSchema,
  PowerRequestSchema,
  SEISMIC_CLEAVE_UPGRADES,
  SeismicMasteryEquipRequestSchema,
  SpecialRequestSchema,
  SpecialEquipRequestSchema,
  TraitEquipRequestSchema,
  TavernQuizAnswerSchema,
  TavernQuizDecisionSchema,
  TavernQuizStartSchema,
  TAVERN_QUIZ_MAX_PAYOUT,
  TAVERN_QUIZ_STARTING_COINS,
  type ActionRejected,
  type BlacksmithUpdate,
  type BlacksmithUpgradeId,
  type BlockChanged,
  type BrambleSnarePlaced,
  type BrambleSnareTriggered,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatReward,
  type CombatStagger,
  type DefenseResolved,
  type MainHandId,
  type MobHazardPlaced,
  type MobProjectileReleased,
  type PlayerHit,
  type ProjectileResolved,
  type PowerCast,
  type PowerCancelled,
  type PowerFracture,
  type PowerId,
  type PowerResolved,
  type SeismicMasteryId,
  type SpecialApplied,
  type SpecialConsumed,
  type SpecialProgressed,
  type TraitId,
  type WorldBootstrap,
  type WorldObjectiveUpdate,
  type WeaponAttackReleased,
  type ItemId,
  type LootPickedUp,
  type ResourceGathered,
  type TavernQuizUpdate,
  WORLD_BOOTSTRAP_CHUNK_RADIUS,
  WORLD_STREAM_CHUNK_RADIUS,
  type ChunkRegion,
} from "@blockcraft/protocol";
import {
  Block,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  GRAVITY,
  TERMINAL_VELOCITY,
  generateChunk,
  getBlock,
  highestSolidY,
  isProtectedVoxel,
  isPlayerSupported,
  resolvePlayerMotion,
  resolveSweptHorizontalMotion,
  setBlock,
  worldToChunk,
  type BlockId,
  type GeneratedChunk,
} from "@blockcraft/voxel-world";
import { InventoryItemState, LootDropState, MobState, PlayerState, WorldState } from "./schema.js";
import { miningRejectionReason, movementRejectionReason, nextComboStep, selectAttackTarget } from "./action-rules.js";
import { dodgeDirection, isInsideImpact, pursueTarget } from "./combat-rules.js";
import { GUARD_MINIMUM_STAMINA, GUARD_STAMINA_DRAIN_PER_SECOND, PARRY_STAGGER_MS, isAttackInGuardArc, resolveDefense } from "./defense-rules.js";
import { MOB_ARCHETYPES, damageAfterArmor, defeatReward, mobArchetype, type MobArchetypeId } from "./mob-archetypes.js";
import { MOB_TOWN_MINIMUM_RADIUS, dangerBandAt, isInsideTownSafeZone, keepMobOutsideTown, radiusFromSafeCenter, scaledMobStats } from "./radial-difficulty.js";
import { executionerDamageBonus, gainMomentum, guardStaminaCost, momentumAfterDefense, movementSpeedWithMomentum, parryStaminaRestore, staminaRecoveryWithMomentum } from "./trait-rules.js";
import { compatiblePowerOrFallback, fracturedBlockResult, isGroundPowerTargetInRange, isPowerCompatible, isSeismicAftershockTarget, mobilityAdvanceDistance, powerDirection, powerEvadeDirection, seismicCleaveProfile, selectBurstPowerTargets, selectGroundPowerTargets, selectLinePowerTargets, selectMobilityPowerTarget, widenedLineFractureColumns } from "./power-rules.js";
import { huntersMarkDamageBonus, huntersMarkPowerPayoff, isBrambleSnareTargetInRange, isInsideBrambleSnare, progressHuntersMark, selectHuntersMarkTarget, type ActiveSpecialMark } from "./special-rules.js";
import { inventoryTotal, isLootInPickupRange, lootForArchetype, armourDropForMob, LOOT_DESPAWN_MS } from "./loot-rules.js";
import { canEquipMainHand } from "./equipment-rules.js";
import { PLAYER_SAVE_HASH, applyPlayerSave, parsePlayerSave, serializePlayerSave } from "./player-save.js";
import { canUseStorage, transferStoredItem } from "./personal-storage.js";
import { leaveRecoveryBag, collectRecoveryBag } from "./death-recovery.js";
import { spitterPattern, spitterShotEndpoints } from "@blockcraft/protocol";
import { MATRIARCH_PHASE, matriarchEnraged, matriarchPattern } from "@blockcraft/protocol";
import { CombatContributions } from "./combat-contributions.js";
import { SilverGuardVolley } from "./silver-guard-volley.js";
import { ForestPortalCycle } from "./forest-portal-cycle.js";
import { FOREST_PORTAL_LIFETIME_MS, canUseForestPortal } from "@blockcraft/protocol";
import { FOREST_PORTAL_POSITION, FOREST_DUNGEON_ENTRY, FOREST_DUNGEON_EXIT, FOREST_DUNGEON_MOBS, isInForestDungeon } from "@blockcraft/voxel-world";
import { ForestPortalState } from "./schema.js";
import { canStartTavernQuiz, doubledPayout, drawQuizQuestion, mustSettleQuiz, type QuizRound } from "./tavern-quiz.js";
import { blacksmithNextStep, canTradeAtBlacksmith, forgeBlacksmithUpgrade, ironCapacity, mineralSale, ironSwordDamageBonus, minedIronQuantity, minedMineral, ownedBlacksmithUpgrades, ownsBlacksmithUpgrade } from "./blacksmith.js";
import { GREENWOOD_CRAWLER_HOMES, STONE_BRUTE_ARENA_HOME, isInStoneBruteArena } from "@blockcraft/voxel-world";
import {
  applyWorldDeltasToChunk,
  parseWorldDeltas,
  worldDeltaField,
  worldDeltaHashKey,
  type WorldBlockDelta,
} from "./world-save.js";
import {
  activeMovementInput,
  idleMovementInput,
  recordMovementMessage,
  requestedStopPosition,
  type MovementRateWindow,
  type StoredMovementInput,
} from "./movement-input.js";
import { nearbyObjective, createObjectiveProgress, type WorldObjectiveProgress } from "./world-objectives.js";
import { advanceMobGravity, createMobNavigationState, moveMobSafely, navigateMob, walkableMobSpawn, type MobNavigationState } from "./mob-navigation.js";
import { MOB_PATROL_RADIUS, patrolDestination, type MobPatrolState } from "./mob-patrol.js";
import { STAGGER_IMMUNITY_MS, basicStaggerDuration, bodyPoint, flightPoint, hasCombatLineOfSight, projectileImpact, meleeSweepImpact } from "./combat-impact.js";

interface MutableChunk {
  chunk: GeneratedChunk;
  revision: number;
}

interface AttackChainState {
  step: 1 | 2 | 3;
  mainHandId: MainHandId;
  recoveryUntil: number;
  comboExpiresAt: number;
}

interface PendingAttack {
  requestId: string;
  mainHandId: MainHandId;
  yaw: number;
  step: 1 | 2 | 3;
  impactAt: number;
  lastSweepAt?: number;
}

interface ActiveBrambleSnare {
  x: number;
  y: number;
  z: number;
  expiresAt: number;
}

interface PendingPower {
  requestId: string;
  powerId: PowerId;
  yaw: number;
  impactAt: number;
  seismicMastery?: SeismicMasteryId;
  target?: { x: number; y: number; z: number };
}

interface PendingMobProjectile {
  hazardRadius?: number;
  hazardDurationMs?: number;
  projectileId: string;
  mobId: string;
  archetype: string;
  damage: number;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  startedAt: number;
  impactAt: number;
}

interface PendingWeaponProjectile extends PendingAttack {
  projectileId: string;
  attackerId: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  startedAt: number;
}

interface ActiveMobHazard {
  hazardId: string;
  mobId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  damage: number;
  expiresAt: number;
  nextDamageAt: number;
  lastDamageAt: Map<string, number>;
}

export class WorldRoom extends Room<{ state: WorldState }> {
  override maxClients = 20;
  override patchRate = 33;
  private readonly chunks = new Map<string, MutableChunk>();
  private readonly movementInputs = new Map<string, StoredMovementInput>();
  private readonly movementRateWindows = new Map<string, MovementRateWindow>();
  private readonly verticalVelocities = new Map<string, number>();
  private readonly attackChains = new Map<string, AttackChainState>();
  private readonly pendingAttacks = new Map<string, PendingAttack>();
  private readonly pendingMining = new Map<string, { client: Client; request: MineBlockRequest; block: number; completesAt: number; origin: { x: number; y: number; z: number } }>();
  private readonly pendingMobMelee = new Map<string, { targetId: string; yaw: number; impactAt: number; lastSweepAt?: number }>();
  private readonly crawlerRushes = new Map<string, { yaw: number; distance: number; startedAt: number; progress: number }>();
  private readonly championCharges = new Map<string, { yaw: number; startedAt: number; progress: number; hit: Set<string> }>();
  private readonly pendingPowers = new Map<string, PendingPower>();
  private readonly specialMarks = new Map<string, ActiveSpecialMark>();
  private readonly brambleSnares = new Map<string, ActiveBrambleSnare>();
  private readonly lastMobAttackAt = new Map<string, number>();
  private readonly lastDodgeAt = new Map<string, number>();
  private readonly pendingMobProjectiles = new Map<string, PendingMobProjectile>();
  private readonly delayedMatriarchVolleys = new Map<string, { origin: { x: number; y: number; z: number }; shots: { x: number; y: number; z: number }[]; releaseAt: number; damage: number; travelMs: number }>();
  private readonly pendingWeaponProjectiles = new Map<string, PendingWeaponProjectile>();
  private readonly mobCommittedAim = new Map<string, { x: number; y: number; z: number; yaw: number }>();
  private readonly mobStaggerImmuneUntil = new Map<string, number>();
  private readonly mobHazards = new Map<string, ActiveMobHazard>();
  private readonly mobHomes = new Map<string, { x: number; y: number; z: number }>();
  private readonly mobVerticalVelocities = new Map<string, number>();
  private readonly mobNavigation = new Map<string, MobNavigationState>();
  private readonly mobAwareness = new Map<string, MobAwareness>();
  private readonly mobProgress = new Map<string, MobProgress>();
  private readonly mobUnreachableUntil = new Map<string, number>();
  private readonly mobReturning = new Set<string>();
  private readonly mobAssistAt = new Map<string, number>();
  private readonly crawlerPositioning = new Map<string, CrawlerPositioning>();
  private readonly mobPatrols = new Map<string, MobPatrolState>();
  private readonly roamingRoutes = new Map<string, RoamingRouteState>();
  private readonly roamingEngaged = new Set<string>();
  private readonly roamingReturning = new Set<string>();
  private readonly spitterPositioning = new Map<string, SpitterPositioning>();
  private readonly profileTokens = new Map<string, string>();
  private readonly lastChatAt = new Map<string, number>();
  private readonly lastNameAt = new Map<string, number>();
  private readonly parties = new Parties();
  private readonly combatContributions = new CombatContributions();
  private readonly silverGuardVolley = new SilverGuardVolley();
  private readonly wildernessEvent = new WildernessEventCycle();
  private readonly forestPortalCycle = new ForestPortalCycle();
  private forestDungeonActive = false;
  private readonly forestReturns = new Map<string, { x: number; y: number; z: number }>();
  private readonly forestTravelAt = new Map<string, number>();
  private readonly lastPartyRequestAt = new Map<string, number>();
  private lastPartyUpdateAt = -Infinity;
  private readonly trading = new Trading((a, b) => hasCombatLineOfSight(a, b, this.readWorldBlock));
  private readonly lastTradeRequestAt = new Map<string, number>();
  private readonly profileSaveFingerprints = new Map<string, string>();
  private readonly profileSaveQueues = new Map<string, Promise<void>>();
  private readonly quizRounds = new Map<string, QuizRound>();
  private readonly objectiveProgress = new Map<string, WorldObjectiveProgress>();
  private readonly worldDeltasByChunk = new Map<string, Map<string, WorldBlockDelta>>();
  private readonly pendingWorldDeltaWrites = new Map<string, string>();
  private readonly mineralRegrowth = new Map<string, WorldBlockDelta & { regrowAt: number }>();
  private lastMineralRegrowthAt = 0;
  private worldDeltaStorageKey = "";
  private worldDeltaFlush: Promise<void> | null = null;
  private lastWorldDeltaRetryAt = 0;
  private lastProfileSaveSweepAt = 0;
  private mobProjectileSequence = 0;
  private weaponProjectileSequence = 0;
  private lootDropSequence = 0;
  private worldSeed = "blockcraft-dev";

  override async onCreate(): Promise<void> {
    this.worldSeed = String(process.env.WORLD_SEED || "blockcraft-dev");
    this.worldDeltaStorageKey = worldDeltaHashKey(this.worldSeed);
    try {
      const storedDeltas = parseWorldDeltas(await this.presence.hgetall(this.worldDeltaStorageKey));
      for (const delta of storedDeltas) {
        this.indexWorldDelta(delta);
        if (delta.block === Block.Air && authoredMineralAt(delta.x, delta.y, delta.z) !== null) {
          const regrowAt = delta.regrowAt ?? Date.now() + MINERAL_REGROWTH_MS;
          const field = worldDeltaField(delta.x, delta.y, delta.z);
          this.mineralRegrowth.set(field, { ...delta, regrowAt });
          if (delta.regrowAt === undefined) this.pendingWorldDeltaWrites.set(field, JSON.stringify({ block: delta.block, regrowAt }));
        }
      }
    } catch (error) {
      console.warn("Persistent terrain could not be loaded; using the generated world for this room.", error);
    }
    this.setState(new WorldState());
    if (this.pendingWorldDeltaWrites.size) void this.flushWorldDeltaWrites();
    for (const spawn of WILDERNESS_ENCOUNTERS) this.registerMob(spawn.id, spawn.archetype, spawn);
    for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) {
      this.registerMob(roamingMemberId(pack, index), pack.archetype, roamingGoal(pack, index, 0));
    }
    this.registerMob("greenwood-briar", "briar_crawler", GREENWOOD_CRAWLER_HOMES[1]);
    this.registerMob("greenwood-briar-north", "briar_crawler", GREENWOOD_CRAWLER_HOMES[2]);
    this.registerMob("stone-brute", "stone_brute", STONE_BRUTE_ARENA_HOME);
    this.registerMob("shallow-cave-crawler", "moss_crawler", CAVE_SHALLOW_HOME);
    this.registerMob("deep-cave-spitter", "cave_spitter", CAVE_DEEP_HOME);
    this.registerMob("buried-chamber-brute", "stone_brute", CAVE_HIDDEN_HOME);
    this.registerMob("wild-crawler", "moss_crawler", GREENWOOD_CRAWLER_HOMES[0]);
    this.registerMob("frontier-crawler", "moss_crawler", { x: 63.5, y: 8, z: 35.5 });
    this.onMessage("world:ready", client => {
      client.send("world:bootstrap", this.bootstrapPayload(this.state.players.get(client.sessionId)));
      client.send("mineral:status", this.mineralStatus());
    });
    this.onMessage("world:chunks", (client, payload) => this.handleChunkRegionRequest(client, payload));
    this.onMessage("chat:send", (client, payload: unknown) => this.handleNearbyChat(client, payload));
    this.onMessage("trade:request", (client, payload: unknown) => {
      const parsed = TradeRequestSchema.safeParse(payload); if (!parsed.success || !this.state.players.has(client.sessionId)) return;
      const now = Date.now(); if (now - (this.lastTradeRequestAt.get(client.sessionId) ?? -Infinity) < 200) return;
      this.lastTradeRequestAt.set(client.sessionId, now);
      if (parsed.data.action === "invite" && this.profileTokens.get(client.sessionId) && this.profileTokens.get(client.sessionId) === this.profileTokens.get(parsed.data.targetId)) { client.send("chat:notice", "Cannot trade between sessions of the same character."); return; }
      const result = this.trading.handle(client.sessionId, parsed.data, this.state.players, now, (ids, balances) => {
        for (let i = 0; i < 2; i++) {
          const player = this.state.players.get(ids[i]!)!, balance = balances[i]!;
          player.coins = balance.coins;
          for (const item of balance.items) { let state = player.inventory.get(item.itemId); if (!state) { state = new InventoryItemState(); player.inventory.set(item.itemId, state); } state.quantity = item.quantity; }
        }
        for (const id of ids) {
          void this.persistPlayer(id, this.state.players.get(id)!, true).catch(() => {
            this.clients.find(other => other.sessionId === id)?.send("chat:notice", "Trade finished, but saving is delayed. Please stay connected.");
          });
          this.clients.find(other => other.sessionId === id)?.send("chat:notice", "Trade completed. Items and gold exchanged.");
        }
      });
      client.send("chat:notice", result); this.sendPartyUpdates(now);
    });
    this.onMessage("party:request", (client, payload: unknown) => {
      const parsed = PartyRequestSchema.safeParse(payload); if (!parsed.success) return;
      const now = Date.now();
      if (!this.state.players.has(client.sessionId)) return;
      if (now - (this.lastPartyRequestAt.get(client.sessionId) ?? -Infinity) < 300) return;
      this.lastPartyRequestAt.set(client.sessionId, now);
      client.send("chat:notice", this.parties.handle(client.sessionId, parsed.data, this.state.players, Date.now()));
      this.sendPartyUpdates(Date.now());
    });
    this.onMessage("player:name", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId), name = PlayerNameSchema.safeParse(payload);
      if (!player || !name.success || Date.now() - (this.lastNameAt.get(client.sessionId) ?? -Infinity) < 2000) return;
      this.lastNameAt.set(client.sessionId, Date.now()); player.name = name.data;
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      client.send("chat:notice", `Your name is now ${player.name}.`);
    });
    this.onMessage("objective:sync", client => this.sendObjectiveState(client, true));
    this.onMessage("ping", (client, payload: unknown) => {
      if (typeof payload === "object" && payload && "id" in payload && typeof payload.id === "string") {
        client.send("pong", { id: payload.id, serverTime: Date.now() });
      }
    });
    const aliveMessage = (type: string, handler: (client: Client, payload: any) => void) => {
      this.onMessage(type, (client, payload) => {
        if ((this.state.players.get(client.sessionId)?.health ?? 0) > 0) handler(client, payload);
      });
    };
    this.onMessage("player:return", client => this.returnPlayerToTown(client));
    this.onMessage("portal:use", (client, payload: unknown) => this.useForestPortal(client, payload));
    this.onMessage("recovery:collect", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload || typeof payload !== "object" || !("bagId" in payload) || typeof payload.bagId !== "string" || payload.bagId.length > 80) return;
      const message = collectRecoveryBag(player, payload.bagId, bag => hasCombatLineOfSight(player, bag, this.readWorldBlock));
      void this.persistPlayer(client.sessionId, player);
      client.send("recovery:result", message);
    });
    aliveMessage("move", (client, payload) => this.handleMove(client, payload));
    aliveMessage("mine", (client, payload) => this.beginMine(client, payload));
    this.onMessage("mine:cancel", (client, payload: unknown) => {
      const pending = this.pendingMining.get(client.sessionId);
      if (pending && typeof payload === "object" && payload !== null && "requestId" in payload && payload.requestId === pending.request.requestId) this.pendingMining.delete(client.sessionId);
    });
    aliveMessage("attack", (client, payload) => this.handleAttack(client, payload));
    aliveMessage("dodge", (client, payload) => this.handleDodge(client, payload));
    aliveMessage("defense", (client, payload) => this.handleDefense(client, payload));
    aliveMessage("power", (client, payload) => this.handlePower(client, payload));
    aliveMessage("power:cancel", (client, payload) => this.handlePowerCancel(client, payload));
    aliveMessage("power:equip", (client, payload) => this.handlePowerEquip(client, payload));
    aliveMessage("power:seismic-mastery", (client, payload) => this.handleSeismicMasteryEquip(client, payload));
    aliveMessage("special", (client, payload) => this.handleSpecial(client, payload));
    aliveMessage("special:equip", (client, payload) => this.handleSpecialEquip(client, payload));
    aliveMessage("main-hand:equip", (client, payload) => this.handleMainHandEquip(client, payload));
    aliveMessage("armour:equip", (client, payload) => this.handleArmourEquip(client, payload));
    this.onMessage("loot:collect", (client, payload) => this.handleLootCollect(client, payload));
    aliveMessage("trait:equip", (client, payload) => this.handleTraitEquip(client, payload));
    this.onMessage("quiz:sync", client => this.sendQuizState(client));
    aliveMessage("quiz:start", (client, payload) => this.handleQuizStart(client, payload));
    aliveMessage("quiz:answer", (client, payload) => this.handleQuizAnswer(client, payload));
    aliveMessage("quiz:decision", (client, payload) => this.handleQuizDecision(client, payload));
    this.onMessage("blacksmith:sync", client => this.sendBlacksmithState(client));
    this.onMessage("storage:sync", client => this.sendStorageState(client));
    this.onMessage("storage:transfer", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const message = transferStoredItem(player, payload);
      void this.persistPlayer(client.sessionId, player);
      this.sendStorageState(client, message);
    });
    aliveMessage("blacksmith:sell", client => this.handleBlacksmithSell(client));
    aliveMessage("blacksmith:forge", (client, payload) => this.handleBlacksmithForge(client, payload));
    aliveMessage("blacksmith:buy", (client, payload) => this.handleBlacksmithBuy(client, payload));
    this.onMessage("potion:buy", client => this.handlePotion(client, true));
    this.onMessage("potion:use", client => this.handlePotion(client, false));
    this.setSimulationInterval(deltaTime => this.simulatePlayers(Math.min(deltaTime / 1000, 0.1)), 33);
  }

  override async onJoin(client: Client, options: unknown): Promise<void> {
    const player = new PlayerState();
    player.coins = TAVERN_QUIZ_STARTING_COINS;
    // Assign after construction so Colyseus includes the loadout in the initial
    // patch instead of eliding it as an unchanged schema default.
    player.equippedPower = "shockwave";
    player.seismicMastery = "advancing_fault";
    player.mainHandId = "longsword";
    player.mainHandTag = "melee";
    player.equippedSpecial = "hunters_mark";
    player.equippedTrait = "momentum";
    const profileTokenResult = PlayerProfileTokenSchema.safeParse(
      typeof options === "object" && options && "profileToken" in options ? options.profileToken : undefined,
    );
    const profileToken = profileTokenResult.success ? profileTokenResult.data : null;
    const requestedName = typeof options === "object" && options && "name" in options ? String(options.name) : "Explorer";
    player.name = requestedName.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 20) || "Explorer";
    if (profileToken) {
      try {
        const save = parsePlayerSave(await this.presence.hget(PLAYER_SAVE_HASH, profileToken));
        if (save) applyPlayerSave(player, save);
      } catch (error) {
        console.warn("Player save could not be loaded; starting with safe defaults.", error);
      }
      this.profileTokens.set(client.sessionId, profileToken);
      this.profileSaveFingerprints.set(client.sessionId, serializePlayerSave(player, 0));
    }
    const requestedQaSpawn = typeof options === "object" && options && "qaSpawn" in options ? String(options.qaSpawn) : "";
    const spawn = process.env.NODE_ENV !== "production" && requestedQaSpawn === "cave"
      ? { x: 37.5, y: 3, z: 8.5 }
      : process.env.NODE_ENV !== "production" && requestedQaSpawn === "spitter"
        ? { x: 40.5, y: 8, z: 6.5 }
        : process.env.NODE_ENV !== "production" && requestedQaSpawn === "blacksmith"
          ? { x: 22.5, y: 8, z: 4.3 }
        : process.env.NODE_ENV !== "production" && requestedQaSpawn === "tavern"
          ? { x: 8.5, y: 8, z: 20.5 }
        : process.env.NODE_ENV !== "production" && requestedQaSpawn === "greenwood"
          ? { x: 39.5, y: 8, z: 13.5 }
        : process.env.NODE_ENV !== "production" && requestedQaSpawn === "stream"
          ? { x: -75.5, y: 8, z: -7.5 }
        : this.spawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    if (process.env.NODE_ENV !== "production" && (requestedQaSpawn === "combat" || requestedQaSpawn === "spitter" || requestedQaSpawn === "greenwood" || requestedQaSpawn === "stream")) {
      player.invulnerableUntil = Date.now() + 60 * 60 * 1000;
    }
    if (process.env.NODE_ENV !== "production" && requestedQaSpawn === "blacksmith") {
      player.coins = 100;
      const testOre = new InventoryItemState();
      testOre.quantity = 8;
      player.inventory.set("iron_ore", testOre);
    }
    if (ownsBlacksmithUpgrade(player.blacksmithUpgrades, "reinforced_pickaxe") && !player.inventory.get("reinforced_pickaxe")) {
      const forgedPickaxe = new InventoryItemState();
      forgedPickaxe.quantity = 1;
      player.inventory.set("reinforced_pickaxe", forgedPickaxe);
    }
    this.state.players.set(client.sessionId, player);
    this.objectiveProgress.set(client.sessionId, createObjectiveProgress());
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: Date.now() });
    this.verticalVelocities.set(client.sessionId, 0);
    if (profileToken) {
      try {
        await this.persistPlayer(client.sessionId, player, true);
      } catch {
        // The queued writer already logged the failure and will retry while connected.
      }
    }
  }

  override async onLeave(client: Client): Promise<void> {
    this.combatContributions.disconnect(client.sessionId);
    for (const [id, drop] of this.state.lootDrops) if (drop.ownerId === client.sessionId) this.state.lootDrops.delete(id);
    this.trading.disconnect(client.sessionId); this.lastTradeRequestAt.delete(client.sessionId);
    this.parties.disconnect(client.sessionId);
    this.lastPartyRequestAt.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId); this.lastNameAt.delete(client.sessionId);
    this.pendingMining.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    const quizRound = this.quizRounds.get(client.sessionId);
    // A confirmed answer has already earned a pot. Treat disconnecting at the
    // decision screen as quitting, while an unanswered question forfeits it.
    if (player && quizRound?.phase === "decision") player.coins = Math.min(1_000_000, player.coins + quizRound.payout);
    try {
      if (player) await this.persistPlayer(client.sessionId, player, true);
    } catch {
      // Always finish room cleanup even if external save storage is unavailable.
    }
    this.state.players.delete(client.sessionId);
    this.forestReturns.delete(client.sessionId);
    this.forestTravelAt.delete(client.sessionId);
    this.movementInputs.delete(client.sessionId);
    this.movementRateWindows.delete(client.sessionId);
    this.verticalVelocities.delete(client.sessionId);
    this.attackChains.delete(client.sessionId);
    this.pendingAttacks.delete(client.sessionId);
    this.cancelWeaponProjectiles(client.sessionId);
    this.pendingPowers.delete(client.sessionId);
    this.specialMarks.delete(client.sessionId);
    this.brambleSnares.delete(client.sessionId);
    this.lastDodgeAt.delete(client.sessionId);
    this.profileTokens.delete(client.sessionId);
    this.profileSaveFingerprints.delete(client.sessionId);
    this.quizRounds.delete(client.sessionId);
    this.objectiveProgress.delete(client.sessionId);
  }

  override async onDispose(): Promise<void> {
    await Promise.allSettled([...this.profileSaveQueues.values(), this.flushWorldDeltaWrites()]);
  }

  private handleNearbyChat(client: Client, payload: unknown): void {
    const parsed = ChatSendSchema.safeParse(payload), player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    const now = Date.now();
    if (now - (this.lastChatAt.get(client.sessionId) ?? -Infinity) < 1200) { client.send("chat:notice", "Please wait a moment before sending again."); return; }
    const text = cleanChatText(parsed.data.text); if (!text) return;
    this.lastChatAt.set(client.sessionId, now);
    const message: NearbyChatMessage = { senderId: client.sessionId, name: player.name, text };
    for (const recipient of this.clients) {
      const other = this.state.players.get(recipient.sessionId);
      if (other && hearsNearbyChat(player, other)) recipient.send("chat:message", message);
    }
  }

  private sendPartyUpdates(now: number): void {
    this.lastPartyUpdateAt = now;
    this.trading.refresh(this.state.players, now);
    for (const client of this.clients) if (this.state.players.has(client.sessionId)) {
      client.send("party:update", this.parties.snapshot(client.sessionId, this.state.players, now));
      client.send("trade:update", this.trading.snapshot(client.sessionId, this.state.players));
    }
  }

  private sendQuizState(client: Client, message?: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const round = this.quizRounds.get(client.sessionId);
    if (!round) {
      client.send("quiz:update", { phase: "idle", coins: player.coins, message } satisfies TavernQuizUpdate);
      return;
    }
    client.send("quiz:update", {
      phase: round.phase,
      coins: player.coins,
      stake: round.stake,
      payout: round.payout,
      ...(round.phase === "question" ? { question: {
        id: round.question.id,
        prompt: round.question.prompt,
        choices: round.question.choices,
      } } : {}),
      message,
    } satisfies TavernQuizUpdate);
  }

  private quizError(client: Client, message: string): void {
    if (this.quizRounds.has(client.sessionId)) return this.sendQuizState(client, message);
    const player = this.state.players.get(client.sessionId);
    client.send("quiz:update", { phase: "error", coins: player?.coins ?? 0, message } satisfies TavernQuizUpdate);
  }

  private handleQuizStart(client: Client, payload: unknown): void {
    const parsed = TavernQuizStartSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return this.quizError(client, "Choose a stake of 1, 5, or 10 coins.");
    if (this.quizRounds.has(client.sessionId)) return this.sendQuizState(client);
    if (!canStartTavernQuiz(player, player.coins, parsed.data.stake)) {
      return this.quizError(client, "Stand by the blue-and-gold quiz table with enough coins to place that stake.");
    }
    const question = drawQuizQuestion([]);
    if (!question) return this.quizError(client, "Mara has run out of questions for now.");
    player.coins -= parsed.data.stake;
    this.quizRounds.set(client.sessionId, {
      stake: parsed.data.stake,
      payout: parsed.data.stake,
      askedIds: [question.id],
      question,
      phase: "question",
    });
    void this.persistPlayer(client.sessionId, player);
    this.sendQuizState(client, "Your stake is on the table. Choose an answer.");
  }

  private settleQuiz(client: Client, player: PlayerState, round: QuizRound, message: string): void {
    player.coins = Math.min(1_000_000, player.coins + round.payout);
    this.quizRounds.delete(client.sessionId);
    void this.persistPlayer(client.sessionId, player);
    client.send("quiz:update", {
      phase: "won", coins: player.coins, stake: round.stake, payout: round.payout, message,
    } satisfies TavernQuizUpdate);
  }

  private handleQuizAnswer(client: Client, payload: unknown): void {
    const parsed = TavernQuizAnswerSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    const round = this.quizRounds.get(client.sessionId);
    if (!parsed.success || !player || !round) return this.quizError(client, "Start a round with Mara first.");
    if (round.phase !== "question" || parsed.data.questionId !== round.question.id) return this.sendQuizState(client);
    if (parsed.data.choice !== round.question.correctChoice) {
      this.quizRounds.delete(client.sessionId);
      client.send("quiz:update", {
        phase: "lost", coins: player.coins, stake: round.stake, payout: 0,
        message: `Not quite. The answer was ${round.question.choices[round.question.correctChoice]}. The pot is lost.`,
      } satisfies TavernQuizUpdate);
      return;
    }
    round.payout = doubledPayout(round.payout);
    round.phase = "decision";
    if (mustSettleQuiz(round)) {
      this.settleQuiz(client, player, round, `Correct! You reached the ${TAVERN_QUIZ_MAX_PAYOUT}-coin table limit and collected the pot.`);
    } else {
      this.sendQuizState(client, "Correct! Take the pot, or double it on another question.");
    }
  }

  private handleQuizDecision(client: Client, payload: unknown): void {
    const parsed = TavernQuizDecisionSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    const round = this.quizRounds.get(client.sessionId);
    if (!parsed.success || !player || !round) return this.quizError(client, "Start a round with Mara first.");
    if (round.phase !== "decision") return this.sendQuizState(client);
    if (parsed.data.decision === "quit") return this.settleQuiz(client, player, round, "You took the pot. Well played!");
    const question = drawQuizQuestion(round.askedIds);
    if (!question) return this.settleQuiz(client, player, round, "No questions left. You collected the pot!");
    round.question = question;
    round.askedIds.push(question.id);
    round.phase = "question";
    this.sendQuizState(client, "Double or nothing. Here's your next question.");
  }

  private sendStorageState(client: Client, message?: string): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const items = (map: PlayerState["inventory"]) => Object.fromEntries([...map.entries()].filter(([, item]) => item.quantity > 0).map(([id, item]) => [id, item.quantity]));
    client.send("storage:update", { carried: items(player.inventory), stored: items(player.storage),
      message: message ?? (canUseStorage(player) ? "Your personal chest. Choose an item to deposit or withdraw." : "Stand beside the chest to transfer items.") });
  }

  private sendBlacksmithState(client: Client, message: string | undefined = undefined, phase: BlacksmithUpdate["phase"] = "idle", sold = 0, goldGranted = 0, purchasedUpgradeId?: BlacksmithUpgradeId): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.send("blacksmith:update", {
      phase,
      ironOre: player.inventory.get("iron_ore")?.quantity ?? 0,
      silverOre: player.inventory.get("silver_ore")?.quantity ?? 0,
      ironCapacity: ironCapacity(player.blacksmithUpgrades),
      gold: player.coins,
      ownedUpgrades: ownedBlacksmithUpgrades(player.blacksmithUpgrades),
      weapons: Object.fromEntries(Object.keys(BLACKSMITH_STOCK).map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      sold,
      goldGranted,
      purchasedUpgradeId,
      message: message ?? blacksmithNextStep(player.blacksmithUpgrades, player.coins, player.inventory.get("iron_ore")?.quantity ?? 0),
    } satisfies BlacksmithUpdate);
  }

  private handleArmourEquip(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = ArmourEquipSchema.safeParse(payload);
    if (!player || player.health <= 0 || !parsed.success) return;
    const id = parsed.data.armourId;
    if (id !== "none" && (player.inventory.get(id)?.quantity ?? 0) <= 0) {
      client.send("chat:notice", { message: "You need that armour in your pack before equipping it." }); return;
    }
    player.armourId = id;
    void this.persistPlayer(client.sessionId, player);
  }

  private handleBlacksmithBuy(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = BlacksmithBuySchema.safeParse(payload);
    if (!player) return;
    if (!parsed.success) return this.sendBlacksmithState(client, "Choose equipment from the shop.", "error");
    if (player.health <= 0 || !canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to buy equipment.", "error");
    const id = parsed.data.itemId;
    const result = weaponPurchase(player.coins, player.inventory.get(id)?.quantity ?? 0, id);
    if (!result.ok) return this.sendBlacksmithState(client, result.message, "error");
    let item = player.inventory.get(id);
    if (!item) { item = new InventoryItemState(); player.inventory.set(id, item); }
    player.coins = result.gold;
    item.quantity = result.quantity;
    void this.persistPlayer(client.sessionId, player);
    this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[id].name} added to your pack. Press I to equip it.`, "purchased");
  }

  private handleBlacksmithSell(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to trade.", "error");
    const ore = player.inventory.get("iron_ore");
    const silver = player.inventory.get("silver_ore");
    if (!ore?.quantity && !silver?.quantity) return this.sendBlacksmithState(client, "No minerals to sell. Look for exposed iron beyond the east gate; silver lies farther into the wilderness.", "error");
    const { ironSold, silverSold, goldGranted } = mineralSale(ore?.quantity ?? 0, silver?.quantity ?? 0, player.coins);
    const sold = ironSold + silverSold;
    if (sold === 0) return this.sendBlacksmithState(client, "Your gold purse is full.", "error");
    if (ore) ore.quantity -= ironSold;
    if (silver) silver.quantity -= silverSold;
    player.coins += goldGranted;
    void this.persistPlayer(client.sessionId, player);
    const minerals = [ironSold ? `${ironSold} iron ore` : "", silverSold ? `${silverSold} silver ore` : ""].filter(Boolean).join(" + ");
    this.sendBlacksmithState(client, `Sold ${minerals} for ${goldGranted} gold.`, "traded", sold, goldGranted);
  }

  private handleBlacksmithForge(client: Client, payload: unknown): void {
    const parsed = BlacksmithForgeSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to forge equipment.", "error");
    const upgradeId = parsed.data.upgradeId as BlacksmithUpgradeId;
    const ore = player.inventory.get("iron_ore");
    const forge = forgeBlacksmithUpgrade(player.blacksmithUpgrades, player.coins, ore?.quantity ?? 0, upgradeId);
    if (!forge.forged) {
      const message = forge.reason === "owned"
        ? `${BLACKSMITH_UPGRADES[upgradeId].name} is already yours.`
        : forge.reason === "iron_ore"
          ? `You need ${BLACKSMITH_UPGRADES[upgradeId].ironOre} iron ore for ${BLACKSMITH_UPGRADES[upgradeId].name}.`
        : `You need ${BLACKSMITH_UPGRADES[upgradeId].price} gold for ${BLACKSMITH_UPGRADES[upgradeId].name}.`;
      return this.sendBlacksmithState(client, message, "error");
    }
    player.blacksmithUpgrades = forge.flags;
    player.coins = forge.gold;
    if (upgradeId === "iron_sword") {
      player.mainHandId = "longsword";
      player.mainHandTag = "melee";
    }
    if (ore) ore.quantity = forge.ironOre;
    if (upgradeId === "reinforced_pickaxe") {
      let pickaxe = player.inventory.get("reinforced_pickaxe");
      if (!pickaxe) {
        pickaxe = new InventoryItemState();
        player.inventory.set("reinforced_pickaxe", pickaxe);
      }
      pickaxe.quantity = 1;
    }
    void this.persistPlayer(client.sessionId, player);
    this.sendBlacksmithState(client, `${BLACKSMITH_UPGRADES[upgradeId].name} ${upgradeId === "reinforced_pickaxe" ? "bought" : "forged"} and equipped. ${BLACKSMITH_UPGRADES[upgradeId].description}.`, "purchased", 0, 0, upgradeId);
  }

  private handlePotion(client: Client, buying: boolean): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    let item = player.inventory.get("healing_potion");
    const quantity = item?.quantity ?? 0;
    const error = buying ? potionBuyError(player.health, player.coins, quantity, canBuyPotionAtKeeper(player))
      : potionUseError(player.health, player.maxHealth, quantity, player.potionCooldownUntil, now);
    let healed = 0;
    if (!error) {
      if (!item) { item = new InventoryItemState(); player.inventory.set("healing_potion", item); }
      if (buying) { player.coins -= HEALING_POTION.price; item.quantity++; }
      else {
        healed = Math.min(HEALING_POTION.heal, player.maxHealth - player.health);
        player.health += healed;
        item.quantity--;
        player.potionCooldownUntil = now + HEALING_POTION.cooldownMs;
      }
      void this.persistPlayer(client.sessionId, player);
    }
    const update: PotionUpdate = { phase: error ? "error" : buying ? "bought" : "healed",
      message: error ?? (buying ? "Healing potion bought for 5 gold. Press H to drink when hurt." : `Restored ${healed} HP.`),
      quantity: item?.quantity ?? 0, gold: player.coins, health: player.health, maxHealth: player.maxHealth,
      cooldownUntil: player.potionCooldownUntil, healed };
    client.send("potion:update", update);
  }

  private persistPlayer(sessionId: string, player: PlayerState, force = false): Promise<void> {
    const profileToken = this.profileTokens.get(sessionId);
    if (!profileToken) return Promise.resolve();
    const fingerprint = serializePlayerSave(player, 0);
    if (!force && fingerprint === this.profileSaveFingerprints.get(sessionId)) {
      return this.profileSaveQueues.get(profileToken) ?? Promise.resolve();
    }
    this.profileSaveFingerprints.set(sessionId, fingerprint);
    const serialized = serializePlayerSave(player);
    const previous = this.profileSaveQueues.get(profileToken) ?? Promise.resolve();
    const queued = previous.catch(() => undefined).then(async () => {
      await this.presence.hset(PLAYER_SAVE_HASH, profileToken, serialized);
    });
    this.profileSaveQueues.set(profileToken, queued);
    void queued.then(() => {
      if (this.profileSaveQueues.get(profileToken) === queued) this.profileSaveQueues.delete(profileToken);
    }).catch(error => {
      if (this.profileSaveQueues.get(profileToken) === queued) this.profileSaveQueues.delete(profileToken);
      this.profileSaveFingerprints.delete(sessionId);
      console.error("Player save could not be written; it will be retried.", error);
    });
    return queued;
  }

  private flushDirtyPlayerSaves(now: number): void {
    if (now - this.lastProfileSaveSweepAt < 1_000) return;
    this.lastProfileSaveSweepAt = now;
    for (const [sessionId, player] of this.state.players) void this.persistPlayer(sessionId, player);
  }

  private chunkKey(chunkX: number, chunkZ: number): string {
    return `${chunkX},${chunkZ}`;
  }

  private indexWorldDelta(delta: WorldBlockDelta): void {
    const address = worldToChunk(delta.x, delta.z);
    const chunkKey = this.chunkKey(address.chunkX, address.chunkZ);
    let deltas = this.worldDeltasByChunk.get(chunkKey);
    if (!deltas) {
      deltas = new Map();
      this.worldDeltasByChunk.set(chunkKey, deltas);
    }
    deltas.set(worldDeltaField(delta.x, delta.y, delta.z), delta);
  }

  private recordWorldDelta(x: number, y: number, z: number, block: BlockId): void {
    const field = worldDeltaField(x, y, z);
    const regrowAt = block === Block.Air && authoredMineralAt(x, y, z) !== null ? this.mineralRegrowth.get(field)?.regrowAt ?? Date.now() + MINERAL_REGROWTH_MS : undefined;
    const delta: WorldBlockDelta = { x, y, z, block, ...(regrowAt === undefined ? {} : { regrowAt }) };
    if (regrowAt !== undefined) this.mineralRegrowth.set(field, { ...delta, regrowAt });
    else this.mineralRegrowth.delete(field);
    this.indexWorldDelta(delta);
    this.pendingWorldDeltaWrites.set(field, regrowAt === undefined ? String(block) : JSON.stringify({ block, regrowAt }));
    this.lastWorldDeltaRetryAt = Date.now();
    void this.flushWorldDeltaWrites();
  }

  private mineralStatus(): MineralDepositStatus[] {
    return RENEWABLE_MINERAL_DEPOSITS.map(deposit => {
      let available = 0;
      let readyAt: number | null = null;
      for (let x = deposit.x - deposit.radius; x <= deposit.x + deposit.radius; x++) {
        for (let z = deposit.z - deposit.radius; z <= deposit.z + deposit.radius; z++) {
          for (const y of [SURFACE_HEIGHT - 1, SURFACE_HEIGHT]) {
            if (this.readWorldBlock(x, y, z) === deposit.block) available++;
            const pending = this.mineralRegrowth.get(worldDeltaField(x, y, z));
            if (pending) readyAt = Math.min(readyAt ?? Infinity, pending.regrowAt);
          }
        }
      }
      return { id: `${deposit.x},${deposit.z}`, available, total: (deposit.radius * 2 + 1) ** 2 * 2, readyAt };
    });
  }

  private regrowMinerals(now: number): void {
    if (now - this.lastMineralRegrowthAt < 1000) return;
    this.lastMineralRegrowthAt = now;
    const occupants = [...this.state.players.values(), ...[...this.state.mobs.values()].filter(mob => mob.alive)];
    let restored = 0;
    for (const [field, cell] of this.mineralRegrowth) {
      if (cell.regrowAt > now) continue;
      const block = authoredMineralAt(cell.x, cell.y, cell.z);
      if (block === null || this.readWorldBlock(cell.x, cell.y, cell.z) !== Block.Air) {
        this.mineralRegrowth.delete(field);
        continue;
      }
      if (mineralCellOccupied(cell, occupants)) continue;
      const address = worldToChunk(cell.x, cell.z);
      const stored = this.getChunk(address.chunkX, address.chunkZ);
      setBlock(stored.chunk, address.localX, cell.y, address.localZ, block);
      stored.revision++;
      this.recordWorldDelta(cell.x, cell.y, cell.z, block);
      this.broadcast("block:changed", { requestId: `regrow:${field}`, x: cell.x, y: cell.y, z: cell.z, block, revision: stored.revision } satisfies BlockChanged);
      if (++restored >= 4) break;
    }
    if (restored || this.mineralRegrowth.size) this.broadcast("mineral:status", this.mineralStatus());
  }

  private flushWorldDeltaWrites(): Promise<void> {
    if (this.worldDeltaFlush) return this.worldDeltaFlush;
    const flush = (async () => {
      while (this.pendingWorldDeltaWrites.size > 0) {
        const batch = [...this.pendingWorldDeltaWrites.entries()];
        for (const [field, block] of batch) {
          await this.presence.hset(this.worldDeltaStorageKey, field, String(block));
          if (this.pendingWorldDeltaWrites.get(field) === block) this.pendingWorldDeltaWrites.delete(field);
        }
      }
    })();
    this.worldDeltaFlush = flush;
    void flush.catch(error => {
      console.error("Persistent terrain could not be written; it will be retried.", error);
    }).finally(() => {
      if (this.worldDeltaFlush === flush) this.worldDeltaFlush = null;
    });
    return flush;
  }

  private getChunk(chunkX: number, chunkZ: number): MutableChunk {
    const key = this.chunkKey(chunkX, chunkZ);
    let stored = this.chunks.get(key);
    if (!stored) {
      const chunk = generateChunk(this.worldSeed, chunkX, chunkZ);
      const revision = applyWorldDeltasToChunk(chunk, this.worldDeltasByChunk.get(key)?.values() ?? []);
      stored = { chunk, revision };
      this.chunks.set(key, stored);
    }
    return stored;
  }

  private snapshot(chunkX: number, chunkZ: number): ChunkSnapshot {
    const stored = this.getChunk(chunkX, chunkZ);
    return { chunkX, chunkZ, revision: stored.revision, blocks: [...stored.chunk.blocks] };
  }

  private bootstrapPayload(position = this.spawnPoint()): WorldBootstrap {
    const chunks: ChunkSnapshot[] = [];
    const center = worldToChunk(position.x, position.z);
    for (let chunkZ = -WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkZ <= WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkZ += 1) {
      for (let chunkX = -WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkX <= WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkX += 1) {
        chunks.push(this.snapshot(center.chunkX + chunkX, center.chunkZ + chunkZ));
      }
    }
    return {
      seed: this.worldSeed,
      chunkSize: CHUNK_SIZE,
      chunkHeight: CHUNK_HEIGHT,
      spawn: { x: position.x, y: position.y, z: position.z },
      chunks,
    };
  }

  private handleChunkRegionRequest(client: Client, payload: unknown): void {
    const parsed = ChunkRegionRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    const playerChunk = worldToChunk(player.x, player.z);
    if (Math.abs(parsed.data.chunkX - playerChunk.chunkX) > 1
      || Math.abs(parsed.data.chunkZ - playerChunk.chunkZ) > 1) return;
    const chunks: ChunkSnapshot[] = [];
    for (let chunkZ = parsed.data.chunkZ - WORLD_STREAM_CHUNK_RADIUS; chunkZ <= parsed.data.chunkZ + WORLD_STREAM_CHUNK_RADIUS; chunkZ += 1) {
      for (let chunkX = parsed.data.chunkX - WORLD_STREAM_CHUNK_RADIUS; chunkX <= parsed.data.chunkX + WORLD_STREAM_CHUNK_RADIUS; chunkX += 1) {
        const chunk = this.getChunk(chunkX, chunkZ);
        if (!parsed.data.knownChunks.some(known => known.chunkX === chunkX && known.chunkZ === chunkZ && known.revision === chunk.revision)) chunks.push(this.snapshot(chunkX, chunkZ));
      }
    }
    client.send("world:chunks", { chunks } satisfies ChunkRegion);
  }

  private spawnPoint(): { x: number; y: number; z: number } {
    const chunk = this.getChunk(0, 0).chunk;
    return { x: 8.5, y: highestSolidY(chunk, 8, 8) + 1, z: 8.5 };
  }

  private reject(client: Client, rejection: ActionRejected): void {
    client.send("action:rejected", rejection);
  }

  private specialDamageBonus(sessionId: string, mobId: string, now: number): number {
    const mark = this.specialMarks.get(sessionId);
    const bonus = huntersMarkDamageBonus(mark, mobId, now);
    if (mark && now >= mark.expiresAt) this.specialMarks.delete(sessionId);
    return bonus;
  }

  private progressSpecialMark(sessionId: string, mobId: string, now: number): void {
    const current = this.specialMarks.get(sessionId);
    const progressed = progressHuntersMark(current, mobId, now);
    if (!progressed) {
      if (current && now >= current.expiresAt) this.specialMarks.delete(sessionId);
      return;
    }
    if (progressed.stacks === current?.stacks) return;
    this.specialMarks.set(sessionId, progressed);
    this.broadcast("special:progressed", {
      casterId: sessionId,
      mobId,
      expiresAt: progressed.expiresAt,
      stacks: progressed.stacks,
      maxStacks: HUNTERS_MARK.maxStacks,
      exposed: progressed.stacks >= HUNTERS_MARK.maxStacks,
    } satisfies SpecialProgressed);
  }

  private clearMarksForMob(mobId: string): void {
    for (const [sessionId, mark] of this.specialMarks) {
      if (mark.mobId === mobId) this.specialMarks.delete(sessionId);
    }
  }

  private registerMob(mobId: string, archetypeId: MobArchetypeId, spawn: { x: number; y: number; z: number }): void {
    const outside = keepMobOutsideTown(spawn);
    const home = walkableMobSpawn({ ...spawn, ...outside }, this.readWorldBlock, pose => this.mobPositionAllowed(pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose));
    this.mobHomes.set(mobId, home);
    this.mobNavigation.set(mobId, createMobNavigationState());
    const mob = this.createMob(archetypeId, home);
    if (mobId === FRONTIER_CHAMPION_ID || mobId === SILVER_CHAMPION_ID) {
      mob.isChampion = true;
      mob.attackPattern = championPattern(mob);
      const stats = scaledMobStats(combatMobDefinition(mob), dangerBandAt(home));
      mob.maxHealth = mob.health = stats.maxHealth; mob.rewardMultiplier *= 1.5;
    }
    mob.name = CAVE_ENCOUNTERS[mobId]?.name ?? (roamingMembership(mobId) ? `Roaming ${mob.name}` : mob.name);
    if (mob.isChampion) mob.name = combatMobDefinition(mob).name;
    if (mobId === "frontier-brute") mob.name = "Frontier Stone Brute";
    this.state.mobs.set(mobId, mob);
  }

  private readonly mobPositionAllowed = (position: { x: number; z: number }): boolean =>
    radiusFromSafeCenter(position) >= MOB_TOWN_MINIMUM_RADIUS - 0.001;

  private roamingAllowed(id: string, pose: { x: number; y: number; z: number }): boolean {
    const forest = FOREST_DUNGEON_MOBS.find(mob => mob.id === id);
    if (forest) return pose.y >= 7 && pose.y <= 9 && pose.z > 156 && pose.z < 174
      && pose.x > 156 + (forest.stage - 1) * 12 && pose.x < 156 + forest.stage * 12;
    const membership = roamingMembership(id);
    // A hit can pull a pack beyond its passive patrol corridor, but never into town.
    if (membership && Date.now() < (this.mobAwareness.get(id)?.provokedUntil ?? 0)) {
      return !isInsideTownSafeZone(pose) && pose.y >= 6.8 && pose.y <= 9.2
        && membership.pack.route.some(point => Math.hypot(point.x - pose.x, point.z - pose.z) <= 12);
    }
    return !membership || roamingPackAllows(membership.pack, pose);
  }
  private championAllowed(id: string, pose: { x: number; z: number }): boolean {
    const home = this.mobHomes.get(id);
    return (id !== FRONTIER_CHAMPION_ID && id !== SILVER_CHAMPION_ID && id !== WILDERNESS_EVENT_ID) || !home || Math.hypot(pose.x - home.x, pose.z - home.z) <= 12;
  }

  private patrolRoamingMember(id: string, mob: MobState, now: number, dt: number, speed: number): void {
    const membership = roamingMembership(id)!;
    const route = this.roamingRoutes.get(membership.pack.id)!;
    const authored = roamingGoal(membership.pack, membership.index, route.index);
    const allowed = (pose: { x: number; y: number; z: number }) => this.mobPositionAllowed(pose) && this.roamingAllowed(id, pose);
    const goal = walkableMobSpawn(authored, this.readWorldBlock, allowed);
    if (Math.hypot(goal.x - mob.x, goal.z - mob.z) < .65) { this.roamingReturning.delete(id); return; }
    if (now < route.pauseUntil && !this.roamingReturning.has(id)) return;
    this.moveNavigatingMob(id, mob, pursueTarget(mob, goal, dt, speed, .3), goal, now, allowed);
  }

  private moveNavigatingMob(mobId: string, mob: MobState, desired: { x: number; z: number },
    goal: { x: number; y: number; z: number }, now: number, allowed: (pose: { x: number; y: number; z: number }) => boolean = this.mobPositionAllowed,
    monitor = true): boolean {
    const navigation = this.mobNavigation.get(mobId) ?? createMobNavigationState();
    this.mobNavigation.set(mobId, navigation);
    const peers = [...this.state.mobs.entries()]
      .filter(([id, peer]) => id !== mobId && peer.alive && Math.abs(peer.y - mob.y) < 1
        && Math.hypot(peer.x - mob.x, peer.z - mob.z) < 2)
      .map(([id, peer]) => ({ id, x: peer.x, y: peer.y, z: peer.z }));
    const spaced = spacedMobDesired(mobId, mob, desired, peers);
    const next = navigateMob(mob, spaced, goal, navigation, now, this.readWorldBlock,
      pose => allowed(pose) && peers.every(peer => Math.hypot(pose.x - peer.x, pose.z - peer.z)
        >= Math.min(.75, Math.hypot(mob.x - peer.x, mob.z - peer.z)) - .001)
        && this.championAllowed(mobId, pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && (mobId === "stone-brute" || !isInStoneBruteArena(pose.x, pose.z)));
    const dx = next.x - mob.x;
    const dz = next.z - mob.z;
    const progress = checkMobProgress(this.mobProgress.get(mobId), mob, next, now,
      monitor && Math.hypot(desired.x - mob.x, desired.z - mob.z) > .001 && isPlayerSupported(this.readWorldBlock, mob.x, mob.y, mob.z));
    if (progress.state) this.mobProgress.set(mobId, progress.state); else this.mobProgress.delete(mobId);
    if (progress.action !== "none") {
      navigation.waypoints = []; navigation.nextPlanAt = now; navigation.heading = undefined;
    }
    if (Math.hypot(dx, dz) > 0.0001) mob.yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    mob.x = next.x;
    mob.y = next.y;
    mob.z = next.z;
    return progress.action === "abandon";
  }

  private patrolMob(mobId: string, mob: MobState, home: { x: number; y: number; z: number },
    now: number, dt: number, speed: number): void {
    let patrol = this.mobPatrols.get(mobId);
    if (!patrol) {
      patrol = { goal: null, pauseUntil: now + 800, expiresAt: 0, sequence: 0 };
      this.mobPatrols.set(mobId, patrol);
      this.mobNavigation.set(mobId, createMobNavigationState());
    }
    if (Math.hypot(mob.x - home.x, mob.z - home.z) > MOB_PATROL_RADIUS + 0.5) {
      patrol.goal = null;
      const returning = pursueTarget(mob, home, dt, speed, 0.15);
      this.moveNavigatingMob(mobId, mob, returning, home, now);
      patrol.pauseUntil = now + 800;
      return;
    }
    const allowed = (pose: { x: number; y: number; z: number }) => this.mobPositionAllowed(pose) && caveEncounterAllows(mobId, pose)
      && Math.hypot(pose.x - home.x, pose.z - home.z) <= MOB_PATROL_RADIUS + 0.5;
    if (patrol.goal && (Math.hypot(mob.x - patrol.goal.x, mob.z - patrol.goal.z) < 0.2
      || now >= patrol.expiresAt)) {
      patrol.goal = null;
      patrol.pauseUntil = now + 1200 + (patrol.sequence % 3) * 400;
      this.mobNavigation.set(mobId, createMobNavigationState());
    }
    if (now < patrol.pauseUntil) return;
    if (!patrol.goal) {
      patrol.goal = patrolDestination(mobId, home, patrol.sequence++, this.readWorldBlock, allowed);
      patrol.expiresAt = now + 12_000;
      if (!patrol.goal) { patrol.pauseUntil = now + 2000; return; }
    }
    const walking = pursueTarget(mob, patrol.goal, dt, speed, 0.1);
    if (this.moveNavigatingMob(mobId, mob, walking, patrol.goal, now, allowed)) {
      patrol.goal = null; patrol.pauseUntil = now + 800;
    }
  }

  private displaceMob(mobId: string, mob: MobState, delta: { x: number; z: number }): void {
    const next = moveMobSafely(mob, delta, this.readWorldBlock,
      pose => this.mobPositionAllowed(pose) && this.championAllowed(mobId, pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && (mobId === "stone-brute" || !isInStoneBruteArena(pose.x, pose.z)));
    mob.x = next.x;
    mob.y = next.y;
    mob.z = next.z;
    this.mobNavigation.set(mobId, createMobNavigationState());
  }

  private createMob(archetypeId: MobArchetypeId, spawn = MOB_ARCHETYPES[archetypeId].spawn): MobState {
    const definition = MOB_ARCHETYPES[archetypeId];
    const band = dangerBandAt(spawn);
    const stats = scaledMobStats(definition, band);
    const mob = new MobState();
    mob.archetype = definition.id;
    mob.name = definition.name;
    mob.x = spawn.x;
    mob.y = spawn.y;
    mob.z = spawn.z;
    mob.health = stats.maxHealth;
    mob.maxHealth = stats.maxHealth;
    mob.armor = stats.armor;
    mob.difficultyTier = band.tier;
    mob.attackDamage = stats.damage;
    mob.speedMultiplier = stats.speedMultiplier;
    mob.rewardMultiplier = stats.rewardMultiplier;
    return mob;
  }

  private staggerMob(mobId: string, mob: MobState, now: number, duration: number, force = false): boolean {
    if (!mob.alive || mob.health <= 0 || duration <= 0 || (!force && now < (this.mobStaggerImmuneUntil.get(mobId) ?? 0))) return false;
    this.delayedMatriarchVolleys.delete(mobId);
    mob.combatState = "stagger";
    mob.stateUntil = now + duration;
    mob.targetId = "";
    mob.aimCommitted = false;
    this.clearMobAttackTimeline(mob);
    mob.staggerSequence += 1;
    this.mobCommittedAim.delete(mobId);
    this.mobStaggerImmuneUntil.set(mobId, mob.stateUntil + STAGGER_IMMUNITY_MS);
    this.pendingMobMelee.delete(mobId);
    this.crawlerRushes.delete(mobId);
    this.championCharges.delete(mobId);
    return true;
  }

  private resolveProjectileVisual(projectileId: string, point: { x: number; y: number; z: number }, reason: ProjectileResolved["reason"]): void {
    this.broadcast("combat:projectile-resolved", { projectileId, ...point, reason } satisfies ProjectileResolved);
  }

  private cancelWeaponProjectiles(attackerId: string): void {
    for (const [id, projectile] of this.pendingWeaponProjectiles) {
      if (projectile.attackerId !== attackerId) continue;
      this.pendingWeaponProjectiles.delete(id);
      this.resolveProjectileVisual(id, projectile.position, "miss");
    }
  }

  private defeatMob(mobId: string, mob: MobState, attackerId: string, now: number): void {
    if (!mob.alive) return;
    const recipients = this.combatContributions.eligible(mobId, mob, this.state.players, now);
    this.combatContributions.clear(mobId);
    const definition = combatMobDefinition(mob);
    for (const playerId of recipients) this.spawnLootDrops(mobId, mob, now, playerId);
    mob.alive = false;
    this.delayedMatriarchVolleys.delete(mobId);
    this.mobProgress.delete(mobId); this.mobUnreachableUntil.delete(mobId); this.mobReturning.delete(mobId);
    mob.awarenessState = "patrol"; mob.alertUntil = 0;
    this.mobAwareness.delete(mobId);
    this.crawlerPositioning.delete(mobId);
    this.crawlerRushes.delete(mobId);
    this.championCharges.delete(mobId);
    this.clearMobAttackTimeline(mob);
    this.pendingMobMelee.delete(mobId);
    mob.respawnAt = now + definition.respawnMs;
    if (this.wildernessEvent.record(mobId, now, this.state.mobs.get(WILDERNESS_EVENT_ID)?.alive === true)) {
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        if (player && Math.abs(player.y - 8) <= 2.5 && Math.hypot(player.x - WILDERNESS_EVENT_POSITION.x, player.z - WILDERNESS_EVENT_POSITION.z) <= 32)
          client.send("chat:notice", "Wilderness event · Venom Matriarch arrives at the Greenwood camp in 8 seconds. Gather and prepare!");
      }
    }
    if (this.forestPortalCycle.record(mobId, now) && !this.state.portals.has("forest-entry") && !this.forestDungeonActive) {
      // Repair an old excavation beneath the arrival pad before making it usable.
      for (let x = 45; x <= 46; x++) for (let z = 28; z <= 29; z++) {
        const a = worldToChunk(x, z), stored = this.getChunk(a.chunkX, a.chunkZ);
        if (getBlock(stored.chunk, a.localX, 7, a.localZ) !== Block.Air) continue;
        setBlock(stored.chunk, a.localX, 7, a.localZ, Block.Stone); stored.revision++;
        this.broadcast("block:changed", { requestId: "forest-pad", x, y: 7, z, block: Block.Stone, revision: stored.revision } satisfies BlockChanged);
      }
      const portal = new ForestPortalState(); Object.assign(portal, FOREST_PORTAL_POSITION, { kind: "entry", expiresAt: now + FOREST_PORTAL_LIFETIME_MS });
      this.state.portals.set("forest-entry", portal);
    }
    if (FOREST_DUNGEON_MOBS.some(entry => entry.id === mobId)) this.advanceForestDungeon();
    mob.combatState = "idle";
    mob.stateUntil = 0;
    mob.targetId = "";
    mob.aimCommitted = false;
    this.mobCommittedAim.delete(mobId);
    this.clearMarksForMob(mobId);
    this.refreshNearbyObjectives();
    for (const playerId of recipients) {
      const player = this.state.players.get(playerId)!;
      const reward = defeatReward(player.health, player.maxHealth, player.stamina, player.maxStamina, definition, mob.rewardMultiplier);
      player.health = reward.health;
      player.stamina = reward.stamina;
      const coinsBefore = player.coins;
      player.coins = Math.min(1_000_000, player.coins + 2);
      void this.persistPlayer(playerId, player);
      this.broadcast("combat:reward", {
        playerId,
        mobId,
        coinsGranted: player.coins - coinsBefore,
        healthRestored: reward.healthRestored,
        staminaRestored: reward.staminaRestored,
        health: player.health,
        stamina: Math.round(player.stamina),
      } satisfies CombatReward);
      this.clients.find(client => client.sessionId === playerId)?.send("chat:notice", "Kill contribution credited · your personal loot is ready. Equipment bags expire after 30 seconds.");
    }
  }

  private sendObjectiveState(client: Client, force = false): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const progress = this.objectiveProgress.get(client.sessionId) ?? createObjectiveProgress();
    this.objectiveProgress.set(client.sessionId, progress);
    const update = nearbyObjective(client.sessionId, player, this.state.mobs, this.state.portals, this.state.lootDrops, Date.now(), progress.id, this.wildernessEvent.warningUntil);
    const fingerprint = JSON.stringify({ ...update, targetX: Math.round(update.targetX), targetY: Math.round(update.targetY), targetZ: Math.round(update.targetZ) });
    if (!force && fingerprint === progress.fingerprint) return;
    progress.id = update.objectiveId; progress.fingerprint = fingerprint;
    client.send("objective:update", update satisfies WorldObjectiveUpdate);
  }

  private refreshNearbyObjectives(): void {
    // Guidance is local context, not a quest chain with extra completion bonuses.
    for (const client of this.clients) this.sendObjectiveState(client);
  }

  private advanceWildernessEvent(now: number): void {
    if (!this.wildernessEvent.release(now)) return;
    this.registerMob(WILDERNESS_EVENT_ID, "cave_spitter", WILDERNESS_EVENT_POSITION);
    const mob = this.state.mobs.get(WILDERNESS_EVENT_ID)!;
    mob.name = "Greenwood Venom Matriarch";
    mob.isChampion = true;
    mob.health = mob.maxHealth = 24;
    mob.attackPattern = "aimed";
    mob.rewardMultiplier *= 1.5;
    this.refreshNearbyObjectives();
  }

  private spawnLootDrops(mobId: string, mob: MobState, now: number, ownerId = ""): void {
    const baseDrops = mob.isChampion && mob.archetype === "cave_spitter" ? [{ itemId: "acid_gland" as const, quantity: 3 }, { itemId: "acid_gland_focus" as const, quantity: 1 }]
      : mob.isChampion ? [{ itemId: "stone_core" as const, quantity: 3 }, { itemId: "stone_core_hammer" as const, quantity: 1 }]
      : lootForArchetype(mob.archetype as MobArchetypeId);
    const drops = [...baseDrops, ...armourDropForMob(mob.archetype, mob.difficultyTier, Math.random())];
    for (const [index, entry] of drops.entries()) {
      const angle = (index / Math.max(1, drops.length)) * Math.PI * 2 + this.lootDropSequence * 0.7;
      const drop = new LootDropState();
      drop.ownerId = ownerId;
      drop.itemId = entry.itemId;
      drop.quantity = entry.quantity;
      drop.x = mob.x + Math.cos(angle) * 0.42;
      drop.y = mob.y + 0.22;
      drop.z = mob.z + Math.sin(angle) * 0.42;
      drop.expiresAt = now + LOOT_DESPAWN_MS;
      this.state.lootDrops.set(`${mobId}:${now}:${++this.lootDropSequence}`, drop);
    }
  }

  private resolveLootPickups(now: number): void {
    for (const [dropId, drop] of this.state.lootDrops) {
      if (now >= drop.expiresAt) {
        this.state.lootDrops.delete(dropId);
        continue;
      }
      if (isEquipmentItem(drop.itemId)) continue;
      for (const [playerId, player] of this.state.players) {
        if (drop.ownerId && drop.ownerId !== playerId) continue;
        if (player.health <= 0 || !isLootInPickupRange(player, drop) || !hasCombatLineOfSight(player, drop, this.readWorldBlock)) continue;
        const itemId = drop.itemId as ItemId;
        let inventoryItem = player.inventory.get(itemId);
        const capacity = itemId === "healing_potion" ? HEALING_POTION.capacity : itemId === "iron_ore" || itemId === "silver_ore" ? ironCapacity(player.blacksmithUpgrades) : 65535;
        if ((inventoryItem?.quantity ?? 0) + drop.quantity > capacity) continue;
        const total = inventoryTotal(inventoryItem?.quantity, drop.quantity);
        if (!inventoryItem) {
          inventoryItem = new InventoryItemState();
          player.inventory.set(itemId, inventoryItem);
        }
        inventoryItem.quantity = total;
        void this.persistPlayer(playerId, player);
        this.state.lootDrops.delete(dropId);
        this.broadcast("loot:picked-up", {
          playerId,
          dropId,
          itemId,
          quantity: drop.quantity,
          total,
        } satisfies LootPickedUp);
        break;
      }
    }
  }

  private handleLootCollect(client: Client, payload: unknown): void {
    const parsed = LootCollectRequestSchema.safeParse(payload);
    const reply = (ok: boolean, message: string) => client.send("loot:result", { ok, dropId: parsed.success ? parsed.data.dropId : "", message } satisfies LootCollectResult);
    if (!parsed.success) return reply(false, "Invalid loot request.");
    const player = this.state.players.get(client.sessionId);
    if (!player || player.health <= 0) return reply(false, "You must be alive to collect loot.");
    const drop = this.state.lootDrops.get(parsed.data.dropId);
    if (!drop || Date.now() >= drop.expiresAt) return reply(false, "That bag is no longer available.");
    if (drop.ownerId && drop.ownerId !== client.sessionId) return reply(false, "That is another player's personal loot.");
    const mainHandId = equipmentForItem(drop.itemId);
    const armourId = armourForItem(drop.itemId);
    if (!mainHandId && !armourId) return reply(false, "Materials are collected automatically.");
    if (!isLootInPickupRange(player, drop, EQUIPMENT_LOOT_RANGE) || !hasCombatLineOfSight(player, drop, this.readWorldBlock)) return reply(false, "Move beside the bag with a clear path to it.");
    if (parsed.data.equip && (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId) || player.defending)) return reply(false, "Finish your action before equipping, or keep it in your pack.");
    const itemId = drop.itemId as ItemId;
    let item = player.inventory.get(itemId);
    const before = item?.quantity ?? 0;
    if (before + drop.quantity > 65535) return reply(false, "Your pack cannot hold another of that item.");
    if (!item) { item = new InventoryItemState(); player.inventory.set(itemId, item); }
    item.quantity = inventoryTotal(before, drop.quantity);
    // Synchronous removal makes competing and replayed requests collect at most once.
    this.state.lootDrops.delete(parsed.data.dropId);
    if (parsed.data.equip && mainHandId) this.handleMainHandEquip(client, { requestId: `loot-equip-${Date.now()}`, mainHandId });
    if (parsed.data.equip && armourId) this.handleArmourEquip(client, { armourId });
    void this.persistPlayer(client.sessionId, player);
    this.broadcast("loot:picked-up", { playerId: client.sessionId, dropId: parsed.data.dropId, itemId,
      quantity: drop.quantity, total: item.quantity } satisfies LootPickedUp);
    reply(true, `${ITEM_DEFINITIONS[itemId].name} ${parsed.data.equip ? "equipped" : "kept in your pack"}.`);
  }

  private damagePlayer(mobId: string, playerId: string, damage: number, now: number, blockable = true): boolean {
    const player = this.state.players.get(playerId);
    if (!player || player.health <= 0 || now < player.invulnerableUntil || isInsideTownSafeZone(player) || !caveEncounterAllows(mobId, player)) return false;
    const mob = this.state.mobs.get(mobId);
    const defense = blockable && mob
      ? resolveDefense(damage, player.defending, player.defenseStartedAt, now, isAttackInGuardArc(player, mob))
      : { damage, guarded: false, parried: false };
    const traitId = player.equippedTrait as TraitId;
    if (defense.guarded) {
      const cost = guardStaminaCost(defense.parried ? 8 : 14, traitId);
      player.stamina = Math.max(0, player.stamina - cost);
      if (defense.parried) player.stamina = Math.min(player.maxStamina, player.stamina + parryStaminaRestore(traitId));
    }
    if (defense.parried && mob) {
      this.staggerMob(mobId, mob, now, PARRY_STAGGER_MS, true);
    }
    if (player.stamina <= 0) player.defending = false;
    defense.damage = armouredDamage(defense.damage, player.armourId);
    player.momentumStacks = momentumAfterDefense(player.momentumStacks, defense.damage, defense.parried, traitId);
    player.health = Math.max(0, player.health - defense.damage);
    const defeated = player.health === 0;
    this.broadcast("combat:player-hit", {
      mobId,
      playerId,
      damage: defense.damage,
      health: player.health,
      defeated,
      guarded: defense.guarded,
      parried: defense.parried,
      momentumStacks: player.momentumStacks,
    } satisfies PlayerHit);
    if (defense.guarded) {
      this.broadcast("combat:defense", {
        playerId,
        mobId,
        guarded: true,
        parried: defense.parried,
        damage: defense.damage,
        stamina: Math.round(player.stamina),
        momentumStacks: player.momentumStacks,
      } satisfies DefenseResolved);
    }
    if (!defeated) return true;
    leaveRecoveryBag(player, `${now}-${++this.lootDropSequence}`);
    void this.persistPlayer(playerId, player);
    player.defending = false;
    player.momentumStacks = 0;
    this.pendingAttacks.delete(playerId);
    this.cancelWeaponProjectiles(playerId);
    this.pendingPowers.delete(playerId);
    this.specialMarks.delete(playerId);
    this.brambleSnares.delete(playerId);
    this.attackChains.delete(playerId);
    this.movementInputs.set(playerId, { request: idleMovementInput(), receivedAt: now });
    this.verticalVelocities.set(playerId, 0);
    if (mob) {
      const definition = mobArchetype(mob.archetype);
      const home = this.mobHomes.get(mobId) ?? definition.spawn;
      mob.x = home.x;
      mob.y = home.y;
      mob.z = home.z;
      mob.combatState = "recover";
      this.clearMobAttackTimeline(mob);
      mob.stateUntil = now + definition.recoverMs;
      mob.targetId = "";
    }
    return true;
  }

  private forestGate(x: number, open: boolean): void {
    for (let z = 164; z <= 166; z++) for (let y = 8; y <= 10; y++) {
      const a = worldToChunk(x, z), stored = this.getChunk(a.chunkX, a.chunkZ), block = open ? Block.Air : Block.OakLog;
      if (getBlock(stored.chunk, a.localX, y, a.localZ) === block) continue;
      setBlock(stored.chunk, a.localX, y, a.localZ, block); stored.revision++;
      this.broadcast("block:changed", { requestId: `forest-gate-${x}-${open}`, x, y, z, block, revision: stored.revision } satisfies BlockChanged);
    }
  }

  private spawnForestStage(stage: number): void {
    for (const entry of FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage)) {
      if (this.state.mobs.has(entry.id)) continue;
      this.registerMob(entry.id, entry.archetype, entry);
      const mob = this.state.mobs.get(entry.id)!;
      mob.name = stage === 3 ? "Ancient Root Guardian" : stage === 2 ? "Thicket Guard" : "Forest Sentinel";
      mob.health = mob.maxHealth = stage === 3 ? 28 : entry.archetype === "cave_spitter" ? 8 : 10;
      mob.attackDamage = stage === 3 ? 2 : 1; mob.speedMultiplier = 1; mob.rewardMultiplier = 1;
    }
  }

  private advanceForestDungeon(): void {
    for (const stage of [1, 2]) {
      const cleared = FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage).every(entry => this.state.mobs.get(entry.id)?.alive === false);
      if (cleared) { this.forestGate(stage === 1 ? 168 : 180, true); this.spawnForestStage(stage + 1); }
    }
    if (this.state.mobs.get("forest-guardian")?.alive === false && !this.state.portals.has("forest-victory")) {
      const portal = new ForestPortalState(); Object.assign(portal, { kind: "return", x: 189.5, y: 8, z: 165.5 });
      this.state.portals.set("forest-victory", portal);
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        if (player && isInForestDungeon(player.x, player.z)) client.send("portal:notice", "Guardian defeated! Collect your equipment bag, then use the return portal.");
      }
    }
  }

  private useForestPortal(client: Client, payload: unknown): void {
    if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") return;
    const player = this.state.players.get(client.sessionId), portal = this.state.portals.get(payload.id), now = Date.now();
    if (!player || !portal || !canUseForestPortal(player, portal, now)
      || now - (this.forestTravelAt.get(client.sessionId) ?? -Infinity) < 1000
      || !hasCombatLineOfSight(player, portal, this.readWorldBlock)) return;
    if (portal.kind === "return" && !this.forestReturns.has(client.sessionId)) return;
    this.forestTravelAt.set(client.sessionId, now);
    let destination = this.forestReturns.get(client.sessionId) ?? FOREST_PORTAL_POSITION;
    if (portal.kind === "entry") {
      if (!this.forestDungeonActive) {
        this.forestDungeonActive = true;
        this.state.portals.delete("forest-victory");
        this.forestGate(168, false); this.forestGate(180, false);
        this.spawnForestStage(1);
        const exit = new ForestPortalState(); Object.assign(exit, FOREST_DUNGEON_EXIT, { kind: "return" });
        this.state.portals.set("forest-return", exit);
      }
      this.forestReturns.set(client.sessionId, { ...FOREST_PORTAL_POSITION });
      destination = FOREST_DUNGEON_ENTRY;
    } else this.forestReturns.delete(client.sessionId);
    this.pendingMining.delete(client.sessionId); this.pendingAttacks.delete(client.sessionId);
    this.pendingPowers.delete(client.sessionId); this.cancelWeaponProjectiles(client.sessionId);
    this.attackChains.delete(client.sessionId); this.brambleSnares.delete(client.sessionId); this.specialMarks.delete(client.sessionId);
    this.trading.disconnect(client.sessionId);
    player.defending = false; player.powerCastStartedAt = 0;
    player.x = destination.x; player.y = destination.y; player.z = destination.z;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, now + 1200);
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: now });
    this.verticalVelocities.set(client.sessionId, 0);
    client.send("player:portal", { ...destination, entering: portal.kind === "entry" });
    client.send("world:bootstrap", this.bootstrapPayload(destination));
    void this.persistPlayer(client.sessionId, player);
  }

  private returnPlayerToTown(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.health > 0) return;
    const now = Date.now();
    const spawn = this.spawnPoint();
    this.forestReturns.delete(client.sessionId);
    player.x = spawn.x; player.y = spawn.y; player.z = spawn.z;
    player.health = player.maxHealth;
    player.stamina = player.maxStamina;
    player.defending = false;
    player.powerCooldownUntil = 0;
    player.specialCooldownUntil = 0;
    player.invulnerableUntil = now + 1500;
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: now });
    this.verticalVelocities.set(client.sessionId, 0);
    client.send("player:returned", spawn);
    void this.persistPlayer(client.sessionId, player);
  }

  private releaseMobVolley(mobId: string, mob: MobState, origin: { x: number; y: number; z: number }, shots: { x: number; y: number; z: number }[], now: number, travelMs: number, damage: number, hazardRadius: number, hazardDurationMs: number): void {
    for (const aim of shots) {
      const projectileId = `${mobId}:${++this.mobProjectileSequence}`;
      const start = { x: origin.x, y: origin.y + 1.05, z: origin.z };
      const end = { x: aim.x, y: aim.y + .08, z: aim.z };
      this.pendingMobProjectiles.set(projectileId, { projectileId, mobId, archetype: mob.archetype, damage, hazardRadius, hazardDurationMs,
        start, end, position: start, startedAt: now, impactAt: now + travelMs });
      this.broadcast("combat:mob-projectile", { projectileId, mobId, ...origin, targetX: aim.x, targetY: aim.y, targetZ: aim.z, travelMs, releasedAt: now } satisfies MobProjectileReleased);
    }
  }

  private resolveMobProjectiles(now: number): void {
    for (const [mobId, volley] of this.delayedMatriarchVolleys) {
      const mob = this.state.mobs.get(mobId);
      if (!mob?.alive || mob.combatState === "stagger") { this.delayedMatriarchVolleys.delete(mobId); continue; }
      if (now < volley.releaseAt) continue;
      this.delayedMatriarchVolleys.delete(mobId);
      this.releaseMobVolley(mobId, mob, volley.origin, volley.shots, now, volley.travelMs, volley.damage, 0, 0);
    }
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      const progress = Math.max(0, Math.min(1, (now - projectile.startedAt) / (projectile.impactAt - projectile.startedAt)));
      const next = flightPoint(projectile.start, projectile.end, progress);
      const targets = [...this.state.players.entries()]
        .filter(([, player]) => player.health > 0 && !isInsideTownSafeZone(player) && caveEncounterAllows(projectile.mobId, player))
        .map(([id, player]) => ({ id, x: player.x, y: player.y, z: player.z }));
      const collision = projectileImpact(projectile.position, next, targets, this.readWorldBlock);
      projectile.position = next;
      if (!collision && progress < 1) continue;
      this.pendingMobProjectiles.delete(projectileId);
      const impact = collision?.point ?? next;
      this.resolveProjectileVisual(projectileId, impact, collision?.kind === "terrain" ? "terrain" : collision ? "hit" : "miss");
      if (collision?.kind === "terrain") continue;
      const definition = mobArchetype(projectile.archetype);
      const target = collision?.targetId ? this.state.players.get(collision.targetId) : undefined;
      if (target && collision?.targetId) {
        this.damagePlayer(projectile.mobId, collision.targetId, projectile.damage, now);
      }
      const hazardDurationMs = projectile.hazardDurationMs ?? definition.hazardDurationMs;
      const hazardRadius = projectile.hazardRadius ?? definition.hazardRadius;
      if (hazardDurationMs <= 0 || hazardRadius <= 0) continue;
      const puddle = target ? { x: impact.x, y: target.y, z: impact.z }
        : { x: projectile.end.x, y: projectile.end.y - 0.08, z: projectile.end.z };
      const hazardId = `acid:${projectileId}`;
      const expiresAt = now + hazardDurationMs;
      this.mobHazards.set(hazardId, {
        hazardId,
        mobId: projectile.mobId,
        ...puddle,
        radius: hazardRadius,
        damage: projectile.damage,
        expiresAt,
        nextDamageAt: now + 700,
        lastDamageAt: new Map(),
      });
      this.broadcast("combat:mob-hazard", {
        hazardId,
        mobId: projectile.mobId,
        ...puddle,
        radius: hazardRadius,
        expiresAt,
      } satisfies MobHazardPlaced);
    }
  }

  private resolveMobHazards(now: number): void {
    for (const [hazardId, hazard] of this.mobHazards) {
      if (now >= hazard.expiresAt) {
        this.mobHazards.delete(hazardId);
        continue;
      }
      if (now < hazard.nextDamageAt) continue;
      for (const [playerId, player] of this.state.players) {
        const lastDamageAt = hazard.lastDamageAt.get(playerId) ?? 0;
        if (now - lastDamageAt < 900 || !isInsideImpact(player, hazard, hazard.radius, 1.25)
          || !hasCombatLineOfSight(hazard, player, this.readWorldBlock)) continue;
        if (this.damagePlayer(hazard.mobId, playerId, hazard.damage, now, false)) hazard.lastDamageAt.set(playerId, now);
      }
    }
  }

  private handleMove(client: Client, payload: unknown): void {
    const parsed = MoveRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "move", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    const rate = recordMovementMessage(this.movementRateWindows.get(client.sessionId), now);
    this.movementRateWindows.set(client.sessionId, rate.window);
    if (!rate.allowed) return this.reject(client, { action: "move", reason: "rate" });
    const previous = this.movementInputs.get(client.sessionId);
    if (previous && parsed.data.sequence <= previous.request.sequence) return;
    const rejection = movementRejectionReason(player, parsed.data);
    if (rejection) return this.reject(client, { action: "move", reason: rejection });
    const requestedStop = requestedStopPosition(previous, parsed.data, player);
    if (requestedStop) {
      const correctedStop = resolvePlayerMotion(
        { x: player.x, y: player.y, z: player.z },
        {
          x: requestedStop.x - player.x,
          y: requestedStop.y - player.y,
          z: requestedStop.z - player.z,
        },
        this.readWorldBlock,
      );
      const reachedRequestedStop = Math.hypot(
        correctedStop.x - requestedStop.x,
        correctedStop.y - requestedStop.y,
        correctedStop.z - requestedStop.z,
      ) <= 0.02;
      if (reachedRequestedStop) {
        player.x = correctedStop.x;
        player.y = correctedStop.y;
        player.z = correctedStop.z;
      }
    }
    player.yaw = parsed.data.yaw;
    this.movementInputs.set(client.sessionId, { request: parsed.data, receivedAt: now });
    if (Math.hypot(parsed.data.strafe, parsed.data.forward) > 0.01) {
      const mining = this.pendingMining.get(client.sessionId);
      if (mining) {
        this.pendingMining.delete(client.sessionId);
        this.reject(client, { requestId: mining.request.requestId, action: "mine", reason: "moving" });
      }
    }
  }

  private readWorldBlock = (x: number, y: number, z: number) => {
    if (y < 0) return Block.Bedrock;
    if (y >= CHUNK_HEIGHT) return Block.Air;
    const address = worldToChunk(x, z);
    return getBlock(this.getChunk(address.chunkX, address.chunkZ).chunk, address.localX, y, address.localZ);
  };

  private resolveBrambleSnares(now: number): void {
    for (const [casterId, snare] of this.brambleSnares) {
      if (now >= snare.expiresAt) {
        this.brambleSnares.delete(casterId);
        continue;
      }
      const target = [...this.state.mobs.entries()]
        .map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, alive: mob.alive }))
        .find(mob => isInsideBrambleSnare(snare, mob));
      if (!target) continue;
      const mob = this.state.mobs.get(target.id);
      if (!mob || !hasCombatLineOfSight(snare, mob, this.readWorldBlock)) continue;
      this.staggerMob(target.id, mob, now, BRAMBLE_SNARE.rootMs, true);
      this.brambleSnares.delete(casterId);
      this.broadcast("special:snare-triggered", {
        casterId,
        mobId: target.id,
        x: snare.x,
        y: snare.y,
        z: snare.z,
        rootMs: BRAMBLE_SNARE.rootMs,
      } satisfies BrambleSnareTriggered);
    }
  }

  private simulatePlayers(deltaTime: number): void {
    if (Date.now() - this.lastPartyUpdateAt >= 500) {
      this.sendPartyUpdates(Date.now());
      for (const client of this.clients) this.sendObjectiveState(client);
    }
    const now = Date.now();
    const entrance = this.state.portals.get("forest-entry");
    if (entrance && now >= entrance.expiresAt) this.state.portals.delete("forest-entry");
    if (this.forestDungeonActive && ![...this.state.players.values()].some(player => isInForestDungeon(player.x, player.z))) {
      this.forestDungeonActive = false;
      this.state.portals.delete("forest-return"); this.state.portals.delete("forest-entry");
      this.state.portals.delete("forest-victory");
      this.forestReturns.clear();
      for (const entry of FOREST_DUNGEON_MOBS) {
        this.state.mobs.delete(entry.id); this.mobHomes.delete(entry.id); this.mobNavigation.delete(entry.id);
        this.pendingMobMelee.delete(entry.id); this.mobAwareness.delete(entry.id); this.combatContributions.clear(entry.id);
        this.mobPatrols.delete(entry.id); this.mobProgress.delete(entry.id); this.mobUnreachableUntil.delete(entry.id); this.mobReturning.delete(entry.id);
        this.mobVerticalVelocities.delete(entry.id); this.lastMobAttackAt.delete(entry.id); this.mobCommittedAim.delete(entry.id);
        this.crawlerPositioning.delete(entry.id); this.crawlerRushes.delete(entry.id); this.spitterPositioning.delete(entry.id);
        this.mobStaggerImmuneUntil.delete(entry.id); this.mobAssistAt.delete(entry.id);
        for (const [id, shot] of this.pendingMobProjectiles) if (shot.mobId === entry.id) {
          this.pendingMobProjectiles.delete(id); this.resolveProjectileVisual(id, shot.position, "miss");
        }
        for (const [id, hazard] of this.mobHazards) if (hazard.mobId === entry.id) this.mobHazards.delete(id);
      }
    }
    this.resolveMining(now);
    this.regrowMinerals(now);
    if (this.pendingWorldDeltaWrites.size > 0 && now - this.lastWorldDeltaRetryAt >= 5_000) {
      this.lastWorldDeltaRetryAt = now;
      void this.flushWorldDeltaWrites();
    }
    this.resolvePendingPowers(now);
    this.resolvePendingAttacks(now);
    this.advanceCrawlerRushes(now);
    this.advanceChampionCharges(now);
    this.resolveMobMelee(now);
    this.resolveWeaponProjectiles(now);
    this.resolveBrambleSnares(now);
    this.resolveMobProjectiles(now);
    this.resolveMobHazards(now);
    this.advanceWildernessEvent(now);
    for (const pack of ROAMING_PACKS) {
      const route = this.roamingRoutes.get(pack.id) ?? createRoamingRouteState(now);
      this.roamingRoutes.set(pack.id, route);
      const members = pack.offsets.flatMap((_, index) => {
        const mob = this.state.mobs.get(roamingMemberId(pack, index));
        return mob?.alive ? [{ index, pose: mob, idle: mob.combatState === "idle" && !this.roamingEngaged.has(roamingMemberId(pack, index)) && !this.roamingReturning.has(roamingMemberId(pack, index)) }] : [];
      });
      advanceRoamingRoute(pack, route, now, members);
    }
    for (const [mobId, mob] of this.state.mobs) {
      if (mobId === WILDERNESS_EVENT_ID && !mob.alive) continue;
      if (!mob.alive && FOREST_DUNGEON_MOBS.some(entry => entry.id === mobId)) continue;
      if (mobId === WILDERNESS_EVENT_ID) {
        if (!mob.enraged && matriarchEnraged(mob.health, mob.maxHealth)) mob.enraged = true;
        if (mob.combatState === "idle") mob.attackPattern = matriarchPattern(mob.actionSequence, mob.enraged);
      }
      else if (mob.isChampion && mob.combatState === "idle") mob.attackPattern = championPattern(mob);
      else if (mobId === "frontier-brute" && mob.combatState === "idle") mob.attackPattern = frontierBrutePattern(mob.actionSequence);
      else if (mob.archetype === "cave_spitter" && mob.combatState === "idle") mob.attackPattern = spitterPattern(mob.actionSequence);
      const definition = combatMobDefinition(mob);
      const home = this.mobHomes.get(mobId) ?? definition.spawn;
      if (!mob.alive && now >= mob.respawnAt) {
        this.combatContributions.clear(mobId);
        this.mobProgress.delete(mobId); this.mobUnreachableUntil.delete(mobId); this.mobReturning.delete(mobId);
        mob.awarenessState = "patrol"; mob.alertUntil = 0;
        this.mobAwareness.delete(mobId);
        const stats = scaledMobStats(definition, dangerBandAt(home));
        const spawn = walkableMobSpawn(home, this.readWorldBlock, pose => this.mobPositionAllowed(pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose));
        mob.x = spawn.x;
        mob.y = spawn.y;
        mob.z = spawn.z;
        this.mobVerticalVelocities.set(mobId, 0);
        this.mobNavigation.set(mobId, createMobNavigationState());
        this.mobPatrols.delete(mobId);
        this.roamingEngaged.delete(mobId); this.roamingReturning.delete(mobId);
        this.spitterPositioning.delete(mobId);
        this.mobStaggerImmuneUntil.delete(mobId);
        this.mobCommittedAim.delete(mobId);
        mob.aimCommitted = false;
        mob.health = stats.maxHealth;
        mob.maxHealth = stats.maxHealth;
        mob.armor = stats.armor;
        mob.attackDamage = stats.damage;
        mob.speedMultiplier = stats.speedMultiplier;
        mob.rewardMultiplier = stats.rewardMultiplier;
        if (mob.isChampion) { mob.rewardMultiplier *= 1.5; mob.actionSequence = 0; mob.attackPattern = championPattern(mob); }
        mob.alive = true;
        mob.respawnAt = 0;
        mob.combatState = "idle";
        mob.stateUntil = 0;
        mob.targetId = "";
      }
      if (!mob.alive) continue;
      const gravity = advanceMobGravity(mob, this.mobVerticalVelocities.get(mobId) ?? 0, deltaTime, this.readWorldBlock);
      mob.y = gravity.y;
      this.mobVerticalVelocities.set(mobId, gravity.velocity);
      if (mob.combatState === "strike") {
        if (now < mob.attackContactEndAt) continue;
        mob.combatState = "recover";
        mob.stateUntil = mob.attackRecoveryEndAt;
        mob.aimCommitted = false;
        mob.targetId = "";
      }
      if (mob.combatState === "stagger" || mob.combatState === "recover") {
        if (now < mob.stateUntil) continue;
        if (mob.combatState === "recover" && definition.attackKind === "projectile") {
          const positioning = this.spitterPositioning.get(mobId) ?? createSpitterPositioning();
          positioning.sidestepPending = true;
          this.spitterPositioning.set(mobId, positioning);
        }
        mob.combatState = "idle";
        mob.stateUntil = 0;
        this.clearMobAttackTimeline(mob);
        if (mob.isChampion) continue;
      }
      if (mob.combatState === "windup") {
        const targetPlayer = this.state.players.get(mob.targetId);
        if ((CAVE_ENCOUNTERS[mobId] || roamingMembership(mobId) || mob.isChampion) && (!targetPlayer || targetPlayer.health <= 0 || !caveEncounterAllows(mobId, targetPlayer) || !this.roamingAllowed(mobId, targetPlayer) || !this.championAllowed(mobId, targetPlayer))) {
          mob.targetId = "";
          mob.aimCommitted = false;
          mob.combatState = "recover";
          mob.stateUntil = now + definition.recoverMs;
          this.mobCommittedAim.delete(mobId);
          this.pendingMobMelee.delete(mobId);
          this.clearMobAttackTimeline(mob);
          continue;
        }
        if (targetPlayer && now < mob.stateUntil - mobAimCommitMs(mob.archetype)) {
          const desiredYaw = Math.atan2(targetPlayer.x - mob.x, targetPlayer.z - mob.z) * 180 / Math.PI;
          mob.yaw = mob.archetype === "stone_brute" ? turnBruteAim(mob.yaw, desiredYaw, deltaTime) : desiredYaw;
          this.mobCommittedAim.set(mobId, { x: targetPlayer.x, y: targetPlayer.y, z: targetPlayer.z, yaw: mob.yaw });
        }
        if (now >= mob.stateUntil - mobAimCommitMs(mob.archetype)) mob.aimCommitted = true;
        this.updateMobStrikeOrigin(mobId, mob);
        if (now < mob.stateUntil) continue;
        const aim = this.mobCommittedAim.get(mobId) ?? { x: mob.x + Math.sin(mob.yaw * Math.PI / 180) * definition.stopDistance,
          y: mob.y, z: mob.z + Math.cos(mob.yaw * Math.PI / 180) * definition.stopDistance, yaw: mob.yaw };
        this.mobCommittedAim.delete(mobId);
        this.setMobAttackTimeline(mob, mob.attackStartedAt, now, mobId);
        mob.aimCommitted = definition.attackKind === "melee";
        mob.combatState = definition.attackKind === "melee" ? "strike" : "recover";
        mob.stateUntil = definition.attackKind === "melee" ? mob.attackContactEndAt : mob.attackRecoveryEndAt;
        mob.actionSequence += 1;
        this.lastMobAttackAt.set(mobId, now);
        if (!targetPlayer && mob.archetype !== "stone_brute") {
          mob.combatState = "recover";
          mob.stateUntil = now + definition.recoverMs;
          mob.aimCommitted = false;
          this.clearMobAttackTimeline(mob);
          continue;
        }
        if (definition.attackKind === "projectile") {
          const shots = mob.isChampion && mobId !== WILDERNESS_EVENT_ID ? spitterChampionShots(mob, aim, mob.attackPattern) : spitterShotEndpoints(mob, aim.yaw, mob.attackPattern);
          const origin = { x: mob.x, y: mob.y, z: mob.z };
          this.releaseMobVolley(mobId, mob, origin, shots, now, definition.projectileTravelMs, mob.attackDamage, definition.hazardRadius, definition.hazardDurationMs);
          if (mobId === WILDERNESS_EVENT_ID && mob.attackPattern === "double-fan")
            this.delayedMatriarchVolleys.set(mobId, { origin, shots, releaseAt: now + MATRIARCH_PHASE.volleyGapMs, damage: mob.attackDamage, travelMs: definition.projectileTravelMs });
          mob.targetId = "";
          continue;
        }
        const deltaX = aim.x - mob.x;
        const deltaZ = aim.z - mob.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (crawlerRushDistance(mob.archetype) > 0) {
          this.crawlerRushes.set(mobId, { yaw: aim.yaw, distance: crawlerRushDistance(mob.archetype), startedAt: now, progress: 0 });
        } else if (distance > 0.001) {
          const lungeDistance = Math.min(definition.lungeDistance, Math.max(0, distance - definition.stopDistance * 0.6));
          this.displaceMob(mobId, mob, {
            x: Math.sin(aim.yaw * Math.PI / 180) * lungeDistance, z: Math.cos(aim.yaw * Math.PI / 180) * lungeDistance,
          });
        }
        if (mob.isChampion && mob.attackPattern === "charge") {
          this.championCharges.set(mobId, { yaw: aim.yaw, startedAt: now, progress: 0, hit: new Set() });
        } else {
          this.pendingMobMelee.set(mobId, { targetId: mob.targetId, yaw: aim.yaw, impactAt: mob.attackContactAt });
        }
        if (mob.archetype !== "stone_brute") {
          mob.attackStrikeX = mob.x; mob.attackStrikeY = mob.y; mob.attackStrikeZ = mob.z;
        }
        continue;
      }
      const players = [...this.state.players.entries()].map(([id, player]) => ({
        id,
        x: player.x,
        y: player.y,
        z: player.z,
        health: player.health,
      })).filter(player => !isInsideTownSafeZone(player)
        && caveEncounterAllows(mobId, player)
        && this.roamingAllowed(mobId, player)
        && this.championAllowed(mobId, player)
        && (mobId === "stone-brute" || !isInStoneBruteArena(player.x, player.z)));
      const awareness = this.mobAwareness.get(mobId) ?? createMobAwareness();
      this.mobAwareness.set(mobId, awareness);
      const previousTarget = awareness.targetId;
      const target = this.roamingReturning.has(mobId) || this.mobReturning.has(mobId) || now < (this.mobUnreachableUntil.get(mobId) ?? 0)
        ? null : awareMobTarget(mob, players, awareness, now, definition.aggroRange,
        player => hasCombatLineOfSight(mob, player, this.readWorldBlock));
      if (!target) {
        this.crawlerPositioning.delete(mobId);
        this.spitterPositioning.delete(mobId);
        if (this.mobReturning.has(mobId) && !roamingMembership(mobId)) {
          if (Math.hypot(mob.x - home.x, mob.z - home.z) <= .65) this.mobReturning.delete(mobId);
          else {
            const failed = this.moveNavigatingMob(mobId, mob, pursueTarget(mob, home, deltaTime, definition.speed * mob.speedMultiplier, .3), home, now);
            mob.awarenessState = "return";
            if (failed) this.mobReturning.delete(mobId); // Give local patrol another safe goal; never teleport.
            continue;
          }
        }
        if (roamingMembership(mobId)) {
          if (this.roamingEngaged.delete(mobId)) {
            this.roamingReturning.add(mobId); this.mobNavigation.set(mobId, createMobNavigationState());
          }
          this.patrolRoamingMember(mobId, mob, now, deltaTime, Math.min(1.1, definition.speed * mob.speedMultiplier * .75));
          mob.awarenessState = this.roamingReturning.has(mobId) ? "return" : "patrol";
          continue;
        }
        this.patrolMob(mobId, mob, home, now, deltaTime, Math.min(0.9, definition.speed * mob.speedMultiplier * 0.65));
        mob.awarenessState = Math.hypot(mob.x - home.x, mob.z - home.z) > MOB_PATROL_RADIUS + .5 ? "return" : "patrol";
        continue;
      }
      if (target.visible && previousTarget !== target.id) mob.alertUntil = now + 900;
      mob.awarenessState = target.visible ? "engaged" : "search";
      if (roamingMembership(mobId)) this.roamingEngaged.add(mobId);
      if (this.mobPatrols.delete(mobId)) this.mobNavigation.set(mobId, createMobNavigationState());
      const positioning = this.spitterPositioning.get(mobId) ?? createSpitterPositioning();
      if (definition.attackKind === "projectile") this.spitterPositioning.set(mobId, positioning);
      const rangedPursuit = definition.attackKind === "projectile" && target.visible
        ? positionSpitter(mob, target, home, positioning, now, deltaTime, definition.speed * mob.speedMultiplier,
          this.readWorldBlock, pose => this.mobPositionAllowed(pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && !isInStoneBruteArena(pose.x, pose.z))
        : null;
      let circling = null;
      if (crawlerRushDistance(mob.archetype) > 0 && target.visible) {
        let flank = this.crawlerPositioning.get(mobId);
        if (!flank || flank.targetId !== target.id) {
          flank = createCrawlerPositioning(mobId, target.id);
          this.crawlerPositioning.set(mobId, flank);
        }
        circling = circleCrawler(mob, target, flank, now, deltaTime, definition.speed * mob.speedMultiplier, definition.stopDistance);
      } else this.crawlerPositioning.delete(mobId);
      const attackers = () => [...this.state.mobs.entries()].map(([id, peer]) => ({
        id, alive: peer.alive, health: peer.health, archetype: peer.archetype, combatState: peer.combatState, targetId: peer.targetId,
      }));
      const waiting = definition.attackKind === "melee" && target.visible && meleeSlotsFull(target.id, attackers());
      const waitingGoal = waiting ? meleeWaitingGoal(mobId, target, [...this.mobAwareness.entries()]
        .filter(([id, awareness]) => awareness.targetId === target.id && this.state.mobs.get(id)?.alive
          && this.state.mobs.get(id)?.archetype !== "cave_spitter").map(([id]) => id), definition.stopDistance + 1.1) : null;
      const pursuit = waitingGoal ? pursueTarget(mob, waitingGoal, deltaTime, definition.speed * mob.speedMultiplier, .2)
        : circling ?? rangedPursuit ?? pursueTarget(mob, target, deltaTime, definition.speed * mob.speedMultiplier, target.visible ? definition.stopDistance : .3);
      const goal = waitingGoal ?? circling?.goal ?? rangedPursuit?.goal ?? target;
      const stuck = this.moveNavigatingMob(mobId, mob, pursuit, goal, now, pose => this.mobPositionAllowed(pose)
        && (!rangedPursuit?.retreating || Math.hypot(pose.x - home.x, pose.z - home.z) <= 6), !waiting);
      if (stuck) {
        this.mobAwareness.delete(mobId); this.crawlerPositioning.delete(mobId); this.spitterPositioning.delete(mobId);
        this.mobUnreachableUntil.set(mobId, now + 6000);
        if (roamingMembership(mobId)) this.roamingReturning.add(mobId); else this.mobReturning.add(mobId);
        mob.awarenessState = "return";
        continue;
      }
      // A ranged mob may walk backwards, but still aims its attacks at the player.
      if (target.visible && (definition.attackKind === "projectile" || pursuit.inAttackRange)) {
        mob.yaw = waiting ? Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI : pursuit.yaw;
      }
      const lastAttackAt = this.lastMobAttackAt.get(mobId) ?? 0;
      const actualDistance = Math.hypot(target.x - mob.x, target.z - mob.z);
      const inAttackRange = definition.attackKind === "projectile"
        ? (rangedPursuit?.cornered || actualDistance >= definition.minimumAttackRange - 0.05) && actualDistance <= definition.stopDistance + 0.05
        : actualDistance <= definition.stopDistance + 0.05;
      if (waiting || (definition.attackKind === "melee" && meleeSlotsFull(target.id, attackers()))
        || !this.silverGuardVolley.canStart(mobId, now)
        || circling || rangedPursuit?.repositioning || !target.visible || !inAttackRange || Math.abs(target.y - mob.y) > 1.75 || now - lastAttackAt < definition.cooldownMs
        || (definition.attackKind === "projectile" && [...this.pendingMobProjectiles.values()].some(shot => shot.mobId === mobId))
        || !hasCombatLineOfSight(mob, target, this.readWorldBlock)) continue;
      if (mobId === "frontier-brute") mob.attackPattern = frontierBrutePattern(mob.actionSequence);
      mob.combatState = "windup";
      this.silverGuardVolley.started(mobId, now);
      this.crawlerPositioning.delete(mobId);
      if (definition.attackKind !== "projectile") this.spitterPositioning.delete(mobId);
      this.mobNavigation.set(mobId, createMobNavigationState());
      mob.stateUntil = now + (mobId === "frontier-brute" ? FRONTIER_BRUTE[mob.attackPattern === "smash" ? "smash" : "slam"].windupMs : definition.windupMs);
      this.setMobAttackTimeline(mob, now, mob.stateUntil, mobId);
      mob.targetId = target.id;
      mob.aimCommitted = false;
      mob.yaw = Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI;
      this.mobCommittedAim.set(mobId, { x: target.x, y: target.y, z: target.z, yaw: mob.yaw });
      this.updateMobStrikeOrigin(mobId, mob);
    }
    for (const [sessionId, player] of this.state.players) {
      if (player.health <= 0) continue;
      player.dangerTier = dangerBandAt(player).tier;
      if (player.defending) {
        player.stamina = Math.max(0, player.stamina - guardStaminaCost(GUARD_STAMINA_DRAIN_PER_SECOND, player.equippedTrait as TraitId) * deltaTime);
        if (player.stamina <= 0) player.defending = false;
      } else {
        player.stamina = Math.min(player.maxStamina, player.stamina + staminaRecoveryWithMomentum(18, player.momentumStacks, player.equippedTrait as TraitId) * deltaTime);
      }
      const input = activeMovementInput(this.movementInputs.get(sessionId), now, player.yaw);
      const inputLength = Math.hypot(input.strafe, input.forward);
      const scale = inputLength > 1 ? 1 / inputLength : 1;
      const speed = movementSpeedWithMomentum(player.defending ? 2.1 : 4.2, player.momentumStacks, player.equippedTrait as TraitId) * armourStats(player.armourId).speed;
      const grounded = isPlayerSupported(this.readWorldBlock, player.x, player.y, player.z);
      let verticalVelocity = this.verticalVelocities.get(sessionId) ?? 0;
      if (grounded && verticalVelocity < 0) verticalVelocity = 0;
      else verticalVelocity = Math.max(-TERMINAL_VELOCITY, verticalVelocity - GRAVITY * deltaTime);

      const next = resolvePlayerMotion(
        { x: player.x, y: player.y, z: player.z },
        {
          x: input.strafe * scale * speed * deltaTime,
          y: verticalVelocity * deltaTime,
          z: input.forward * scale * speed * deltaTime,
        },
        this.readWorldBlock,
      );
      if (next.hitVertical || next.grounded) verticalVelocity = 0;
      this.verticalVelocities.set(sessionId, verticalVelocity);
      player.x = next.x;
      player.y = next.y;
      player.z = next.z;
      player.lastProcessedInput = input.sequence;
    }
    this.resolveLootPickups(now);
    this.flushDirtyPlayerSaves(now);
  }

  private handleDodge(client: Client, payload: unknown): void {
    const parsed = DodgeRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "dodge", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const now = Date.now();
    player.defending = false;
    const lastDodgeAt = this.lastDodgeAt.get(client.sessionId) ?? 0;
    if (now - lastDodgeAt < 350) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "rate" });
    if (player.stamina < 35) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "stamina" });
    this.cancelPendingPower(client.sessionId, "dodge");
    const direction = dodgeDirection(parsed.data.strafe, parsed.data.forward, parsed.data.yaw);
    const next = resolvePlayerMotion(
      { x: player.x, y: player.y, z: player.z },
      { x: direction.x * 1.8, y: 0, z: direction.z * 1.8 },
      this.readWorldBlock,
    );
    player.x = next.x;
    player.y = next.y;
    player.z = next.z;
    player.yaw = parsed.data.yaw;
    player.stamina -= 35;
    player.invulnerableUntil = now + 320;
    player.dodgeSequence += 1;
    this.lastDodgeAt.set(client.sessionId, now);
  }

  private handleDefense(client: Client, payload: unknown): void {
    const parsed = DefenseRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "defense", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.yaw = parsed.data.yaw;
    if (!parsed.data.active) {
      player.defending = false;
      return;
    }
    if (player.stamina < GUARD_MINIMUM_STAMINA) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "defense", reason: "stamina" });
    }
    if (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "defense", reason: "rate" });
    }
    player.defending = true;
    player.defenseStartedAt = Date.now();
  }

  private handlePower(client: Client, payload: unknown): void {
    const parsed = PowerRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.defending = false;
    const powerId = parsed.data.powerId as PowerId;
    const definition = POWER_DEFINITIONS[powerId];
    if (!definition || player.equippedPower !== powerId) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "missing" });
    }
    if (!isPowerCompatible(definition, player.mainHandTag)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "compatibility" });
    }
    const now = Date.now();
    const seismicMastery = player.seismicMastery as SeismicMasteryId;
    const seismicProfile = powerId === "seismic_cleave" ? seismicCleaveProfile(seismicMastery) : null;
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "rate" });
    }
    if (now < player.powerCooldownUntil) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "cooldown" });
    }
    const target = parsed.data.target;
    if (definition.core === "ground") {
      if (!target) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "payload" });
      }
      if (!isGroundPowerTargetInRange(player, target, definition.range)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "range" });
      }
      if (!isPlayerSupported(this.readWorldBlock, target.x, target.y, target.z)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "collision" });
      }
    } else if (target) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "payload" });
    }
    player.yaw = parsed.data.yaw;
    player.powerCooldownUntil = now + definition.cooldownMs;
    player.powerCastStartedAt = now;
    player.powerSequence += 1;
    this.pendingPowers.set(client.sessionId, {
      requestId: parsed.data.requestId,
      powerId,
      yaw: parsed.data.yaw,
      impactAt: now + definition.windupMs,
      ...(seismicProfile ? { seismicMastery } : {}),
      ...(target ? { target } : {}),
    });
    if (definition.core === "line") {
      const threatened = selectLinePowerTargets(
        player,
        parsed.data.yaw,
        [...this.state.mobs.entries()].map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, alive: mob.alive })),
        seismicProfile?.range ?? definition.range,
        seismicProfile?.width ?? definition.width,
      );
      for (const target of threatened) {
        const mob = this.state.mobs.get(target.id);
        if (!mob || !mob.alive || mob.combatState === "stagger") continue;
        const evade = powerEvadeDirection(player, parsed.data.yaw, mob);
        this.displaceMob(target.id, mob, { x: evade.x * 0.58, z: evade.z * 0.58 });
        mob.yaw = Math.atan2(player.x - mob.x, player.z - mob.z) * 180 / Math.PI;
      }
    }
    const cast: PowerCast = {
      casterId: client.sessionId,
      powerId,
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: parsed.data.yaw,
      startedAt: now,
      windupMs: definition.windupMs,
      ...(seismicProfile ? { range: seismicProfile.range, width: seismicProfile.width, seismicMastery } : {}),
      ...(target ? { target } : {}),
    };
    this.broadcast("power:cast", cast);
  }

  private handleSpecial(client: Client, payload: unknown): void {
    const parsed = SpecialRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "special", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.defending = false;
    if (parsed.data.specialId !== player.equippedSpecial) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "compatibility" });
    }
    const now = Date.now();
    if (now < player.specialCooldownUntil) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "cooldown" });
    }
    if (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "rate" });
    }
    player.yaw = parsed.data.yaw;
    if (parsed.data.specialId === "bramble_snare") {
      const target = parsed.data.target;
      if (!target) return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "payload" });
      if (!isBrambleSnareTargetInRange(player, target)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "range" });
      }
      if (!isPlayerSupported(this.readWorldBlock, target.x, target.y, target.z)) {
        return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "collision" });
      }
      const expiresAt = now + BRAMBLE_SNARE.lifetimeMs;
      player.specialCooldownUntil = now + BRAMBLE_SNARE.cooldownMs;
      this.brambleSnares.set(client.sessionId, { ...target, expiresAt });
      this.broadcast("special:snare-placed", {
        casterId: client.sessionId,
        ...target,
        radius: BRAMBLE_SNARE.radius,
        expiresAt,
        cooldownUntil: player.specialCooldownUntil,
      } satisfies BrambleSnarePlaced);
      return;
    }
    if (parsed.data.target) return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "payload" });
    const target = selectHuntersMarkTarget(
      player,
      parsed.data.yaw,
      [...this.state.mobs.entries()].map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, alive: mob.alive })),
    );
    if (!target) return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "range" });
    const expiresAt = now + HUNTERS_MARK.durationMs;
    player.specialCooldownUntil = now + HUNTERS_MARK.cooldownMs;
    this.specialMarks.set(client.sessionId, { mobId: target.id, expiresAt, stacks: HUNTERS_MARK.initialStacks });
    this.broadcast("special:applied", {
      casterId: client.sessionId,
      mobId: target.id,
      expiresAt,
      cooldownUntil: player.specialCooldownUntil,
      bonusDamage: HUNTERS_MARK.bonusDamage,
      stacks: HUNTERS_MARK.initialStacks,
      maxStacks: HUNTERS_MARK.maxStacks,
    } satisfies SpecialApplied);
  }

  private handleSpecialEquip(client: Client, payload: unknown): void {
    const parsed = SpecialEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "special", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "rate" });
    }
    player.equippedSpecial = parsed.data.specialId;
    this.specialMarks.delete(client.sessionId);
    this.brambleSnares.delete(client.sessionId);
  }

  private handlePowerCancel(client: Client, payload: unknown): void {
    const parsed = PowerCancelRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    this.cancelPendingPower(client.sessionId, "cancel");
  }

  private handlePowerEquip(client: Client, payload: unknown): void {
    const parsed = PowerEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const definition = POWER_DEFINITIONS[parsed.data.powerId];
    if (!definition || !isPowerCompatible(definition, player.mainHandTag)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "compatibility" });
    }
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "rate" });
    }
    player.equippedPower = parsed.data.powerId;
  }

  private handleSeismicMasteryEquip(client: Client, payload: unknown): void {
    const parsed = SeismicMasteryEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "power", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "rate" });
    }
    player.seismicMastery = parsed.data.masteryId;
  }

  private handleMainHandEquip(client: Client, payload: unknown): void {
    const parsed = MainHandEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "loadout", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "loadout", reason: "rate" });
    }
    const mainHand = MAIN_HAND_DEFINITIONS[parsed.data.mainHandId];
    if (!canEquipMainHand(parsed.data.mainHandId, itemId => player.inventory.get(itemId)?.quantity ?? 0)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "loadout", reason: "missing" });
    }
    player.mainHandId = mainHand.id;
    player.mainHandTag = mainHand.tag;
    this.attackChains.delete(client.sessionId);
    player.equippedPower = compatiblePowerOrFallback(player.equippedPower, mainHand.tag);
  }

  private handleTraitEquip(client: Client, payload: unknown): void {
    const parsed = TraitEquipRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "loadout", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId) || player.defending) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "loadout", reason: "rate" });
    }
    player.equippedTrait = parsed.data.traitId;
    player.momentumStacks = 0;
  }

  private cancelPendingPower(sessionId: string, reason: PowerCancelled["reason"]): boolean {
    const pending = this.pendingPowers.get(sessionId);
    if (!pending) return false;
    this.pendingPowers.delete(sessionId);
    const player = this.state.players.get(sessionId);
    if (player) {
      player.powerCooldownUntil = 0;
      player.powerCastStartedAt = 0;
    }
    this.broadcast("power:cancelled", {
      casterId: sessionId,
      powerId: pending.powerId,
      reason,
    } satisfies PowerCancelled);
    return true;
  }

  private fractureTerrain(requestId: string, x: number, z: number, playerY: number): PowerFracture | null {
    if (isProtectedVoxel(x, z)) return null;
    const top = Math.min(CHUNK_HEIGHT - 1, Math.floor(playerY));
    const bottom = Math.max(1, top - 4);
    for (let y = top; y >= bottom; y -= 1) {
      const block = this.readWorldBlock(x, y, z);
      if (block === Block.Air) continue;
      const nextBlock = fracturedBlockResult(block);
      if (nextBlock === null) return null;
      const address = worldToChunk(x, z);
      const stored = this.getChunk(address.chunkX, address.chunkZ);
      setBlock(stored.chunk, address.localX, y, address.localZ, nextBlock);
      stored.revision += 1;
      this.recordWorldDelta(x, y, z, nextBlock);
      this.broadcast("block:changed", {
        requestId: `${requestId}-fracture-${x}-${z}`,
        x,
        y,
        z,
        block: nextBlock,
        revision: stored.revision,
      } satisfies BlockChanged);
      return { x, y, z };
    }
    return null;
  }

  private resolvePendingPowers(now: number): void {
    for (const [sessionId, pending] of this.pendingPowers) {
      if (now < pending.impactAt) continue;
      this.pendingPowers.delete(sessionId);
      const player = this.state.players.get(sessionId);
      const definition = POWER_DEFINITIONS[pending.powerId];
      if (!player || !definition) continue;
      const seismicProfile = pending.powerId === "seismic_cleave"
        ? seismicCleaveProfile(pending.seismicMastery ?? "advancing_fault")
        : null;
      const resolvedRange = seismicProfile?.range ?? definition.range;
      const resolvedWidth = seismicProfile?.width ?? definition.width;
      const resolvedForwardStep = seismicProfile?.forwardStep ?? definition.forwardStep;
      const direction = powerDirection(pending.yaw);
      const origin = { x: player.x, y: player.y, z: player.z };
      const availableTargets = [...this.state.mobs.entries()].map(([id, mob]) => ({
        id,
        x: mob.x,
        y: mob.y,
        z: mob.z,
        alive: mob.alive,
      })).filter(target => hasCombatLineOfSight(origin, target, this.readWorldBlock));
      const mobilityTarget = definition.core === "mobility"
        ? selectMobilityPowerTarget(origin, pending.yaw, availableTargets, resolvedRange, resolvedWidth)
        : null;
      const advanceDistance = definition.core === "mobility"
        ? mobilityAdvanceDistance(origin, pending.yaw, mobilityTarget, resolvedForwardStep)
        : resolvedForwardStep;
      const stepped = definition.core === "mobility"
        ? resolveSweptHorizontalMotion(
            origin,
            { x: direction.x * advanceDistance, z: direction.z * advanceDistance },
            this.readWorldBlock,
          )
        : resolvePlayerMotion(
            origin,
            { x: direction.x * definition.forwardStep, y: 0, z: direction.z * definition.forwardStep },
            this.readWorldBlock,
          );
      player.x = stepped.x;
      player.y = stepped.y;
      player.z = stepped.z;
      const impactCenter = definition.core === "ground" && pending.target ? pending.target : player;
      const targets = (definition.core === "burst"
        ? selectBurstPowerTargets(player, availableTargets, resolvedRange)
        : definition.core === "ground"
          ? selectGroundPowerTargets(impactCenter, availableTargets, resolvedWidth)
          : definition.core === "mobility"
            ? mobilityTarget ? [mobilityTarget] : []
          : selectLinePowerTargets(player, pending.yaw, availableTargets, resolvedRange, resolvedWidth))
        .filter(target => hasCombatLineOfSight(impactCenter, target, this.readWorldBlock));
      const defeatedMobIds: string[] = [];
      const consumedMarks: SpecialConsumed[] = [];
      let resolvedDamage: number = definition.damage;
      let aftershockHitCount = 0;
      let traitBonusHitCount = 0;
      for (const target of targets) {
        const mob = this.state.mobs.get(target.id);
        if (!mob || !mob.alive || !hasCombatLineOfSight(impactCenter, mob, this.readWorldBlock)) continue;
        const mark = this.specialMarks.get(sessionId);
        const payoff = huntersMarkPowerPayoff(mark, target.id, now);
        if (mark && now >= mark.expiresAt) this.specialMarks.delete(sessionId);
        if (payoff.consumed) {
          this.specialMarks.delete(sessionId);
          consumedMarks.push({
            casterId: sessionId,
            mobId: target.id,
            powerId: pending.powerId,
            bonusDamage: payoff.bonusDamage,
            staggerMs: definition.staggerMs + payoff.staggerBonusMs,
          });
        }
        const traitBonusDamage = executionerDamageBonus(player.equippedTrait as TraitId, mob, { power: true });
        if (traitBonusDamage > 0) traitBonusHitCount += 1;
        const damage = damageAfterArmor(definition.damage + payoff.bonusDamage, mob.armor, true) + traitBonusDamage;
        const aftershock = pending.powerId === "seismic_cleave"
          && isSeismicAftershockTarget(impactCenter, pending.yaw, mob, resolvedRange);
        if (aftershock) aftershockHitCount += 1;
        resolvedDamage = Math.max(resolvedDamage, damage);
        this.combatContributions.record(target.id, sessionId, Math.min(mob.health, damage), now);
        mob.health = Math.max(0, mob.health - damage);
        this.alertHitMob(target.id, sessionId, now);
        mob.hitSequence += 1;
        const radialX = mob.x - impactCenter.x;
        const radialZ = mob.z - impactCenter.z;
        const radialLength = Math.hypot(radialX, radialZ);
        const knockbackDirection = (definition.core === "burst" || definition.core === "ground") && radialLength > 0.001
          ? { x: radialX / radialLength, z: radialZ / radialLength }
          : direction;
        this.displaceMob(target.id, mob, {
          x: knockbackDirection.x * definition.knockback, z: knockbackDirection.z * definition.knockback,
        });
        if (mob.health === 0) {
          this.defeatMob(target.id, mob, sessionId, now);
          defeatedMobIds.push(target.id);
          const consumed = consumedMarks.find(mark => mark.mobId === target.id);
          if (consumed) consumed.staggerMs = 0;
        } else {
          const duration = definition.staggerMs + payoff.staggerBonusMs
            + (aftershock ? SEISMIC_CLEAVE_UPGRADES.aftershockStaggerBonusMs : 0);
          const resistedDuration = Math.round(duration * (mob.archetype === "stone_brute" ? 0.65 : 1));
          const staggered = this.staggerMob(target.id, mob, now, resistedDuration);
          const consumed = consumedMarks.find(mark => mark.mobId === target.id);
          if (consumed) consumed.staggerMs = staggered ? resistedDuration : 0;
        }
      }
      const fractures = definition.fracturesTerrain && definition.core === "line"
        ? widenedLineFractureColumns(player, pending.yaw, resolvedRange, seismicProfile?.fractureWidth ?? 1)
            .map(column => this.fractureTerrain(pending.requestId, column.x, column.z, player.y))
            .filter((fracture): fracture is PowerFracture => fracture !== null)
        : [];
      const resolved: PowerResolved = {
        casterId: sessionId,
        powerId: pending.powerId,
        x: impactCenter.x,
        y: impactCenter.y,
        z: impactCenter.z,
        yaw: pending.yaw,
        hitCount: targets.length,
        damage: resolvedDamage,
        defeatedMobIds,
        fractures,
        traitBonusHitCount,
        ...(seismicProfile ? {
          range: resolvedRange,
          width: resolvedWidth,
          aftershockHitCount,
          seismicMastery: pending.seismicMastery ?? "advancing_fault",
        } : {}),
      };
      this.broadcast("power:resolved", resolved);
      for (const consumed of consumedMarks) this.broadcast("special:consumed", consumed);
    }
  }

  private beginMine(client: Client, payload: unknown): void {
    const parsed = MineBlockRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "mine", reason: "payload" });
    const request = parsed.data;
    const player = this.state.players.get(client.sessionId);
    if (!player || player.health <= 0) return;
    if (this.pendingMining.has(client.sessionId) || this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "rate" });
    }
    const address = worldToChunk(request.x, request.z);
    const stored = this.getChunk(address.chunkX, address.chunkZ);
    const block = getBlock(stored.chunk, address.localX, request.y, address.localZ);
    const reason = miningRejectionReason(player, request, block, stored.revision);
    if (reason) return this.reject(client, { requestId: request.requestId, action: "mine", reason });
    const movement = this.movementInputs.get(client.sessionId)?.request;
    if (movement && Math.hypot(movement.strafe, movement.forward) > 0.01) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "moving" });
    if (!miningLineClear(player, request, this.readWorldBlock)) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "collision" });
    const mineral = minedMineral(block);
    if (mineral && (player.inventory.get(mineral)?.quantity ?? 0) >= ironCapacity(player.blacksmithUpgrades)) {
      client.send("resource:gathered", { itemId: mineral, quantity: 0, total: player.inventory.get(mineral)!.quantity } satisfies ResourceGathered);
      return;
    }
    this.pendingMining.set(client.sessionId, { client, request, block, completesAt: Date.now() + miningDurationMs(block), origin: { x: player.x, y: player.y, z: player.z } });
  }

  private resolveMining(now: number): void {
    for (const [id, pending] of this.pendingMining) {
      const player = this.state.players.get(id);
      const { request } = pending;
      const block = this.readWorldBlock(request.x, request.y, request.z);
      const reason = !player || player.health <= 0 || block !== pending.block ? "missing"
        : this.pendingPowers.has(id) ? "rate"
        : miningRejectionReason(player, request, block, request.expectedRevision)
          ?? (Math.hypot(player.x - pending.origin.x, player.z - pending.origin.z) > 0.12 || Math.abs(player.y - pending.origin.y) > 0.2 ? "moving" : null)
          ?? (!miningLineClear(player, request, this.readWorldBlock) ? "collision" : null);
      if (reason) {
        this.pendingMining.delete(id);
        this.reject(pending.client, { requestId: request.requestId, action: "mine", reason });
        continue;
      }
      if (now < pending.completesAt) continue;
      this.pendingMining.delete(id);
      // Revalidate revision, reach, protection and inventory on actual impact.
      this.handleMine(pending.client, request);
    }
  }

  private handleMine(client: Client, payload: unknown): void {
    const parsed = MineBlockRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "mine", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.pendingPowers.has(client.sessionId)) {
      const requestId = typeof payload === "object" && payload && "requestId" in payload && typeof payload.requestId === "string"
        ? payload.requestId
        : undefined;
      return this.reject(client, { requestId, action: "mine", reason: "rate" });
    }
    const request = parsed.data;
    player.attackStep = 0;
    player.actionSequence += 1;
    const address = worldToChunk(request.x, request.z);
    const stored = this.getChunk(address.chunkX, address.chunkZ);
    const current = getBlock(stored.chunk, address.localX, request.y, address.localZ);
    const rejection = miningRejectionReason(player, request, current, stored.revision);
    if (rejection) return this.reject(client, { requestId: request.requestId, action: "mine", reason: rejection });
    if (!miningLineClear(player, request, this.readWorldBlock)) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "collision" });
    const mineral = minedMineral(current);
    if (mineral) {
      const carried = player.inventory.get(mineral)?.quantity ?? 0;
      if (carried >= ironCapacity(player.blacksmithUpgrades)) {
        client.send("resource:gathered", { itemId: mineral, quantity: 0, total: carried } satisfies ResourceGathered);
        return;
      }
    }
    setBlock(stored.chunk, address.localX, request.y, address.localZ, Block.Air);
    stored.revision += 1;
    this.recordWorldDelta(request.x, request.y, request.z, Block.Air);
    const changed: BlockChanged = {
      requestId: request.requestId,
      x: request.x,
      y: request.y,
      z: request.z,
      block: Block.Air,
      revision: stored.revision,
    };
    this.broadcast("block:changed", changed);
    if (mineral) this.broadcast("mineral:status", this.mineralStatus());
    if (mineral) {
      let item = player.inventory.get(mineral);
      if (!item) {
        item = new InventoryItemState();
        player.inventory.set(mineral, item);
      }
      const before = item.quantity;
      item.quantity = Math.min(ironCapacity(player.blacksmithUpgrades), inventoryTotal(before, minedIronQuantity(player.blacksmithUpgrades)));
      void this.persistPlayer(client.sessionId, player);
      client.send("resource:gathered", { itemId: mineral, quantity: item.quantity - before, total: item.quantity } satisfies ResourceGathered);
    } else if (current === Block.OakLog) {
      let item = player.inventory.get("timber");
      if (!item) {
        item = new InventoryItemState();
        player.inventory.set("timber", item);
      }
      item.quantity = inventoryTotal(item.quantity, 1);
      void this.persistPlayer(client.sessionId, player);
      client.send("resource:gathered", { itemId: "timber", quantity: 1, total: item.quantity } satisfies ResourceGathered);
    }
  }

  private handleAttack(client: Client, payload: unknown): void {
    const parsed = AttackRequestSchema.safeParse(payload);
    if (!parsed.success) return this.reject(client, { action: "attack", reason: "payload" });
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.defending = false;
    if (this.pendingPowers.has(client.sessionId)) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: "rate" });
    }
    const now = Date.now();
    const mainHandId = player.mainHandId as MainHandId;
    const attackDefinition = WEAPON_ATTACK_DEFINITIONS[mainHandId];
    if (!attackDefinition) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: "missing" });
    }
    const chain = this.attackChains.get(client.sessionId);
    if (chain && now < chain.recoveryUntil) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "attack", reason: "rate" });
    }
    const step = attackDefinition.combo && chain?.mainHandId === mainHandId
      ? nextComboStep(chain.step, chain.comboExpiresAt, now)
      : 1;
    const timing = attackDefinition.attacks[step - 1] ?? attackDefinition.attacks[0];
    if (!timing) return;
    this.attackChains.set(client.sessionId, {
      step,
      mainHandId,
      recoveryUntil: now + timing.durationMs,
      comboExpiresAt: now + timing.durationMs + attackDefinition.comboWindowMs,
    });
    this.pendingAttacks.set(client.sessionId, {
      requestId: parsed.data.requestId,
      mainHandId,
      yaw: parsed.data.yaw,
      step,
      impactAt: now + timing.impactMs,
    });
    player.yaw = parsed.data.yaw;
    player.attackStep = step;
    player.actionSequence += 1;
  }

  private clearMobAttackTimeline(mob: MobState): void {
    mob.attackStartedAt = mob.attackReleaseAt = mob.attackContactAt = mob.attackContactEndAt = mob.attackRecoveryEndAt = 0;
  }

  private updateMobStrikeOrigin(mobId: string, mob: MobState): void {
    if (mob.isChampion && mob.archetype === "cave_spitter") {
      if (mob.aimCommitted) return;
      const aim = this.mobCommittedAim.get(mobId);
      mob.attackStrikeX = mob.attackPattern === "pool" ? aim?.x ?? mob.x : mob.x;
      mob.attackStrikeY = mob.attackPattern === "pool" ? aim?.y ?? mob.y : mob.y;
      mob.attackStrikeZ = mob.attackPattern === "pool" ? aim?.z ?? mob.z : mob.z;
      return;
    }
    if (mob.isChampion && mob.attackPattern === "charge") {
      if (mob.aimCommitted) return;
      mob.attackStrikeX = mob.x; mob.attackStrikeY = mob.y; mob.attackStrikeZ = mob.z;
      return;
    }
    if (crawlerRushDistance(mob.archetype) > 0) {
      if (mob.aimCommitted) return;
      mob.attackStrikeX = mob.x; mob.attackStrikeY = mob.y; mob.attackStrikeZ = mob.z;
      return;
    }
    if (mob.archetype === "stone_brute") {
      // Once committed, neither player movement nor late snapshots move the impact circle.
      if (mob.aimCommitted) return;
      const center = mob.attackPattern === "smash" ? mob : bruteSlamCenter(mob, mob.yaw);
      mob.attackStrikeX = center.x; mob.attackStrikeY = center.y; mob.attackStrikeZ = center.z;
      return;
    }
    const aim = this.mobCommittedAim.get(mobId);
    const definition = mobArchetype(mob.archetype);
    const distance = aim ? Math.hypot(aim.x - mob.x, aim.z - mob.z) : 0;
    const lunge = definition.attackKind === "melee" ? Math.min(definition.lungeDistance, Math.max(0, distance - definition.stopDistance * 0.6)) : 0;
    const yaw = aim?.yaw ?? mob.yaw;
    const origin = moveMobSafely(mob, { x: Math.sin(yaw * Math.PI / 180) * lunge,
      z: Math.cos(yaw * Math.PI / 180) * lunge }, this.readWorldBlock, pose => this.mobPositionAllowed(pose) && caveEncounterAllows(mobId, pose));
    mob.attackStrikeX = origin.x; mob.attackStrikeY = origin.y; mob.attackStrikeZ = origin.z;
  }

  private setMobAttackTimeline(mob: MobState, startedAt: number, releaseAt: number, mobId = ""): void {
    const definition = combatMobDefinition(mob);
    mob.attackStartedAt = startedAt;
    mob.attackReleaseAt = releaseAt;
    if (mobId === WILDERNESS_EVENT_ID && mob.attackPattern === "double-fan") {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt + MATRIARCH_PHASE.volleyGapMs;
      mob.attackRecoveryEndAt = mob.attackContactEndAt + MATRIARCH_PHASE.recoveryMs;
      return;
    }
    if (mob.isChampion && mob.attackPattern === "charge") {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt + CHAMPION_CHARGE.durationMs;
      mob.attackRecoveryEndAt = mob.attackContactEndAt + CHAMPION_CHARGE.recoveryMs;
      return;
    }
    if (mobId === "frontier-brute") {
      const timing = FRONTIER_BRUTE[mob.attackPattern === "smash" ? "smash" : "slam"];
      mob.attackContactAt = releaseAt + timing.impactMs;
      mob.attackContactEndAt = mob.attackContactAt + 100;
      mob.attackRecoveryEndAt = mob.attackContactEndAt + timing.recoveryMs;
      return;
    }
    mob.attackContactAt = releaseAt + (definition.attackKind === "melee" ? mobMeleeImpactMs(mob.archetype) : 0);
    mob.attackContactEndAt = mob.attackContactAt + (definition.attackKind === "melee" ? mobMeleeStrike(mob.archetype).afterImpactMs : 0);
    mob.attackRecoveryEndAt = mob.attackContactEndAt + definition.recoverMs;
  }

  private advanceChampionCharges(now: number): void {
    for (const [id, charge] of this.championCharges) {
      const mob = this.state.mobs.get(id);
      if (!mob?.alive || mob.combatState !== "strike") { this.championCharges.delete(id); continue; }
      const progress = Math.max(charge.progress, Math.min(1, Math.max(0, (now - charge.startedAt) / CHAMPION_CHARGE.durationMs)));
      const travel = CHAMPION_CHARGE.distance * (progress - charge.progress);
      const start = { x: mob.x, y: mob.y, z: mob.z };
      const next = moveChampionCharge(start, charge.yaw, travel, this.readWorldBlock,
        pose => this.mobPositionAllowed(pose) && this.championAllowed(id, pose) && !isInStoneBruteArena(pose.x, pose.z));
      mob.x = next.x; mob.y = next.y; mob.z = next.z; mob.yaw = charge.yaw;
      for (const [playerId, player] of this.state.players) {
        if (charge.hit.has(playerId) || player.health <= 0 || Math.abs(player.y - mob.y) > 1.1
          || !hasCombatLineOfSight(start, player, this.readWorldBlock)) continue;
        if (championChargeHits(start, next, player)) { charge.hit.add(playerId); this.damagePlayer(id, playerId, mob.attackDamage, now); }
        if (mob.combatState !== "strike") break;
      }
      charge.progress = progress;
      if (progress >= 1 || Math.hypot(next.x - start.x, next.z - start.z) < travel * .8) this.championCharges.delete(id);
    }
  }

  private advanceCrawlerRushes(now: number): void {
    for (const [mobId, rush] of this.crawlerRushes) {
      const mob = this.state.mobs.get(mobId);
      if (!mob?.alive || mob.combatState !== "strike") { this.crawlerRushes.delete(mobId); continue; }
      const progress = Math.max(rush.progress, Math.min(1, Math.max(0, (now - rush.startedAt) / CRAWLER_RUSH_MS)));
      const travel = rush.distance * (progress - rush.progress);
      const radians = rush.yaw * Math.PI / 180;
      const next = moveMobSafely(mob, { x: Math.sin(radians) * travel, z: Math.cos(radians) * travel }, this.readWorldBlock,
        pose => this.mobPositionAllowed(pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && !isInStoneBruteArena(pose.x, pose.z)
          && isPlayerSupported(this.readWorldBlock, pose.x, pose.y, pose.z));
      const moved = Math.hypot(next.x - mob.x, next.z - mob.z);
      mob.x = next.x; mob.y = next.y; mob.z = next.z; mob.yaw = rush.yaw;
      rush.progress = progress;
      if (progress >= 1 || moved < travel * .8) this.crawlerRushes.delete(mobId);
    }
  }

  private resolveMobMelee(now: number): void {
    for (const [mobId, pending] of this.pendingMobMelee) {
      const mob = this.state.mobs.get(mobId);
      const player = this.state.players.get(pending.targetId);
      if (!mob?.alive || mob.combatState !== "strike") { this.pendingMobMelee.delete(mobId); continue; }
      if (mob.archetype === "stone_brute") {
        if (now < pending.impactAt) continue;
        this.pendingMobMelee.delete(mobId); // One impact, not damage on every contact frame.
        const center = { x: mob.attackStrikeX, y: mob.attackStrikeY, z: mob.attackStrikeZ };
        for (const [id, target] of this.state.players) {
          if (target.health <= 0 || !caveEncounterAllows(mobId, target)
            || (mob.attackPattern === "smash" ? !bruteSmashHits(center, pending.yaw, target)
              : Math.abs(target.y - center.y) > BRUTE_SLAM.verticalRange || Math.hypot(target.x - center.x, target.z - center.z) > BRUTE_SLAM.radius)
            || !hasCombatLineOfSight(mob, target, this.readWorldBlock)
            || !hasCombatLineOfSight(center, target, this.readWorldBlock)) continue;
          this.damagePlayer(mobId, id, mob.attackDamage, now);
        }
        continue;
      }
      if (!player) { this.pendingMobMelee.delete(mobId); continue; }
      const strike = mobMeleeStrike(mob.archetype);
      const start = pending.impactAt - strike.beforeImpactMs;
      const end = pending.impactAt + strike.afterImpactMs;
      if (now < start) continue;
      const hit = meleeSweepImpact(mob, pending.yaw, strike,
        (Math.max(start, pending.lastSweepAt ?? start) - start) / (end - start),
        (Math.min(now, end) - start) / (end - start), [{ id: pending.targetId, x: player.x, y: player.y, z: player.z }], this.readWorldBlock);
      pending.lastSweepAt = Math.min(now, end);
      if (hit || now >= end) this.pendingMobMelee.delete(mobId);
      if (hit) this.damagePlayer(mobId, hit, mob.attackDamage, now);
    }
  }

  private resolvePendingAttacks(now: number): void {
    for (const [sessionId, pending] of this.pendingAttacks) {
      const strike = playerMeleeStrike(pending.mainHandId, pending.step);
      if (strike) {
        const start = pending.impactAt - strike.beforeImpactMs;
        const end = pending.impactAt + strike.afterImpactMs;
        if (now < start) continue;
        const player = this.state.players.get(sessionId);
        if (!player) { this.pendingAttacks.delete(sessionId); continue; }
        const targets = [...this.state.mobs.entries()].filter(([, mob]) => mob.alive)
          .map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, radius: mob.archetype === "stone_brute" ? 0.55 : 0.38 }));
        const hit = meleeSweepImpact(player, pending.yaw, strike,
          (Math.max(start, pending.lastSweepAt ?? start) - start) / (end - start),
          (Math.min(now, end) - start) / (end - start), targets, this.readWorldBlock);
        pending.lastSweepAt = Math.min(now, end);
        if (hit) {
          this.pendingAttacks.delete(sessionId);
          this.applyWeaponHit(sessionId, pending, hit, now);
        } else if (now >= end) {
          this.pendingAttacks.delete(sessionId);
          this.broadcast("combat:miss", { attackerId: sessionId, mainHandId: pending.mainHandId, comboStep: pending.step } satisfies CombatMiss);
        }
        continue;
      }
      if (now < pending.impactAt) continue;
      this.pendingAttacks.delete(sessionId);
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const attackDefinition = WEAPON_ATTACK_DEFINITIONS[pending.mainHandId];
      const timing = attackDefinition.attacks[pending.step - 1] ?? attackDefinition.attacks[0];
      if (!timing) continue;
      const targets = [...this.state.mobs.entries()].map(([id, mob]) => ({
        id,
        x: mob.x,
        y: mob.y,
        z: mob.z,
        alive: mob.alive,
      }));
      const target = selectAttackTarget(
        player,
        pending.yaw,
        attackDefinition.projectileTravelMs > 0 ? targets : targets.filter(target => hasCombatLineOfSight(player, target, this.readWorldBlock)),
        attackDefinition.range,
        attackDefinition.minimumFacingDot,
      );
      if (attackDefinition.projectileTravelMs > 0) {
        const radians = pending.yaw * Math.PI / 180;
        const endpoint = target ?? {
          x: player.x + Math.sin(radians) * attackDefinition.range,
          y: player.y,
          z: player.z + Math.cos(radians) * attackDefinition.range,
        };
        const projectileId = `weapon:${sessionId}:${++this.weaponProjectileSequence}`;
        const start = { x: player.x, y: player.y + 1.05, z: player.z };
        const end = bodyPoint(endpoint);
        this.pendingWeaponProjectiles.set(projectileId, {
          ...pending, projectileId, attackerId: sessionId,
          start, end, position: start, startedAt: now, impactAt: now + attackDefinition.projectileTravelMs,
        });
        this.broadcast("combat:projectile", {
          projectileId,
          attackerId: sessionId,
          mainHandId: pending.mainHandId,
          x: player.x,
          y: player.y,
          z: player.z,
          targetX: endpoint.x,
          targetY: endpoint.y,
          targetZ: endpoint.z,
          travelMs: attackDefinition.projectileTravelMs,
        } satisfies WeaponAttackReleased);
        continue;
      }
      if (!target) {
        const miss: CombatMiss = { attackerId: sessionId, mainHandId: pending.mainHandId, comboStep: pending.step };
        this.broadcast("combat:miss", miss);
        continue;
      }
      this.applyWeaponHit(sessionId, pending, target.id, now);
    }
  }

  private resolveWeaponProjectiles(now: number): void {
    for (const [projectileId, projectile] of this.pendingWeaponProjectiles) {
      if (!this.state.players.has(projectile.attackerId)) {
        this.pendingWeaponProjectiles.delete(projectileId);
        this.resolveProjectileVisual(projectileId, projectile.position, "miss");
        continue;
      }
      const progress = Math.max(0, Math.min(1, (now - projectile.startedAt) / (projectile.impactAt - projectile.startedAt)));
      const next = flightPoint(projectile.start, projectile.end, progress);
      const targets = [...this.state.mobs.entries()].filter(([, mob]) => mob.alive)
        .map(([id, mob]) => ({ id, x: mob.x, y: mob.y, z: mob.z, radius: mob.archetype === "stone_brute" ? 0.55 : 0.38 }));
      const collision = projectileImpact(projectile.position, next, targets, this.readWorldBlock);
      projectile.position = next;
      if (!collision && progress < 1) continue;
      this.pendingWeaponProjectiles.delete(projectileId);
      const point = collision?.point ?? next;
      this.resolveProjectileVisual(projectileId, point, collision?.kind === "terrain" ? "terrain" : collision ? "hit" : "miss");
      if (collision?.kind === "entity" && collision.targetId) {
        this.applyWeaponHit(projectile.attackerId, projectile, collision.targetId, now, projectile.start);
      } else this.broadcast("combat:miss", {
        attackerId: projectile.attackerId, mainHandId: projectile.mainHandId, comboStep: projectile.step,
      } satisfies CombatMiss);
    }
  }

  private alertHitMob(mobId: string, sessionId: string, now: number): void {
    const player = this.state.players.get(sessionId);
    if (!player || player.health <= 0 || isInsideTownSafeZone(player)) return;
    const awareness = this.mobAwareness.get(mobId) ?? createMobAwareness();
    provokeMob(awareness, { id: sessionId, x: player.x, y: player.y, z: player.z, health: player.health }, now);
    this.mobAwareness.set(mobId, awareness);
    const mob = this.state.mobs.get(mobId);
    if (mob) { mob.alertUntil = now + 900; mob.awarenessState = "engaged"; }
    this.mobUnreachableUntil.delete(mobId); this.mobReturning.delete(mobId);
    this.roamingReturning.delete(mobId);
    if (!mob || now - (this.mobAssistAt.get(mobId) ?? -Infinity) < MOB_ASSIST_COOLDOWN_MS) return;
    this.mobAssistAt.set(mobId, now);
    const victimPack = roamingMembership(mobId);
    const helpers = mobAssistants(mobId, mob, [...this.state.mobs.entries()].map(([id, peer]) => ({
      id, x: peer.x, y: peer.y, z: peer.z, alive: peer.alive, health: peer.health,
      available: peer.combatState === "idle" && !peer.isChampion && !this.mobAwareness.get(id)?.targetId
        && !this.mobReturning.has(id) && !this.roamingReturning.has(id) && now >= (this.mobUnreachableUntil.get(id) ?? 0),
    })), peer => {
      const pack = roamingMembership(peer.id);
      return (!pack || pack.pack.id === victimPack?.pack.id)
        && Math.abs(peer.y - player.y) <= 1.75 && Math.hypot(peer.x - player.x, peer.z - player.z) <= 12
        && caveEncounterAllows(peer.id, player) && caveEncounterAllows(peer.id, mob) && caveEncounterAllows(mobId, peer)
        && this.championAllowed(peer.id, player)
        && (peer.id === "stone-brute" || !isInStoneBruteArena(player.x, player.z))
        && (peer.id !== "stone-brute" || isInStoneBruteArena(mob.x, mob.z))
        && hasCombatLineOfSight(peer, mob, this.readWorldBlock) && hasCombatLineOfSight(peer, player, this.readWorldBlock);
    });
    for (const helper of helpers) {
      const state = this.mobAwareness.get(helper.id) ?? createMobAwareness();
      provokeMob(state, { id: sessionId, x: player.x, y: player.y, z: player.z, health: player.health }, now);
      this.mobAwareness.set(helper.id, state);
      const ally = this.state.mobs.get(helper.id)!;
      ally.alertUntil = now + 900; ally.awarenessState = "engaged";
      // Do not call alertHitMob here: assists must not propagate to another group.
    }
  }

  private applyWeaponHit(sessionId: string, pending: PendingAttack, mobId: string, now: number,
    source?: { x: number; z: number }): void {
      const player = this.state.players.get(sessionId);
      const mob = this.state.mobs.get(mobId);
      const timing = WEAPON_ATTACK_DEFINITIONS[pending.mainHandId].attacks[pending.step - 1]
        ?? WEAPON_ATTACK_DEFINITIONS[pending.mainHandId].attacks[0];
      if (!player || player.health <= 0 || !mob || !mob.alive || !timing) return;
      const traitBonusDamage = executionerDamageBonus(player.equippedTrait as TraitId, mob, { comboStep: pending.step });
      const damage = damageAfterArmor(
        timing.damage + ironSwordDamageBonus(player.blacksmithUpgrades, pending.mainHandId) + this.specialDamageBonus(sessionId, mobId, now),
        mob.armor,
      ) + traitBonusDamage;
      this.combatContributions.record(mobId, sessionId, Math.min(mob.health, damage), now);
      mob.health = Math.max(0, mob.health - damage);
      this.alertHitMob(mobId, sessionId, now);
      mob.hitSequence += 1;
      player.momentumStacks = gainMomentum(player.momentumStacks, player.equippedTrait as TraitId);
      const staggerDuration = basicStaggerDuration(pending.mainHandId, pending.step, mob.archetype, mob.combatState);
      if (this.staggerMob(mobId, mob, now, staggerDuration)) {
        const stagger: CombatStagger = { attackerId: sessionId, mobId, durationMs: staggerDuration };
        this.broadcast("combat:stagger", stagger);
      }
      const deltaX = mob.x - (source?.x ?? player.x);
      const deltaZ = mob.z - (source?.z ?? player.z);
      const distance = Math.hypot(deltaX, deltaZ);
      if (distance > 0.001 && timing.knockback > 0) {
        this.displaceMob(mobId, mob, {
          x: deltaX / distance * timing.knockback, z: deltaZ / distance * timing.knockback,
        });
      }
      if (mob.health === 0) {
        this.defeatMob(mobId, mob, sessionId, now);
      }
      const hit: CombatHit = {
        attackerId: sessionId,
        mainHandId: pending.mainHandId,
        mobId,
        damage,
        health: mob.health,
        defeated: !mob.alive,
        comboStep: pending.step,
        knockback: timing.knockback,
        momentumStacks: player.momentumStacks,
        traitBonusDamage,
      };
      this.broadcast("combat:hit", hit);
      if (mob.alive) this.progressSpecialMark(sessionId, mobId, now);
  }
}
