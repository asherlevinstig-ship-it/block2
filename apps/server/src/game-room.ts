import { Client, Room } from "@colyseus/core";
import { GREENWOOD_MASTERY_CAP, MISTFEN_MASTERY_CAP, greenwoodMasteryRank, mistfenMasteryRank } from "@blockcraft/protocol";
import type { SchemaType } from "@colyseus/schema";
import { ShadowMoveInput, stepShadowMovement, type ShadowPose } from "./movement-shadow.js";
import { randomUUID } from "node:crypto";
import { ADMIN_BOOTSTRAP_HASH, ADMIN_PROFILE_HASH, adminProfileKey, matchesAdminBootstrapPass } from "./admin-access.js";
import { AttackCoordination, allyFireLaneClear } from "./attack-coordination.js";
import { MIXED_FRONTIER_SPITTER, isMixedFrontierMob, mixedFrontierAllows, isSilverGuard, silverGuardAllows, frontierBruteAllows, isGreenwoodCampMob, greenwoodCampAllows, isAshenSentry, ashenSentryAllows, ashenSentryPattern, isMistfenMob, mistfenAllows, isSouthernQuarryMob, southernQuarryAllows } from "./wilderness-encounters.js";
import { BRUTE_VOLLEY, bruteVolleyReady, bruteRockEndpoints } from "@blockcraft/protocol";
import { CHAMPION_CHARGE, ChatSendSchema, PlayerNameSchema, AppearanceSchema, type NearbyChatMessage } from "@blockcraft/protocol";
import { cleanChatText, hearsNearbyChat } from "./nearby-chat.js";
import { PartyRequestSchema } from "@blockcraft/protocol";
import { Parties } from "./parties.js";
import { TradeRequestSchema } from "@blockcraft/protocol";
import { Trading } from "./trading.js";
import { BLACKSMITH_STOCK, BLACKSMITH_DISMANTLE, BLACKSMITH_REFORGE, REGIONAL_FORGE_RECIPES, BlacksmithBuySchema, BlacksmithDismantleSchema, BlacksmithReforgeSchema, RegionalForgeSchema, AttunementForgeSchema, ITEM_DEFINITIONS, EQUIPMENT_AFFIXES, HUNT_EQUIPMENT_SETS, BUILD_PATHS, BUILD_PATH_SPECIALIZATIONS, CALLING_ABILITY_OPTIONS, CALLING_ABILITY_AUGMENTS, CALLING_AUGMENT_TRIALS, CallingAbilityRequestSchema, CallingAbilityEquipRequestSchema, CallingAugmentEquipRequestSchema, HuntCollectionRequestSchema, BuildPathRequestSchema, ArmourEquipSchema, armourStats, armouredDamage, reforgeWeaponDamageBonus, equipmentPerkStats, equipmentAffixResonanceForLoadout, type EquipmentPerkId, type BlacksmithDismantleItemId, type BlacksmithReforgeItemId, type RegionalForgeId, type HuntCollectionUpdate, type HuntLoadoutSlot, type BuildPathId, type BuildPathUpdate, type BuildPathProc, type BuildPathSpecializationId, type CallingAbilityId, type CallingAugmentId, type CallingAbilityUpdate, type CallingAbilityEffect, type CallingStateUpdate, type EquipmentAffixId, type EquipmentAffixRoll, type EquipmentAffixOffers, type EquipmentAffixUpdate } from "@blockcraft/protocol";
import { AREA_LEADER_RELIC_IDS, LEADER_FORGE_MARKS, LEADER_FORGE_RECIPES, LeaderForgeSchema,
  type AreaLeaderRelicId, type LeaderForgemarkId } from "@blockcraft/protocol";
import { weaponPurchase } from "./blacksmith.js";
import { awareMobTarget, createMobAwareness, provokeMob, type MobAwareness } from "./mob-awareness.js";
import { spacedMobDesired, mobPersonalSpace } from "./mob-spacing.js";
import { turnBruteAim } from "./brute-aim.js";
import { meleeSlotsFull, meleeWaitingGoal } from "./melee-coordination.js";
import { checkMobProgress, type MobProgress } from "./mob-progress.js";
import { mobAssistants, MOB_ASSIST_COOLDOWN_MS } from "./mob-assist.js";
import { circleCrawler, createCrawlerPositioning, retreatCrawler, type CrawlerPositioning } from "./crawler-positioning.js";
import { FRONTIER_CHAMPION_ID, SILVER_CHAMPION_ID, championPattern, spitterChampionShots, combatMobDefinition, moveChampionCharge, championChargeHits } from "./frontier-champion.js";
import { WILDERNESS_EVENT_ID } from "./wilderness-event.js";
import { RealmEventDirector, REALM_BOSS_TRACKING_RADIUS, REALM_EVENT_TRACKING_RADIUS, REALM_EVENT_SCALING_RADIUS, isRealmEventId, realmEventDefinition, realmEventScale } from "./realm-event-director.js";
import { GREENWOOD_EVENT_TRACKING_RADIUS, greenwoodEventDefinition, greenwoodEventFollowers,
  greenwoodEventScale, isGreenwoodEventFollower, type GreenwoodEventKind } from "./greenwood-events.js";
import { MISTFEN_EVENT_ID, MISTFEN_EVENT_TRACKING_RADIUS, mistfenEventDefinition, mistfenEventFollowers,
  mistfenEventPattern, mistfenEventScale, isMistfenEventFollower, type MistfenEventKind } from "./mistfen-events.js";
import { ASHGLASS_ORACLE_ID, GREENWOOD_MATRIARCH_ID, REALM_WARDEN_ID,
  fallingRockSites, isRealmSpitterBoss, realmBossPattern, realmBossPhase, usesDoubleVolley, usesFallingRockZones, usesRockVolley, type RealmBossPhase } from "./realm-boss-patterns.js";
import type { RealmEventUpdate } from "@blockcraft/protocol";
import { equipmentForItem, armourForItem, isEquipmentItem, EQUIPMENT_LOOT_RANGE, LootCollectRequestSchema,
  decodeLootBagItems, encodeLootBagItems, lootBagRepresentative, normalizeLootBagItems, huntSetForLoadout,
  type HuntSetId, type LootBagItem, type LootCollectResult } from "@blockcraft/protocol";
import { WILDERNESS_ENCOUNTERS } from "./wilderness-encounters.js";
import { ROAMING_PACKS, roamingMemberId, roamingMembership, roamingPackAllows, roamingGoal,
  createRoamingRouteState, advanceRoamingRoute, type RoamingRouteState } from "./roaming-packs.js";
import { WILDERNESS_MATERIALIZE_MS, WILDERNESS_RESPAWN_RECHECK_MS,
  usesOverworldRespawnRhythm, wildernessRespawnDelay, wildernessSpawnClear } from "./wilderness-respawn.js";
import { shouldBecomeWildernessElite, wildernessEliteKind,
  wildernessEliteName, wildernessElitePattern, wildernessEliteStats } from "./wilderness-elites.js";
import { AREA_LEADER_FOLLOWERS, AREA_MAIN_MOBS, areaLeaderPattern, areaLeaderPhase, areaMainMobDefinition, areaMiniBossDefinition, isAreaMiniBoss, leaderForFollower, type AreaLeaderPhase } from "./area-mini-bosses.js";
import { MINI_BOSS_ENRAGE_MS, miniBossDamage, miniBossOrbitCounterPattern, miniBossWindupDelay, predictedMiniBossAim, updateOrbitPressure, type OrbitPressureState } from "./mini-boss-pressure.js";
import { miniBossCoverSites, miniBossPressureSites } from "./mini-boss-arena.js";
import { leaderRematch, leaderRematchMaterialBonus, leaderRematchPattern, leaderRematchPressureCadence,
  leaderRematchStats, leaderRematchTiming, leaderTerritory } from "./leader-rematches.js";
import { RealmHuntBoardRequestSchema, type RealmHuntBoardUpdate, type RealmHuntContractStatus, type RealmHuntStatus } from "@blockcraft/protocol";
import { HUNT_PATHS, advanceHuntContract, beginHuntContract, huntContractTier, isHuntPathId,
  type HuntContractState, type HuntPathId } from "./hunt-contracts.js";
import { completeHuntMastery, huntDifficultyRewardMultiplier, huntDifficultyStatTier, huntEquipmentRewards, HUNT_PATH_EQUIPMENT,
  huntDifficultyTiming, huntDifficultyUnlocked, parseHuntMastery, serializeHuntMastery,
  type HuntDifficulty } from "./hunt-mastery.js";
import { huntChampionPattern, huntChampionPhase, huntChampionPincerSites, huntChampionRushMultiplier,
  huntChampionUsesSecondVolley, huntChampionVenomHazard } from "./hunt-champion-combat.js";
import { DODGE_EXHAUSTION_MS, PERFECT_DODGE_COUNTER_MS, PERFECT_DODGE_STAMINA_RESTORE,
  dodgeChainStaminaCost, nextDodgeChain, type DodgePressureUpdate } from "@blockcraft/protocol";
import { BRUTE_SLAM, bruteSlamCenter, FRONTIER_BRUTE, frontierBrutePattern, bruteSmashHits, CRAWLER_RUSH_MS, crawlerRushDistance } from "@blockcraft/protocol";
import { createSpitterPositioning, positionSpitter, type SpitterPositioning } from "./spitter-positioning.js";
import { HEALING_POTION, lootCarryCapacity, type PotionUpdate } from "@blockcraft/protocol";
import { canBuyPotionAtKeeper, potionBuyError, potionUseError } from "./healing-potions.js";
import { MINERAL_REGROWTH_MS, type MineralDepositStatus } from "@blockcraft/protocol";
import { RENEWABLE_MINERAL_DEPOSITS, authoredMineralAt, SURFACE_HEIGHT, CAVE_SHALLOW_HOME, CAVE_DEEP_HOME, CAVE_HIDDEN_HOME, SILVER_DEPTHS_SPITTER_HOMES, CRYSTAL_MATRIARCH_HOME, SILVER_DEPTHS_COVER, SILVER_DEPTHS_MOONSTONE_SEAL_POSITION, SILVER_DEPTHS_CHECKPOINT_POSITION, SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_BOSS_GATE, SILVER_DEPTHS_IRON_GATE, SILVER_DEPTHS_SILVER_GATE, SILVER_DEPTHS_WING_CACHES, silverDepthsPingLocation, isMistfenToxicPool, isInMistfenMarsh } from "@blockcraft/voxel-world";
import { ROLE_FIELD_OPPORTUNITIES, nearestRoleFieldOpportunity } from "@blockcraft/voxel-world";
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
  SILVER_DEPTHS_REWARDS,
  SilverDepthsRewardBuySchema,
  ChunkRegionRequestSchema,
  IRON_ORE_GOLD_PRICE,
  BRAMBLE_SNARE,
  DodgeRequestSchema,
  DefenseRequestSchema,
  HUNTERS_MARK,
  SPECIAL_DEFINITIONS,
  MAIN_HAND_DEFINITIONS,
  MainHandEquipRequestSchema,
  MineBlockRequestSchema,
  MoveRequestSchema,
  POWER_DEFINITIONS,
  PlayerProfileTokenSchema,
  ProgressionChooseSchema,
  WEAPON_ATTACK_DEFINITIONS,
  PowerCancelRequestSchema,
  PowerEquipRequestSchema,
  PowerRequestSchema,
  blacksmithRequiredLevel,
  milestoneUnlocked,
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
  type SilverDepthsRewardId,
  type SilverDepthsWingRewardStatus,
  type SilverDepthsCacheStatus,
  type SilverDepthsCheckpointStatus,
  type SilverDepthsPartyStatus,
  type SilverDepthsGateStatus,
  SilverDepthsPingRequestSchema,
  type SilverDepthsPing,
  type BlockChanged,
  type BrambleSnarePlaced,
  type BrambleSnareTriggered,
  type ChunkSnapshot,
  type CombatHit,
  type CombatMiss,
  type CombatReward,
  type CombatStagger,
  type DefenseResolved,
  type DepthsRouteHazard,
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
  type ProgressionUpdate,
  type DungeonRunUpdate,
  type DungeonRewardClaimed,
  DungeonBoardRequestSchema,
  type DungeonBoardUpdate,
  DungeonLobbyRequestSchema,
  type DungeonLobbyUpdate,
  type SilverDepthsLobbyUpdate,
  type SeismicMasteryId,
  type SpecialApplied,
  type SpecialConsumed,
  type SpecialProgressed,
  type TraitId,
  type WorldBootstrap,
  type AreaLeaderExposed,
  type WorldObjectiveCompleted,
  type WorldObjectiveUpdate,
  type WeaponAttackReleased,
  type ItemId,
  type IncomingDamageKind,
  type LootPickedUp,
  type ResourceGathered,
  type TavernQuizUpdate,
  SILVER_DEPTHS_ROOM,
  SilverDepthsRouteRequestSchema,
  type SilverDepthsWing,
  WORLD_ROOM,
  type RoomTransfer,
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
import { inventoryTotal, isLootInPickupRange, lootForArchetype, armourDropForMob, LOOT_DESPAWN_MS, NormalLootCadence } from "./loot-rules.js";
import { findLootLanding } from "./loot-placement.js";
import { canEquipMainHand } from "./equipment-rules.js";
import { PLAYER_SAVE_HASH, applyPlayerSave, parsePlayerSave, serializePlayerSave } from "./player-save.js";
import { buildPathAffinities, buildPathRank, chooseBuildPath, chooseBuildSpecialization, chooseCallingAbility, chooseCallingAugment, effectiveBuildPathRank, grantBuildPathXp, grantCallingAugmentProgress, grantMasterTrialProgress, nextBuildRankXp, parseBuildPathState, selectedCallingAbility, selectedCallingAugment } from "./build-paths.js";
import { equipmentReforgeRank, parseReforgeRanks, withReforgeRank } from "./equipment-reforge.js";
import { attunementDustCost, attunementDustYield, keepBetterAffix, parseEquipmentAffixes, parseEquipmentAffixOffers,
  rollEquipmentAffix, rollEquipmentAffixOptions } from "./equipment-affixes.js";
import { parseSignaturePity, resolveSignatureDrop, serializeSignaturePity, signatureLootHint, type SignatureItemId } from "./signature-loot.js";
import { canUseStorage, transferStoredItem } from "./personal-storage.js";
import { leaveRecoveryBag, collectRecoveryBag } from "./death-recovery.js";
import { spitterPattern, spitterShotEndpoints } from "@blockcraft/protocol";
import { MATRIARCH_PHASE, matriarchEnraged, matriarchPattern, crystalMatriarchPattern, matriarchSecondVolleyYaw } from "@blockcraft/protocol";
import { CombatContributions } from "./combat-contributions.js";
import { SilverGuardVolley } from "./silver-guard-volley.js";
import { ForestPortalCycle } from "./forest-portal-cycle.js";
import { FOREST_PORTAL_LIFETIME_MS, canUseForestPortal } from "@blockcraft/protocol";
import { FOREST_PORTAL_POSITION, FOREST_DUNGEON_ENTRY, FOREST_DUNGEON_EXIT, FOREST_DUNGEON_MOBS, FOREST_DUNGEON_COVER, TOWN_EXPEDITION_BOARD_POSITION, TOWN_EXPEDITION_PORTAL_POSITION, TOWN_SILVER_DEPTHS_PORTAL_POSITION, SILVER_DEPTHS_ENTRY_POSITION, SILVER_DEPTHS_PARTY_SPAWNS, SILVER_DEPTHS_EXIT_POSITION, isInForestDungeon, EMBER_VAULT_PORTAL_POSITION, EMBER_VAULT_ENTRY, EMBER_VAULT_EXIT, EMBER_VAULT_MOBS, isInEmberVault } from "@blockcraft/voxel-world";
import { ForestPortalState } from "./schema.js";
import { ROOT_LANE_DURATION_MS, ROOT_LANE_RADIUS, guardianCoverHit, rootLaneHazards } from "./root-guardian.js";
import { canStartTavernQuiz, doubledPayout, drawQuizQuestion, mustSettleQuiz, type QuizRound } from "./tavern-quiz.js";
import { blacksmithNextStep, buyDepthsReward, canTradeAtBlacksmith, forgeBlacksmithUpgrade, ironCapacity, mineralSale, ironSwordDamageBonus, minedIronQuantity, minedMineral, ownedBlacksmithUpgrades, ownedDepthsRewards, ownsBlacksmithUpgrade, ownsDepthsReward } from "./blacksmith.js";
import { GREENWOOD_CRAWLER_HOMES, REALM_WARDEN_GATE_POSITION, REALM_WARDEN_HOME, STONE_BRUTE_ARENA_HOME, isInGreenwoodRegion, isInRealmWardenArena, isInStoneBruteArena } from "@blockcraft/voxel-world";
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
import { advanceMiningExpedition, isBuriedVaultSeal, isInsideEastMine, type MiningExpeditionEvent } from "./mining-expedition.js";
import { advanceSilverDepths, canEnterSilverDepths, canExitSilverDepths, isInsideSilverDepths, SILVER_DEPTHS_GUARDS, CRYSTAL_MATRIARCH_ID, type SilverDepthsEvent } from "./silver-depths-expedition.js";
import { SILVER_DEPTHS_ANTECHAMBER_IDS, SILVER_DEPTHS_CACHE_GUARDS, SILVER_DEPTHS_CACHE_GUARD_IDS, SILVER_DEPTHS_ENCOUNTERS, SILVER_DEPTHS_ENEMY_IDS, SILVER_DEPTHS_GALLERY_IDS, silverDepthsScaledStats, silverDepthsStageSpawns, type SilverDepthsEncounterStage } from "./silver-depths-encounters.js";
import { silverDepthsMoonstoneReward, silverDepthsRank } from "./silver-depths-results.js";
import { advanceMobGravity, createMobNavigationState, moveMobSafely, navigateMob, walkableMobSpawn, type MobNavigationState } from "./mob-navigation.js";
import { MOB_PATROL_RADIUS, patrolDestination, type MobPatrolState } from "./mob-patrol.js";
import { STAGGER_IMMUNITY_MS, basicStaggerDuration, bodyPoint, flightPoint, hasCombatLineOfSight, projectileImpact, meleeSweepImpact } from "./combat-impact.js";
import { FOREST_CACHE_DUPLICATE_GOLD, forestCacheFeaturedReward, forestCacheRewardLabel } from "./forest-dungeon-rewards.js";
import { chooseCharacterStat, grantCharacterExperience, mobExperience, progressionAttackBonus, progressionMiningBonus, progressionSnapshot, progressionSpeedMultiplier } from "./character-progression.js";
import { enemyLevelForTier } from "@blockcraft/protocol";

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

interface SilverDepthsRunStats {
  runId: string;
  partySize: number;
  startedAt: number;
  completedAt: number;
  enemiesDefeated: number;
  damageTaken: number;
  moonstoneCollected: number;
  moonstoneAtStart: number;
  edgeAtStart: number;
}

type WorldRoomOptions = {
  roomKind?: "overworld" | "silver-depths";
  instanceKey?: string;
  partySize?: number;
};
type ExpeditionPartyTicket = { instanceKey: string; worldRoomId: string; profiles: string[] };
const expeditionPartyKey = (ticket: string) => `blockcraft:expedition-party:${ticket}`;
function parseExpeditionPartyTicket(raw: unknown): ExpeditionPartyTicket | null {
  if (typeof raw !== "string") return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const record = value as Partial<ExpeditionPartyTicket>;
    return typeof record.instanceKey === "string" && typeof record.worldRoomId === "string"
      && Array.isArray(record.profiles) && record.profiles.length >= 2 && record.profiles.length <= 4
      && record.profiles.every(profile => typeof profile === "string") ? record as ExpeditionPartyTicket : null;
  } catch { return null; }
}

interface EmberVaultRunStats {
  runId: string;
  startedAt: number;
  completedAt: number;
  enemiesDefeated: number;
  damageTaken: number;
  coreAtStart: number;
  armourAtStart: number;
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

interface ActiveVenomSetPool {
  hazardId: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  damage: number;
  expiresAt: number;
  nextDamageAt: number;
}

interface ActiveMiniBossCover {
  x: number;
  z: number;
  minY: number;
  maxY: number;
  hits: number;
  original: { y: number; block: BlockId }[];
}

export class WorldRoom extends Room<{ state: WorldState; input: SchemaType<typeof ShadowMoveInput> }> {
  override maxClients = 20;
  override patchRate = 33;
  private readonly chunks = new Map<string, MutableChunk>();
  private readonly movementInputs = new Map<string, StoredMovementInput>();
  private readonly movementShadows = new Map<string, ShadowPose>();
  private readonly movementPilotControllers = new Set<string>();
  private movementShadowEnabled = false;
  private movementShadowSampleAt = 0;
  private readonly silverDepthsReconnectInvulnerability = new Map<string, number>();
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
  private readonly dodgePressure = new Map<string, { chain: number; lastAt: number; exhaustedUntil: number }>();
  private readonly activeDodgeWindows = new Map<string, { startedAt: number; until: number }>();
  private readonly dodgeCounterUntil = new Map<string, number>();
  private readonly magePowerCasts = new Map<string, number>();
  private readonly assassinShadowUntil = new Map<string, number>();
  private readonly assassinShadowBonus = new Map<string, number>();
  private readonly pathConcealedUntil = new Map<string, number>();
  private readonly rangerPinning = new Map<string, { mobId: string; stacks: number; expiresAt: number }>();
  private readonly rangerSlows = new Map<string, { until: number; multiplier: number }>();
  private readonly rangerFieldFocusHits = new Map<string, number>();
  private readonly tankFieldWards = new Set<string>();
  private readonly callingAbilityReadyAt = new Map<string, number>();
  private readonly tankBulwarkUntil = new Map<string, number>();
  private readonly mageBarrierHits = new Map<string, number>();
  private readonly mageOverloadReady = new Set<string>();
  private readonly mageOverloadCharges = new Map<string, number>();
  private readonly rangerCallingFocus = new Map<string, { hits: number; bonus: number }>();
  private readonly roleOpportunityReadyAt = new Map<string, number>();
  private readonly fortressProcAt = new Map<string, number>();
  private readonly masterTrialMobTags = new Map<string, { playerId: string; specializationId: BuildPathSpecializationId; until: number }>();
  private readonly pendingMobProjectiles = new Map<string, PendingMobProjectile>();
  private readonly delayedMatriarchVolleys = new Map<string, { origin: { x: number; y: number; z: number }; shots: { x: number; y: number; z: number }[]; releaseAt: number; damage: number; travelMs: number }>();
  private readonly matriarchCoverHits = new Map<string, number>();
  private readonly silverDepthsRuns = new Map<string, SilverDepthsRunStats>();
  private silverDepthsRunSequence = 0;
  private readonly emberVaultRuns = new Map<string, EmberVaultRunStats>();
  private emberVaultRunSequence = 0;
  private readonly pendingWeaponProjectiles = new Map<string, PendingWeaponProjectile>();
  private readonly venomBuildup = new Map<string, { stacks: number; expiresAt: number }>();
  private readonly bastionWardReadyAt = new Map<string, number>();
  private readonly venomSetPools = new Map<string, ActiveVenomSetPool>();
  private readonly venomSetBuildup = new Map<string, number>();
  private readonly crusherSetGuardUntil = new Map<string, number>();
  private huntSetEffectSequence = 0;
  private readonly mobCommittedAim = new Map<string, { x: number; y: number; z: number; yaw: number }>();
  private readonly mobStaggerImmuneUntil = new Map<string, number>();
  private readonly mobHazards = new Map<string, ActiveMobHazard>();
  private readonly mistfenPoolDamageAt = new Map<string, number>();
  private readonly mobHomes = new Map<string, { x: number; y: number; z: number }>();
  private readonly mobVerticalVelocities = new Map<string, number>();
  private readonly mobNavigation = new Map<string, MobNavigationState>();
  private readonly mobAwareness = new Map<string, MobAwareness>();
  private readonly areaLeaderPhases = new Map<string, AreaLeaderPhase>();
  private readonly miniBossEngagedAt = new Map<string, number>();
  private readonly miniBossOrbitPressure = new Map<string, OrbitPressureState>();
  private readonly miniBossArenaCover = new Map<string, Map<string, ActiveMiniBossCover>>();
  private readonly leaderDefeats = new Map<string, number>();
  private readonly selectedRealmHunts = new Map<string, string>();
  private readonly huntContracts = new Map<string, HuntContractState>();
  private readonly huntContractCycles = new Map<string, Partial<Record<HuntPathId, number>>>();
  private readonly huntChampions = new Map<string, { ownerId: string; pathId: HuntPathId; name: string; difficulty: HuntDifficulty }>();
  private readonly empoweredContractTargets = new Map<string, number>();
  private readonly empoweredContractDifficulties = new Map<string, HuntDifficulty>();
  private huntChampionSequence = 0;
  private readonly realmBossPhases = new Map<string, RealmBossPhase>();
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
  private readonly expeditionTicketBySession = new Map<string, string>();
  private readonly combatContributions = new CombatContributions();
  private readonly silverGuardVolley = new SilverGuardVolley();
  private readonly attackCoordination = new AttackCoordination();
  private readonly realmEvents = new RealmEventDirector();
  private readonly forestPortalCycle = new ForestPortalCycle();
  private forestDungeonActive = false;
  private forestDungeonRun: { id: string; key: string; allowed: Set<string>; entered: Set<string>; ready: Set<string>; claimed: Set<string>; phase: "lobby" | "active"; scalePlayers: number; startedAt: number; completedAt: number } | null = null;
  private forestDungeonRunSequence = 0;
  private forestDungeonUnlocked = false;
  private forestDungeonReopenAt = Infinity;
  private readonly forestDungeonCooldownUntil = new Map<string, number>();
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
  private readonly normalLootCadence = new NormalLootCadence();
  private readonly mobBaseNames = new Map<string, string>();
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
  private realmRewardLandingIndex = 0;
  private realmBossEmptySince = 0;
  private realmWardenRepeatActive = false;
  private realmWardenRepeatAvailableAt = 0;
  private worldSeed = "blockcraft-dev";
  private roomKind: "overworld" | "silver-depths" = "overworld";
  private silverInstanceKey = "";
  private instancePartySize = 1;
  private silverDepthsEncounterStage: SilverDepthsEncounterStage = 1;
  private silverDepthsWing: SilverDepthsWing | null = null;
  private silverDepthsCacheOpened = false;
  private silverDepthsCacheAmbushPhase: SilverDepthsCacheStatus["phase"] = "sealed";
  private silverDepthsCacheAmbushReleaseAt = 0;
  private silverDepthsNextHazardAt = 0;
  private silverDepthsHazardSequence = 0;
  private readonly silverDepthsPendingHazards: DepthsRouteHazard[] = [];
  private readonly realmBossPendingHazards: (DepthsRouteHazard & { mobId: string; damage: number })[] = [];
  private realmBossHazardSequence = 0;
  private silverDepthsSealOpened = false;
  private readonly silverDepthsGates: SilverDepthsGateStatus = { seal: false, iron: false, silver: false, gallery: false, boss: false };
  private silverDepthsAwaitingReady = false;
  private readonly silverDepthsCheckpointReady = new Set<string>();
  private readonly silverDepthsRoster = new Map<string, string>();
  private readonly silverDepthsPings = new Map<string, SilverDepthsPing & { expiresAt: number }>();
  private readonly lastSilverDepthsPingAt = new Map<string, number>();
  private readonly silverDepthsFallen = new Set<string>();
  private readonly silverDepthsDisconnected = new Set<string>();
  private silverInstanceSequence = 0;
  private readonly silverDepthsLobbies = new Map<string, { leaderId: string; members: string[]; ready: Set<string>; expiresAt: number }>();
  private readonly silverDepthsTransferPending = new Map<string, number>();

  override async onCreate(options: WorldRoomOptions = {}): Promise<void> {
    this.roomKind = options.roomKind === "silver-depths" ? "silver-depths" : "overworld";
    // The Colyseus input stream is the default. Keep an explicit server-side
    // rollback while older clients can still use the legacy "move" messages.
    this.movementShadowEnabled = process.env.MOVEMENT_NETCODE_LEGACY !== "1";
    if (this.movementShadowEnabled) {
      this.inputs = this.defineInput(ShadowMoveInput, {
        sanitize: { strafe: [-1, 1], forward: [-1, 1], yaw: [-1080, 1080] }, bufferMaxSize: 64,
      });
    }
    this.silverInstanceKey = this.roomKind === "silver-depths" ? options.instanceKey ?? "" : "";
    this.instancePartySize = Math.max(1, Math.min(4, Math.floor(options.partySize ?? 1)));
    if (this.roomKind === "silver-depths") this.maxClients = 4;
    this.worldSeed = String(process.env.WORLD_SEED || "blockcraft-dev");
    this.worldDeltaStorageKey = worldDeltaHashKey(this.worldSeed);
    if (this.roomKind === "overworld") {
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
    }
    this.setState(new WorldState());
    const depthsEntry = new ForestPortalState();
    Object.assign(depthsEntry, TOWN_SILVER_DEPTHS_PORTAL_POSITION, { kind: "entry" });
    this.state.portals.set("depths-entry", depthsEntry);
    const emberEntry = new ForestPortalState();
    Object.assign(emberEntry, EMBER_VAULT_PORTAL_POSITION, { kind: "entry" });
    this.state.portals.set("ember-entry", emberEntry);
    const wardenGate = new ForestPortalState();
    Object.assign(wardenGate, REALM_WARDEN_GATE_POSITION, { kind: "warden-gate" });
    this.state.portals.set("warden-gate", wardenGate);
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
    this.registerMob("buried-vault-crawler", "moss_crawler", { x: 54.5, y: 1, z: 10.5 });
    this.registerMob("buried-chamber-brute", "stone_brute", CAVE_HIDDEN_HOME);
    const legacyDepthsSpitters = ["silver-depths-spitter-a", "silver-depths-spitter-b"] as const;
    SILVER_DEPTHS_SPITTER_HOMES.forEach((home, index) => this.registerMob(legacyDepthsSpitters[index]!, "cave_spitter", home));
    legacyDepthsSpitters.forEach(id => { this.state.mobs.get(id)!.name = "Moonstone Spitter"; });
    this.registerMob(CRYSTAL_MATRIARCH_ID, "cave_spitter", CRYSTAL_MATRIARCH_HOME);
    const crystalMatriarch = this.state.mobs.get(CRYSTAL_MATRIARCH_ID)!;
    crystalMatriarch.name = "Crystal Matriarch"; crystalMatriarch.isChampion = true;
    crystalMatriarch.health = crystalMatriarch.maxHealth = 28; crystalMatriarch.rewardMultiplier *= 1.5;
    for (const spawn of EMBER_VAULT_MOBS) this.registerMob(spawn.id, spawn.archetype, spawn);
    this.state.mobs.get("ember-sentinel-a")!.name = "Ember Sentinel";
    this.state.mobs.get("ember-sentinel-b")!.name = "Ember Sentinel";
    this.state.mobs.get("ember-brute")!.name = "Molten Brute";
    const forgeColossus = this.state.mobs.get("forge-colossus")!;
    forgeColossus.name = "Forge Colossus"; forgeColossus.isChampion = true;
    forgeColossus.health = forgeColossus.maxHealth = 38; forgeColossus.attackDamage = 3; forgeColossus.rewardMultiplier *= 2;
    this.registerMob("wild-crawler", "moss_crawler", GREENWOOD_CRAWLER_HOMES[0]);
    this.registerMob("frontier-crawler", "moss_crawler", { x: 63.5, y: 8, z: 35.5 });
    this.registerMob("frontier-support-spitter", "cave_spitter", MIXED_FRONTIER_SPITTER);
    if (this.roomKind === "silver-depths") {
      this.state.mobs.clear();
      this.spawnSilverDepthsStage(1);
      this.state.portals.clear();
    }
    this.onMessage("world:ready", client => {
      client.send("world:bootstrap", this.bootstrapPayload(this.state.players.get(client.sessionId)));
      this.sendHuntCollection(client);
      this.sendBuildPath(client);
      this.sendEquipmentAffixes(client);
      if (this.roomKind === "overworld") client.send("party:update", this.parties.snapshot(client.sessionId, this.state.players, Date.now()));
      if (this.roomKind === "overworld") for (const [key, lobby] of this.silverDepthsLobbies)
        if (lobby.members.includes(client.sessionId)) this.sendSilverDepthsLobby(key, lobby);
      client.send("mineral:status", this.mineralStatus());
      const run = this.silverDepthsRuns.get(client.sessionId);
      if (this.roomKind === "silver-depths" && run) {
        client.send("dungeon:run", { runId: run.runId, phase: "started", dungeon: "silver-depths", partySize: run.partySize } satisfies DungeonRunUpdate);
        this.sendSilverDepthsCacheStatus(client);
        const rewards = this.silverDepthsWingRewardStatus(client.sessionId);
        if (rewards) client.send("depths:wing-rewards", rewards);
        this.sendSilverDepthsCheckpointStatus(client.sessionId);
      }
      if (this.roomKind === "silver-depths" && this.silverDepthsRoster.has(client.sessionId))
        client.send("depths:party-status", this.silverDepthsPartyStatus());
      if (this.roomKind === "silver-depths" && this.silverDepthsRoster.has(client.sessionId))
        client.send("depths:gates", { ...this.silverDepthsGates } satisfies SilverDepthsGateStatus);
      if (this.roomKind === "silver-depths" && this.silverDepthsRoster.has(client.sessionId)) {
        const now = Date.now();
        for (const ping of this.silverDepthsPings.values()) if (ping.expiresAt > now)
          client.send("depths:ping", { senderId: ping.senderId, senderName: ping.senderName,
            x: ping.x, z: ping.z, durationMs: ping.expiresAt - now } satisfies SilverDepthsPing);
      }
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
      if (parsed.data.action === "leave") this.expeditionTicketBySession.delete(client.sessionId);
      this.validateSilverDepthsLobbies(Date.now());
      this.sendPartyUpdates(Date.now());
    });
    this.onMessage("player:name", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId), name = PlayerNameSchema.safeParse(payload);
      if (!player || !name.success || Date.now() - (this.lastNameAt.get(client.sessionId) ?? -Infinity) < 2000) return;
      this.lastNameAt.set(client.sessionId, Date.now()); player.name = name.data;
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      client.send("chat:notice", `Your name is now ${player.name}.`);
    });
    this.onMessage("player:appearance", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId), appearance = AppearanceSchema.safeParse(payload);
      if (!player || !appearance.success) return;
      player.appearanceSkin = appearance.data.skin;
      player.appearanceHair = appearance.data.hair;
      player.appearanceCoat = appearance.data.coat;
      player.appearanceHairStyle = appearance.data.hairStyle;
      player.appearanceCoatStyle = appearance.data.coatStyle;
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    });
    this.onMessage("objective:sync", client => this.sendObjectiveState(client, true));
    this.onMessage("depths:route", (client, payload: unknown) => this.chooseSilverDepthsWing(client, payload));
    this.onMessage("depths:ready", client => this.handleSilverDepthsCheckpointReady(client));
    this.onMessage("depths:ping", (client, payload: unknown) => this.handleSilverDepthsPing(client, payload));
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
    this.onMessage("player:return", client => void this.returnPlayerToTown(client));
    this.onMessage("dungeon:board", (client, payload: unknown) => this.handleDungeonBoard(client, payload));
    this.onMessage("realm-hunt:board", (client, payload: unknown) => this.handleRealmHuntBoard(client, payload));
    this.onMessage("hunt:collection", (client, payload: unknown) => this.handleHuntCollection(client, payload));
    this.onMessage("build:path", (client, payload: unknown) => this.handleBuildPath(client, payload));
    aliveMessage("role:opportunity", (client, payload: unknown) => this.handleRoleOpportunity(client, payload));
    this.onMessage("dungeon:lobby", (client, payload: unknown) => this.handleDungeonLobby(client, payload));
    this.onMessage("depths:lobby", (client, payload: unknown) => this.handleSilverDepthsLobby(client, payload));
    this.onMessage("portal:use", (client, payload: unknown) => {
      const id = payload && typeof payload === "object" && "id" in payload ? String(payload.id) : "";
      if (id === "warden-gate") this.useRealmWardenGate(client, payload);
      else if (id.startsWith("depths-")) this.useSilverDepthsPortal(client, payload);
      else if (id.startsWith("ember-")) this.useEmberVaultPortal(client, payload);
      else this.useForestPortal(client, payload);
    });
    this.onMessage("recovery:collect", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !payload || typeof payload !== "object" || !("bagId" in payload) || typeof payload.bagId !== "string" || payload.bagId.length > 80) return;
      const message = collectRecoveryBag(player, payload.bagId, bag => hasCombatLineOfSight(player, bag, this.readWorldBlock));
      void this.persistPlayer(client.sessionId, player);
      client.send("recovery:result", message);
    });
    aliveMessage("move", (client, payload) => this.handleMove(client, payload));
    if (this.movementShadowEnabled) {
      this.onMessage("movement:shadow:hello", (client, payload: unknown) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) return;
        this.movementShadows.set(client.sessionId, { x: player.x, y: player.y, z: player.z, verticalVelocity: 0 });
        const control = typeof payload === "object" && payload !== null && "control" in payload && payload.control === true;
        if (control) {
          this.movementPilotControllers.add(client.sessionId);
          player.pilotVy = 0;
          this.verticalVelocities.set(client.sessionId, 0);
        }
        client.send("movement:shadow:ready", { tickRate: 30, control });
      });
    }
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
    aliveMessage("calling:ability", (client, payload) => this.handleCallingAbility(client, payload));
    aliveMessage("calling:ability:equip", (client, payload) => this.handleCallingAbilityEquip(client, payload));
    aliveMessage("calling:augment:equip", (client, payload) => this.handleCallingAugmentEquip(client, payload));
    aliveMessage("main-hand:equip", (client, payload) => this.handleMainHandEquip(client, payload));
    aliveMessage("armour:equip", (client, payload) => this.handleArmourEquip(client, payload));
    this.onMessage("loot:collect", (client, payload) => this.handleLootCollect(client, payload));
    aliveMessage("trait:equip", (client, payload) => this.handleTraitEquip(client, payload));
    aliveMessage("progression:choose", (client, payload) => this.handleProgressionChoice(client, payload));
    this.onMessage("quiz:sync", client => this.sendQuizState(client));
    aliveMessage("quiz:start", (client, payload) => this.handleQuizStart(client, payload));
    aliveMessage("quiz:answer", (client, payload) => this.handleQuizAnswer(client, payload));
    aliveMessage("quiz:decision", (client, payload) => this.handleQuizDecision(client, payload));
    this.onMessage("blacksmith:sync", client => this.handleBlacksmithSync(client));
    this.onMessage("storage:sync", client => this.sendStorageState(client));
    this.onMessage("storage:transfer", (client, payload: unknown) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const message = transferStoredItem(player, payload);
      void this.persistPlayer(client.sessionId, player);
      this.sendStorageState(client, message);
    });
    aliveMessage("blacksmith:sell", client => this.handleBlacksmithSell(client));
    aliveMessage("blacksmith:dismantle", (client, payload) => this.handleBlacksmithDismantle(client, payload));
    aliveMessage("blacksmith:reforge", (client, payload) => this.handleBlacksmithReforge(client, payload));
    aliveMessage("blacksmith:attune", (client, payload) => this.handleBlacksmithAttune(client, payload));
    aliveMessage("blacksmith:leader-forge", (client, payload) => this.handleLeaderForge(client, payload));
    aliveMessage("blacksmith:regional-forge", (client, payload) => this.handleRegionalForge(client, payload));
    aliveMessage("blacksmith:forge", (client, payload) => this.handleBlacksmithForge(client, payload));
    aliveMessage("blacksmith:buy", (client, payload) => this.handleBlacksmithBuy(client, payload));
    aliveMessage("blacksmith:depths-buy", (client, payload) => this.handleDepthsRewardBuy(client, payload));
    this.onMessage("potion:buy", client => this.handlePotion(client, true));
    this.onMessage("potion:use", client => this.handlePotion(client, false));
    if (this.movementShadowEnabled) {
      // Colyseus owns one simulation timer per room. Pilot and legacy clients
      // advance on this same fixed tick while older clients remain connected.
      this.setFixedTimestep(ctx => {
        this.simulateMovementShadows(ctx.dt);
        this.simulatePlayers(ctx.dt);
      }, 30);
    } else {
      this.setSimulationInterval(deltaTime => this.simulatePlayers(Math.min(deltaTime / 1000, 0.1)), 33);
    }
  }

  override async onJoin(client: Client, options: unknown): Promise<void> {
    const player = new PlayerState();
    player.coins = TAVERN_QUIZ_STARTING_COINS;
    // Assign after construction so Colyseus includes the loadout in the initial
    // patch instead of eliding it as an unchanged schema default.
    player.equippedPower = "shockwave";
    player.equippedPowerSecondary = "eruption";
    player.activePower = "shockwave";
    player.seismicMastery = "advancing_fault";
    player.mainHandId = "longsword";
    player.mainHandTag = "melee";
    player.equippedSpecial = "hunters_mark";
    player.equippedTrait = "momentum";
    const profileTokenResult = PlayerProfileTokenSchema.safeParse(
      typeof options === "object" && options && "profileToken" in options ? options.profileToken : undefined,
    );
    const profileToken = profileTokenResult.success ? profileTokenResult.data : null;
    const requestedAdminPass = typeof options === "object" && options && "adminPass" in options ? options.adminPass : undefined;
    const requestedName = PlayerNameSchema.safeParse(
      typeof options === "object" && options && "name" in options ? options.name : undefined,
    );
    player.name = requestedName.success ? requestedName.data : "Explorer";
    const requestedAppearance = AppearanceSchema.safeParse(
      typeof options === "object" && options && "appearance" in options ? options.appearance : undefined,
    );
    if (requestedAppearance.success) {
      player.appearanceSkin = requestedAppearance.data.skin;
      player.appearanceHair = requestedAppearance.data.hair;
      player.appearanceCoat = requestedAppearance.data.coat;
      player.appearanceHairStyle = requestedAppearance.data.hairStyle;
      player.appearanceCoatStyle = requestedAppearance.data.coatStyle;
    }
    if (profileToken) {
      try {
        const save = parsePlayerSave(await this.presence.hget(PLAYER_SAVE_HASH, profileToken));
        if (save) applyPlayerSave(player, save);
      } catch (error) {
        console.warn("Player save could not be loaded; starting with safe defaults.", error);
      }
      this.profileTokens.set(client.sessionId, profileToken);
      this.profileSaveFingerprints.set(client.sessionId, serializePlayerSave(player, 0));
      player.isAdmin = await this.resolveAdminAccess(profileToken, requestedAdminPass);
    }
    const requestedQaSpawn = typeof options === "object" && options && "qaSpawn" in options ? String(options.qaSpawn) : "";
    const returningFromDepths = typeof options === "object" && options && "returnFrom" in options && options.returnFrom === "silver-depths";
    const instanceSpawn = SILVER_DEPTHS_PARTY_SPAWNS.find(candidate => [...this.state.players.values()]
      .every(other => Math.hypot(other.x - candidate.x, other.z - candidate.z) >= 1.25)) ?? SILVER_DEPTHS_ENTRY_POSITION;
    const spawn = this.roomKind === "silver-depths" ? instanceSpawn
      : process.env.NODE_ENV !== "production" && requestedQaSpawn === "cave"
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
        : returningFromDepths ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : this.spawnPoint();
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
    // New characters enter the world loop immediately. Stage 1 is now a hidden
    // discovery milestone rather than a blacksmith briefing quest.
    if (player.miningExpeditionStage === 0) player.miningExpeditionStage = 1;
    this.state.players.set(client.sessionId, player);
    if (player.miningExpeditionStage === 7 && (player.inventory.get("miners_lantern")?.quantity ?? 0) > 0) {
      this.advanceFirstExpedition(client, "returned_to_blacksmith");
    }
    if (profileToken && typeof options === "object" && options && "partyTicket" in options
      && typeof options.partyTicket === "string" && /^[a-f0-9-]{36}$/.test(options.partyTicket)) {
      try {
        const ticket = parseExpeditionPartyTicket(await this.presence.get(expeditionPartyKey(options.partyTicket)));
        const eligible = ticket?.profiles.includes(profileToken) && (this.roomKind === "silver-depths"
          ? ticket.instanceKey === this.silverInstanceKey : returningFromDepths);
        if (eligible) {
          this.expeditionTicketBySession.set(client.sessionId, options.partyTicket);
          if (this.roomKind === "overworld") this.restoreExpeditionParty(options.partyTicket);
        }
      } catch (error) { console.warn("Expedition party could not be restored.", error); }
    }
    this.objectiveProgress.set(client.sessionId, createObjectiveProgress());
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: Date.now() });
    this.verticalVelocities.set(client.sessionId, 0);
    if (this.roomKind === "silver-depths") {
      this.beginSilverDepthsRun(client, player, Date.now());
      if (player.silverDepthsStage === 1) this.advanceSilverDepthsExpedition(client, "entered_depths");
    }
    if (profileToken) {
      try {
        await this.persistPlayer(client.sessionId, player, true);
      } catch {
        // The queued writer already logged the failure and will retry while connected.
      }
    }
  }

  override async onLeave(client: Client): Promise<void> {
    this.silverDepthsReconnectInvulnerability.delete(client.sessionId);
    this.bastionWardReadyAt.delete(client.sessionId);
    this.crusherSetGuardUntil.delete(client.sessionId);
    this.venomSetBuildup.delete(client.sessionId);
    for (const [id, pool] of this.venomSetPools) if (pool.ownerId === client.sessionId) this.venomSetPools.delete(id);
    for (const key of this.venomBuildup.keys()) if (key.startsWith(`${client.sessionId}:`)) this.venomBuildup.delete(key);
    this.combatContributions.disconnect(client.sessionId);
    for (const [id, drop] of this.state.lootDrops) if (drop.ownerId === client.sessionId) this.state.lootDrops.delete(id);
    this.trading.disconnect(client.sessionId); this.lastTradeRequestAt.delete(client.sessionId);
    this.parties.disconnect(client.sessionId);
    for (const [key, lobby] of this.silverDepthsLobbies) if (lobby.members.includes(client.sessionId))
      this.closeSilverDepthsLobby(key, "Assembly cancelled · a teammate disconnected.");
    this.expeditionTicketBySession.delete(client.sessionId);
    this.lastPartyRequestAt.delete(client.sessionId);
    this.lastSilverDepthsPingAt.delete(client.sessionId);
    this.silverDepthsPings.delete(client.sessionId);
    this.lastChatAt.delete(client.sessionId); this.lastNameAt.delete(client.sessionId);
    this.pendingMining.delete(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    const depthsRun = this.silverDepthsRuns.get(client.sessionId);
    if (player && depthsRun?.completedAt === 0) this.restoreRunMoonstone(player, depthsRun);
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
    this.silverDepthsRuns.delete(client.sessionId);
    this.silverDepthsDisconnected.delete(client.sessionId);
    if (depthsRun?.completedAt === 0) this.broadcastSilverDepthsPartyStatus();
    this.silverDepthsCheckpointReady.delete(client.sessionId);
    if (this.silverDepthsAwaitingReady) this.refreshSilverDepthsCheckpointReady();
    this.emberVaultRuns.delete(client.sessionId);
    this.forestReturns.delete(client.sessionId);
    this.forestTravelAt.delete(client.sessionId);
    this.movementInputs.delete(client.sessionId);
    this.movementShadows.delete(client.sessionId);
    this.movementPilotControllers.delete(client.sessionId);
    this.movementRateWindows.delete(client.sessionId);
    this.verticalVelocities.delete(client.sessionId);
    this.attackChains.delete(client.sessionId);
    this.pendingAttacks.delete(client.sessionId);
    this.cancelWeaponProjectiles(client.sessionId);
    this.pendingPowers.delete(client.sessionId);
    this.specialMarks.delete(client.sessionId);
    this.brambleSnares.delete(client.sessionId);
    this.lastDodgeAt.delete(client.sessionId);
    this.dodgePressure.delete(client.sessionId);
    this.activeDodgeWindows.delete(client.sessionId);
    this.dodgeCounterUntil.delete(client.sessionId);
    this.magePowerCasts.delete(client.sessionId);
    this.assassinShadowUntil.delete(client.sessionId);
    this.assassinShadowBonus.delete(client.sessionId);
    this.pathConcealedUntil.delete(client.sessionId);
    this.rangerPinning.delete(client.sessionId);
    this.rangerFieldFocusHits.delete(client.sessionId);
    this.tankFieldWards.delete(client.sessionId);
    this.callingAbilityReadyAt.delete(client.sessionId);
    this.tankBulwarkUntil.delete(client.sessionId);
    this.mageBarrierHits.delete(client.sessionId);
    this.mageOverloadReady.delete(client.sessionId);
    this.mageOverloadCharges.delete(client.sessionId);
    this.rangerCallingFocus.delete(client.sessionId);
    for (const key of this.roleOpportunityReadyAt.keys()) if (key.startsWith(`${client.sessionId}:`)) this.roleOpportunityReadyAt.delete(key);
    this.fortressProcAt.delete(client.sessionId);
    this.profileTokens.delete(client.sessionId);
    this.profileSaveFingerprints.delete(client.sessionId);
    this.quizRounds.delete(client.sessionId);
    this.objectiveProgress.delete(client.sessionId);
    this.selectedRealmHunts.delete(client.sessionId);
    this.huntContracts.delete(client.sessionId);
    this.huntContractCycles.delete(client.sessionId);
    for (const [mobId, champion] of this.huntChampions) if (champion.ownerId === client.sessionId) {
      this.huntChampions.delete(mobId); this.state.mobs.delete(mobId); this.mobHomes.delete(mobId);
      this.empoweredContractDifficulties.delete(mobId);
      this.mobNavigation.delete(mobId); this.mobAwareness.delete(mobId);
    }
  }

  override onDrop(client: Client): void {
    if (this.roomKind !== "silver-depths" || !this.state.players.has(client.sessionId)) return;
    this.inputs?.get(client.sessionId).clear();
    const player = this.state.players.get(client.sessionId)!;
    if (!this.silverDepthsReconnectInvulnerability.has(client.sessionId)) {
      this.silverDepthsReconnectInvulnerability.set(client.sessionId, player.invulnerableUntil);
    }
    player.invulnerableUntil = Math.max(player.invulnerableUntil, Date.now() + 45_000);
    player.defending = false;
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: Date.now() });
    this.pendingMining.delete(client.sessionId);
    this.pendingAttacks.delete(client.sessionId);
    this.pendingPowers.delete(client.sessionId);
    this.silverDepthsDisconnected.add(client.sessionId);
    this.broadcastSilverDepthsPartyStatus();
    void this.allowReconnection(client, 45).catch(() => undefined);
  }

  override onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.inputs?.get(client.sessionId).clear();
    const previousInvulnerability = this.silverDepthsReconnectInvulnerability.get(client.sessionId);
    if (previousInvulnerability !== undefined) {
      player.invulnerableUntil = Math.max(previousInvulnerability, Date.now() + 1200);
      this.silverDepthsReconnectInvulnerability.delete(client.sessionId);
    }
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: Date.now() });
    this.silverDepthsDisconnected.delete(client.sessionId);
    this.broadcastSilverDepthsPartyStatus();
    const rewards = this.silverDepthsWingRewardStatus(client.sessionId);
    if (rewards) client.send("depths:wing-rewards", rewards);
    this.sendSilverDepthsCacheStatus(client);
    this.sendSilverDepthsCheckpointStatus(client.sessionId);
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
      client.send("realm:event", this.realmEventUpdateFor(client, now));
    }
  }

  private ownsOrHasPendingItem(playerId: string, itemId: ItemId): boolean {
    const player = this.state.players.get(playerId);
    return Boolean(player && (player.inventory.get(itemId)?.quantity ?? 0) + (player.storage.get(itemId)?.quantity ?? 0) > 0)
      || [...this.state.lootDrops.values()].some(drop => drop.ownerId === playerId
        && decodeLootBagItems(drop.contentsJson, drop.itemId, drop.quantity).some(entry => entry.itemId === itemId));
  }

  private ownsOrHasPendingSignature(playerId: string, itemId: SignatureItemId): boolean {
    return this.ownsOrHasPendingItem(playerId, itemId);
  }

  private realmEventUpdateFor(client: Client, now: number): RealmEventUpdate {
    const update = this.realmEvents.status(now) satisfies RealmEventUpdate;
    const definition = realmEventDefinition(update.eventId);
    const player = this.state.players.get(client.sessionId);
    const localEventRadius = definition?.key === "greenwood" ? GREENWOOD_EVENT_TRACKING_RADIUS
      : definition?.key === "mistfen" ? MISTFEN_EVENT_TRACKING_RADIUS : null;
    if (localEventRadius && player
      && (Math.abs(player.y - update.targetY) > 2.5
        || Math.hypot(player.x - update.targetX, player.z - update.targetZ) > localEventRadius)) {
      return { ...update, phase: "idle", eventId: null, eventName: null, eventTitle: null,
        eventDetail: null, eventVariant: null, warningUntil: 0 };
    }
    if (!definition || !player || definition.signatureRewards.length === 0) return update;
    const pity = parseSignaturePity(player.signaturePityJson);
    const signatures = definition.signatureRewards as readonly SignatureItemId[];
    const missing = signatures.filter(itemId => !this.ownsOrHasPendingSignature(client.sessionId, itemId));
    const highlighted = missing.length > 0 ? missing : signatures;
    return { ...update, lootHint: highlighted.map(itemId => signatureLootHint(itemId,
      this.ownsOrHasPendingSignature(client.sessionId, itemId), pity)).join("  ·  ") };
  }

  private broadcastRealmEvent(now: number): void {
    for (const client of this.clients) if (this.state.players.has(client.sessionId)) client.send("realm:event", this.realmEventUpdateFor(client, now));
  }

  private restoreExpeditionParty(ticket: string): void {
    const profiles = new Set<string>();
    const members = [...this.expeditionTicketBySession].filter(([id, candidate]) => {
      const profile = this.profileTokens.get(id);
      if (candidate !== ticket || !this.state.players.has(id) || !profile || profiles.has(profile)) return false;
      profiles.add(profile);
      return true;
    }).map(([id]) => id);
    if (members.length < 2) return;
    this.parties.restore(members);
    this.sendPartyUpdates(Date.now());
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

  private sendBlacksmithState(client: Client, message: string | undefined = undefined, phase: BlacksmithUpdate["phase"] = "idle", sold = 0, goldGranted = 0, purchasedUpgradeId?: BlacksmithUpgradeId, purchasedDepthsRewardId?: SilverDepthsRewardId,
    dismantled?: { itemId: BlacksmithDismantleItemId; materialId?: ItemId; materialQuantity?: number },
    reforgedItemId?: BlacksmithReforgeItemId): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.send("blacksmith:update", {
      phase,
      ironOre: player.inventory.get("iron_ore")?.quantity ?? 0,
      silverOre: player.inventory.get("silver_ore")?.quantity ?? 0,
      moonstone: player.inventory.get("moonstone")?.quantity ?? 0,
      ironCapacity: ironCapacity(player.blacksmithUpgrades),
      gold: player.coins,
      characterLevel: player.level,
      ownedUpgrades: ownedBlacksmithUpgrades(player.blacksmithUpgrades),
      ownedDepthsRewards: ownedDepthsRewards(player.blacksmithUpgrades),
      weapons: Object.fromEntries(Object.keys(BLACKSMITH_STOCK).map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      dismantleItems: Object.fromEntries(Object.keys(BLACKSMITH_DISMANTLE).map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      sold,
      goldGranted,
      purchasedUpgradeId,
      purchasedDepthsRewardId,
      dismantledItemId: dismantled?.itemId,
      reforgeRanks: parseReforgeRanks(player.reforgeRanksJson),
      reforgeMaterials: Object.fromEntries([...new Set(Object.values(BLACKSMITH_REFORGE).map(recipe => recipe.materialId))]
        .map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      reforgedItemId,
      attunementDust: this.attunementDust(player),
      attunementAffixes: this.equipmentAffixes(player),
      attunementOffers: this.attunementOffers(player),
      selectedBuildPathId: parseBuildPathState(player.huntLoadoutsJson).selectedPathId,
      equippedMainHandItemId: (Object.keys(ITEM_DEFINITIONS) as ItemId[]).find(itemId => equipmentForItem(itemId) === player.mainHandId) ?? null,
      equippedArmourItemId: Object.hasOwn(ITEM_DEFINITIONS, player.armourId) ? player.armourId as ItemId : null,
      leaderRelics: Object.fromEntries(AREA_LEADER_RELIC_IDS.map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      leaderMarks: Object.fromEntries((Object.keys(LEADER_FORGE_MARKS) as LeaderForgemarkId[])
        .map(id => [id, player.inventory.get(id)?.quantity ?? 0])),
      regionalMarks: { greenwood: this.greenwoodProgress(player).marks, mistfen: this.mistfenProgress(player).marks },
      regionalMasteryRanks: {
        greenwood: greenwoodMasteryRank(this.greenwoodProgress(player).points, this.greenwoodProgress(player).discovered),
        mistfen: mistfenMasteryRank(this.mistfenProgress(player).points, this.mistfenProgress(player).discovered),
      },
      materialGranted: dismantled?.materialId,
      materialQuantity: dismantled?.materialQuantity,
      message: message ?? blacksmithNextStep(player.blacksmithUpgrades, player.coins, player.inventory.get("iron_ore")?.quantity ?? 0),
    } satisfies BlacksmithUpdate);
  }

  private grantProgression(sessionId: string, amount: number, source: string): ProgressionUpdate | null {
    const player = this.state.players.get(sessionId);
    if (!player) return null;
    const update = grantCharacterExperience(player, amount, source);
    if (!update) return null;
    this.clients.find(candidate => candidate.sessionId === sessionId)?.send("progression:update", update);
    void this.persistPlayer(sessionId, player);
    return update;
  }

  private handleProgressionChoice(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = ProgressionChooseSchema.safeParse(payload);
    if (!player || !parsed.success) return;
    const update = chooseCharacterStat(player, parsed.data.stat);
    client.send("progression:update", update ?? progressionSnapshot(player));
    if (update) void this.persistPlayer(client.sessionId, player);
  }

  private advanceFirstExpedition(clientOrId: Client | string, event: MiningExpeditionEvent): boolean {
    const sessionId = typeof clientOrId === "string" ? clientOrId : clientOrId.sessionId;
    const client = typeof clientOrId === "string" ? this.clients.find(candidate => candidate.sessionId === sessionId) : clientOrId;
    const player = this.state.players.get(sessionId);
    if (!player) return false;
    const next = advanceMiningExpedition(player.miningExpeditionStage, event);
    if (next === player.miningExpeditionStage) return false;
    player.miningExpeditionStage = next;
    const labels = ["", "East Ore Mine discovered.", "Mine entered · locate iron in the first chamber.",
      "Iron secured · push deeper and mine silver.", "Silver secured · breach the eastern vault seal.",
      "Vault breached · defeat its defenders and the Stone Warden.", "Stone Warden defeated · claim your personal cache.",
      "Miner's Lantern secured.", "Mine mastery earned."];
    client?.send("chat:notice", labels[next] ?? "Mine progress updated.");
    if (next === 8) {
      const before = player.coins;
      player.coins = Math.min(1_000_000, player.coins + 25);
      player.maxHealth = Math.min(127, player.maxHealth + 1);
      player.health = Math.min(player.maxHealth, player.health + 1);
      client?.send("objective:completed", {
        objectiveId: "first-mining-expedition",
        title: "Stone Warden Defeated",
        rewardLabel: `Warden's Resolve · +1 maximum health · +${player.coins - before} gold`,
        coinsGranted: player.coins - before,
      } satisfies WorldObjectiveCompleted);
      this.grantProgression(sessionId, 40, "Stone Warden defeated");
    }
    void this.persistPlayer(sessionId, player, next === 8);
    return true;
  }

  private advanceSilverDepthsExpedition(clientOrId: Client | string, event: SilverDepthsEvent): boolean {
    const sessionId = typeof clientOrId === "string" ? clientOrId : clientOrId.sessionId;
    const client = typeof clientOrId === "string" ? this.clients.find(candidate => candidate.sessionId === sessionId) : clientOrId;
    const player = this.state.players.get(sessionId);
    if (!player || player.miningExpeditionStage < 8) return false;
    const next = advanceSilverDepths(player.silverDepthsStage, event);
    if (next === player.silverDepthsStage) return false;
    player.silverDepthsStage = next;
    if (next === 2) {
      this.restoreSilverDepthsMoonstone();
    }
    const labels = ["", "The Silver Depths are open · use the violet portal in town.", "Depths entered · mine the Moonstone seal.",
      "Moonstone exposed · clear the staged gallery defenses.", "Antechamber clear · confront the Crystal Matriarch.",
      "Crystal Matriarch defeated · claim your personal Matriarch's Edge.", "Matriarch's Edge secured · use the return portal.", "The Silver Depths complete · returned safely to town."];
    client?.send("chat:notice", labels[next] ?? "Silver Depths progress updated.");
    if (next === 7) {
      const moonstone = player.inventory.get("moonstone");
      if (moonstone) moonstone.quantity = Math.max(0, moonstone.quantity - 1);
      player.blacksmithUpgrades |= 8;
      client?.send("objective:completed", { objectiveId: "silver-depths-expedition", title: "The Silver Depths",
        rewardLabel: "Matriarch's Edge · fixed equipment · Moonstone attunement +1 weapon damage", coinsGranted: 0 } satisfies WorldObjectiveCompleted);
      this.grantProgression(sessionId, 75, "The Silver Depths");
    }
    void this.persistPlayer(sessionId, player, next === 7);
    return true;
  }

  private handleBlacksmithSync(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    let message: string | undefined;
    if (canTradeAtBlacksmith(player) && player.miningExpeditionStage === 8 && player.silverDepthsStage === 0 && player.level < 7) {
      message = "The Silver Depths unlock at character level 7. Continue exploring and completing encounters.";
    } else if (canTradeAtBlacksmith(player) && canExitSilverDepths(player) && player.silverDepthsStage === 6 && this.advanceSilverDepthsExpedition(client, "returned_to_blacksmith")) {
      message = "Matriarch's Edge secured. Your Moonstone was attuned for +1 permanent weapon damage.";
    }
    this.sendBlacksmithState(client, message);
    this.sendObjectiveState(client, true);
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
    const requiredLevel = blacksmithRequiredLevel(id);
    if (player.level < requiredLevel) return this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[id].name} unlocks at character level ${requiredLevel}.`, "error");
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

  private handleBlacksmithDismantle(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = BlacksmithDismantleSchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose an equipment item to dismantle.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to dismantle equipment.", "error");
    const itemId = parsed.data.itemId;
    const recipe = BLACKSMITH_DISMANTLE[itemId];
    const item = player.inventory.get(itemId);
    const quantity = item?.quantity ?? 0;
    if (quantity <= 0) return this.sendBlacksmithState(client, `You do not have ${ITEM_DEFINITIONS[itemId].name} in your pack.`, "error");
    const equipped = equipmentForItem(itemId) === player.mainHandId || armourForItem(itemId) === player.armourId;
    if (equipped && quantity <= 1) return this.sendBlacksmithState(client, `Your equipped ${ITEM_DEFINITIONS[itemId].name} is protected. Equip something else before dismantling it.`, "error");
    if (player.coins + recipe.gold > 1_000_000) return this.sendBlacksmithState(client, "Your gold purse does not have room for the dismantling return.", "error");
    const materialId = "materialId" in recipe ? recipe.materialId : undefined;
    const materialQuantity = "materialQuantity" in recipe ? recipe.materialQuantity : undefined;
    if (materialId && materialQuantity) {
      const held = player.inventory.get(materialId)?.quantity ?? 0;
      const capacity = materialId === "silver_ore" ? ironCapacity(player.blacksmithUpgrades) : 65_535;
      if (held + materialQuantity > capacity) return this.sendBlacksmithState(client, `Make room for ${ITEM_DEFINITIONS[materialId].name} before dismantling this item.`, "error");
    }
    item!.quantity = quantity - 1;
    const affixes = this.equipmentAffixes(player), offers = this.attunementOffers(player);
    const dismantledTier = quantity === 1 ? affixes[itemId]?.tier ?? 0 : 0;
    const dustGranted = dismantledTier > 0 ? attunementDustYield(dismantledTier) : 0;
    if (item!.quantity === 0 && Object.hasOwn(BLACKSMITH_REFORGE, itemId)) {
      player.reforgeRanksJson = withReforgeRank(player.reforgeRanksJson, itemId as BlacksmithReforgeItemId, 0);
      delete affixes[itemId]; delete offers[itemId];
    }
    this.setEquipmentAttunements(player, affixes, this.attunementDust(player) + dustGranted, offers);
    player.coins += recipe.gold;
    if (materialId && materialQuantity) {
      let material = player.inventory.get(materialId);
      if (!material) { material = new InventoryItemState(); player.inventory.set(materialId, material); }
      material.quantity = inventoryTotal(material.quantity, materialQuantity);
    }
    const recycledRegion: RegionalForgeId | null = itemId === "rootstalker_wrap" ? "greenwood"
      : itemId === "mirebreaker_mantle" ? "mistfen" : null;
    if (recycledRegion) this.grantRegionalMark(client.sessionId, recycledRegion);
    void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    const materialMessage = materialId && materialQuantity ? ` and ${materialQuantity} ${ITEM_DEFINITIONS[materialId].name}` : "";
    const dustMessage = dustGranted > 0 ? ` and ${dustGranted} Attunement Dust` : "";
    const markMessage = recycledRegion ? ` and 1 ${recycledRegion === "greenwood" ? "Greenwood" : "Mistfen"} Mark` : "";
    this.sendEquipmentAffixes(client);
    this.sendBlacksmithState(client, `Dismantled ${ITEM_DEFINITIONS[itemId].name} for ${recipe.gold} gold${materialMessage}${dustMessage}${markMessage}.`, "dismantled", 1, recipe.gold,
      undefined, undefined, { itemId, materialId, materialQuantity });
  }

  private handleBlacksmithReforge(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = BlacksmithReforgeSchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose owned equipment to reforge.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to reforge equipment.", "error");
    const itemId = parsed.data.itemId;
    if ((player.inventory.get(itemId)?.quantity ?? 0) <= 0) {
      return this.sendBlacksmithState(client, `You need ${ITEM_DEFINITIONS[itemId].name} in your pack before it can be reforged.`, "error");
    }
    const currentRank = equipmentReforgeRank(player.reforgeRanksJson, itemId);
    if (currentRank >= 3) return this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[itemId].name} is already Rank III.`, "error");
    const recipe = BLACKSMITH_REFORGE[itemId];
    const cost = recipe.costs[currentRank];
    if (!cost) return this.sendBlacksmithState(client, "That equipment cannot be reforged further.", "error");
    const material = player.inventory.get(recipe.materialId);
    if (player.coins < cost.gold || (material?.quantity ?? 0) < cost.material) {
      return this.sendBlacksmithState(client,
        `Rank ${["I", "II", "III"][currentRank]} needs ${cost.gold} gold and ${cost.material} ${ITEM_DEFINITIONS[recipe.materialId].name}.`, "error");
    }
    player.coins -= cost.gold;
    material!.quantity -= cost.material;
    player.reforgeRanksJson = withReforgeRank(player.reforgeRanksJson, itemId, currentRank + 1);
    void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    this.sendBlacksmithState(client,
      `${ITEM_DEFINITIONS[itemId].name} reforged to Rank ${["I", "II", "III"][currentRank]}.`, "reforged", 0, 0,
      undefined, undefined, undefined, itemId);
  }

  private handleBlacksmithAttune(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = AttunementForgeSchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose owned equipment and an attunement action.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to use the Attunement Forge.", "error");
    const { action, itemId, affixId } = parsed.data;
    if ((player.inventory.get(itemId)?.quantity ?? 0) <= 0) return this.sendBlacksmithState(client, `You need ${ITEM_DEFINITIONS[itemId].name} in your pack first.`, "error");
    const affixes = this.equipmentAffixes(player), offers = this.attunementOffers(player);
    const current = affixes[itemId];
    if (action === "choose") {
      const choices = offers[itemId] ?? [];
      if (!affixId || !choices.includes(affixId)) return this.sendBlacksmithState(client, "Choose one of the three boss attunements offered for that item.", "error");
      affixes[itemId] = { affixId, tier: 3 };
      delete offers[itemId];
      this.setEquipmentAttunements(player, affixes, this.attunementDust(player), offers);
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      const message = `${ITEM_DEFINITIONS[itemId].name} accepted ${affixId.toUpperCase()} · TIER 3.`;
      this.sendEquipmentAffixes(client, message);
      return this.sendBlacksmithState(client, message, "attuned");
    }
    if (action === "upgrade" && !current) return this.sendBlacksmithState(client, "Reroll this item once to reveal its first attunement.", "error");
    if (action === "upgrade" && current!.tier >= 3) return this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[itemId].name} already has a Tier 3 attunement.`, "error");
    const selectedPath = parseBuildPathState(player.huntLoadoutsJson).selectedPathId;
    const tier = current?.tier ?? 1;
    const cost = attunementDustCost(action, tier, Boolean(current && selectedPath
      && EQUIPMENT_AFFIXES[current.affixId].pathId === selectedPath));
    const dust = this.attunementDust(player);
    if (dust < cost) return this.sendBlacksmithState(client, `You need ${cost - dust} more Attunement Dust.`, "error");
    const upgradingToTier3 = action === "upgrade" && tier === 2;
    const moonstone = player.inventory.get("moonstone");
    if (upgradingToTier3 && (moonstone?.quantity ?? 0) < 1) return this.sendBlacksmithState(client, "Tier 3 requires 1 Moonstone from a major boss expedition.", "error");
    let next: EquipmentAffixRoll;
    if (action === "upgrade") next = { affixId: current!.affixId, tier: (tier + 1) as 2 | 3 };
    else {
      next = rollEquipmentAffix(selectedPath, tier);
      for (let attempt = 0; current && next.affixId === current.affixId && attempt < 8; attempt++) next = rollEquipmentAffix(selectedPath, tier);
      if (current && next.affixId === current.affixId) {
        const fallback = (Object.keys(EQUIPMENT_AFFIXES) as EquipmentAffixId[]).find(id => id !== current.affixId
          && (!selectedPath || EQUIPMENT_AFFIXES[id].pathId === selectedPath))
          ?? (Object.keys(EQUIPMENT_AFFIXES) as EquipmentAffixId[]).find(id => id !== current.affixId)!;
        next = { affixId: fallback, tier };
      }
    }
    if (upgradingToTier3) moonstone!.quantity -= 1;
    affixes[itemId] = next;
    this.setEquipmentAttunements(player, affixes, dust - cost, offers);
    void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    const message = action === "upgrade"
      ? `${ITEM_DEFINITIONS[itemId].name}'s ${next.affixId.toUpperCase()} attunement reached Tier ${next.tier}.`
      : `${ITEM_DEFINITIONS[itemId].name} rerolled to ${next.affixId.toUpperCase()} · TIER ${next.tier}.`;
    this.sendEquipmentAffixes(client, message);
    this.sendBlacksmithState(client, message, "attuned");
  }

  private handleLeaderForge(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = LeaderForgeSchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose a leader relic to forge.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to use the Leader Forge.", "error");
    const relicId = parsed.data.relicId as AreaLeaderRelicId;
    const recipe = LEADER_FORGE_RECIPES[relicId];
    const relic = player.inventory.get(relicId);
    const held = relic?.quantity ?? 0;
    const markOwned = (player.inventory.get(recipe.markId)?.quantity ?? 0) > 0;
    if (parsed.data.action === "exchange") {
      if (!markOwned) return this.sendBlacksmithState(client, `Awaken ${LEADER_FORGE_MARKS[recipe.markId].name} before exchanging spare relics.`, "error");
      if (held < 1) return this.sendBlacksmithState(client, `You have no spare ${ITEM_DEFINITIONS[relicId].name} to exchange.`, "error");
      if (player.coins + recipe.exchangeGold > 1_000_000) return this.sendBlacksmithState(client, "Your gold purse does not have room for the exchange.", "error");
      relic!.quantity -= 1;
      player.coins += recipe.exchangeGold;
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      return this.sendBlacksmithState(client, `Exchanged one ${ITEM_DEFINITIONS[relicId].name} for ${recipe.exchangeGold} gold.`, "exchanged", 1, recipe.exchangeGold);
    }
    if (markOwned) return this.sendBlacksmithState(client, `${LEADER_FORGE_MARKS[recipe.markId].name} is already awakened. Spare matching relics can be exchanged for gold.`, "error");
    if (held < recipe.relics) return this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[relicId].name}: ${held} / ${recipe.relics}. Defeat that leader again to complete the set.`, "error");
    if ((player.inventory.get(recipe.weaponId)?.quantity ?? 0) <= 0) {
      return this.sendBlacksmithState(client, `You need ${ITEM_DEFINITIONS[recipe.weaponId].name} in your pack before awakening it.`, "error");
    }
    relic!.quantity -= recipe.relics;
    let mark = player.inventory.get(recipe.markId);
    if (!mark) { mark = new InventoryItemState(); player.inventory.set(recipe.markId, mark); }
    mark.quantity = 1;
    void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    this.sendBlacksmithState(client,
      `${LEADER_FORGE_MARKS[recipe.markId].name} awakened. ${LEADER_FORGE_MARKS[recipe.markId].perk}.`, "awakened");
  }

  private handleRegionalForge(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = RegionalForgeSchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose a regional forge recipe.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to use Regional Forging.", "error");
    const region = parsed.data.region as RegionalForgeId;
    const recipe = REGIONAL_FORGE_RECIPES[region];
    const progress = region === "greenwood" ? this.greenwoodProgress(player) : this.mistfenProgress(player);
    const rank = region === "greenwood" ? greenwoodMasteryRank(progress.points, progress.discovered) : mistfenMasteryRank(progress.points, progress.discovered);
    if (rank < 3) return this.sendBlacksmithState(client, `${recipe.rankName} mastery is required to unlock this recipe.`, "error");
    if (progress.marks < recipe.marks) return this.sendBlacksmithState(client, `You need ${recipe.marks - progress.marks} more ${region === "greenwood" ? "Greenwood" : "Mistfen"} mark${recipe.marks - progress.marks === 1 ? "" : "s"}.`, "error");
    if (player.coins < recipe.gold) return this.sendBlacksmithState(client, `You need ${recipe.gold - player.coins} more gold.`, "error");
    for (const cost of recipe.materials) {
      const held = player.inventory.get(cost.itemId)?.quantity ?? 0;
      if (held < cost.quantity) return this.sendBlacksmithState(client, `You need ${cost.quantity - held} more ${ITEM_DEFINITIONS[cost.itemId].name}.`, "error");
    }
    if ((player.inventory.get(recipe.itemId)?.quantity ?? 0) >= 65_535) return this.sendBlacksmithState(client, "Your pack cannot hold another copy.", "error");
    player.coins -= recipe.gold;
    progress.marks -= recipe.marks;
    for (const cost of recipe.materials) player.inventory.get(cost.itemId)!.quantity -= cost.quantity;
    let item = player.inventory.get(recipe.itemId);
    if (!item) { item = new InventoryItemState(); player.inventory.set(recipe.itemId, item); }
    item.quantity += 1;
    if (region === "greenwood") this.setGreenwoodProgress(player, progress); else this.setMistfenProgress(player, progress);
    void this.persistPlayer(client.sessionId, player, true).catch(() => {});
    this.sendBlacksmithState(client, `${ITEM_DEFINITIONS[recipe.itemId].name} forged. Five victories converted into a guaranteed legendary.`, "regional-forged");
  }

  private handleBlacksmithForge(client: Client, payload: unknown): void {
    const parsed = BlacksmithForgeSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to forge equipment.", "error");
    const upgradeId = parsed.data.upgradeId as BlacksmithUpgradeId;
    if (upgradeId === "moonstone_edge") return this.sendBlacksmithState(client, "Complete The Silver Depths to unlock the Moonstone Edge.", "error");
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

  private handleDepthsRewardBuy(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const parsed = SilverDepthsRewardBuySchema.safeParse(payload);
    if (!player || !parsed.success) return this.sendBlacksmithState(client, "Choose a Silver Depths reward.", "error");
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to attune Moonstone.", "error");
    if (player.silverDepthsStage < 7) return this.sendBlacksmithState(client, "Complete The Silver Depths before attuning its rewards.", "error");
    const rewardId = parsed.data.rewardId;
    const moonstone = player.inventory.get("moonstone");
    const purchase = buyDepthsReward(player.blacksmithUpgrades, moonstone?.quantity ?? 0, rewardId);
    if (!purchase.bought) {
      const message = purchase.reason === "owned"
        ? `${SILVER_DEPTHS_REWARDS[rewardId].name} is already attuned.`
        : `You need ${SILVER_DEPTHS_REWARDS[rewardId].cost} Moonstone for ${SILVER_DEPTHS_REWARDS[rewardId].name}.`;
      return this.sendBlacksmithState(client, message, "error");
    }
    player.blacksmithUpgrades = purchase.flags;
    if (moonstone) moonstone.quantity = purchase.moonstone;
    void this.persistPlayer(client.sessionId, player, true);
    this.sendBlacksmithState(client, `${SILVER_DEPTHS_REWARDS[rewardId].name} attuned. ${SILVER_DEPTHS_REWARDS[rewardId].description}.`, "purchased", 0, 0, undefined, rewardId);
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
    if (this.roomKind === "overworld") {
      this.pendingWorldDeltaWrites.set(field, regrowAt === undefined ? String(block) : JSON.stringify({ block, regrowAt }));
      this.lastWorldDeltaRetryAt = Date.now();
      void this.flushWorldDeltaWrites();
    }
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
    if (this.roomKind !== "overworld") return Promise.resolve();
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
    const areaMiniBoss = areaMiniBossDefinition(mobId);
    mob.isMiniBoss = Boolean(areaMainMobDefinition(mobId));
    if (areaMiniBoss && !mob.isChampion) {
      const stats = wildernessEliteStats({ maxHealth: mob.maxHealth, damage: mob.attackDamage, armor: mob.armor,
        speedMultiplier: mob.speedMultiplier, rewardMultiplier: mob.rewardMultiplier });
      mob.health = mob.maxHealth = stats.maxHealth;
      mob.attackDamage = stats.damage;
      mob.armor = stats.armor;
      mob.speedMultiplier = stats.speedMultiplier;
      mob.rewardMultiplier = stats.rewardMultiplier;
      mob.attackPattern = areaLeaderPattern(archetypeId, 0, 1, mobId);
    }
    mob.name = CAVE_ENCOUNTERS[mobId]?.name ?? (roamingMembership(mobId) ? `Roaming ${mob.name}` : mob.name);
    if (mob.isChampion) mob.name = combatMobDefinition(mob).name;
    if (mobId === "frontier-brute") mob.name = "Frontier Stone Brute";
    if (isAshenSentry(mobId)) mob.name = "Ashglass Sentry";
    if (areaMiniBoss) mob.name = areaMiniBoss.name;
    this.mobBaseNames.set(mobId, mob.name);
    mob.level = enemyLevelForTier(mob.difficultyTier, mob.isChampion || mob.isElite || Boolean(areaMiniBoss), mobId === CRYSTAL_MATRIARCH_ID || mobId === "forest-guardian" || mobId === "forge-colossus");
    this.state.mobs.set(mobId, mob);
  }

  private readonly mobPositionAllowed = (position: { x: number; z: number }): boolean =>
    radiusFromSafeCenter(position) >= MOB_TOWN_MINIMUM_RADIUS - 0.001;

  private roamingAllowed(id: string, pose: { x: number; y: number; z: number }): boolean {
    if (id === REALM_WARDEN_ID) return pose.y >= 6.8 && pose.y <= 9.2 && isInRealmWardenArena(pose.x, pose.z);
    if (isInRealmWardenArena(pose.x, pose.z)) return false;
    if (SILVER_DEPTHS_CACHE_GUARD_IDS.includes(id)) {
      const iron = SILVER_DEPTHS_CACHE_GUARDS.iron.some(guard => guard.id === id);
      return pose.y >= .8 && pose.y <= 4.5 && pose.x >= 100 && pose.x <= 112
        && (iron ? pose.z >= -14 && pose.z <= 2 : pose.z >= 27 && pose.z <= 35);
    }
    if (EMBER_VAULT_MOBS.some(mob => mob.id === id)) return pose.y >= 7 && pose.y <= 9 && isInEmberVault(pose.x, pose.z);
    if (isGreenwoodCampMob(id)) return greenwoodCampAllows(pose);
    if (isGreenwoodEventFollower(id)) return isInGreenwoodRegion(pose.x, pose.z) && Math.abs(pose.y - 8) <= 1.5;
    if (isSilverGuard(id)) return silverGuardAllows(pose);
    if (isAshenSentry(id)) return ashenSentryAllows(pose);
    if (isMistfenMob(id)) return mistfenAllows(pose);
    if (isMistfenEventFollower(id)) return mistfenAllows(pose);
    if (isSouthernQuarryMob(id)) return southernQuarryAllows(pose);
    if (id === "frontier-brute") return frontierBruteAllows(pose);
    if (isMixedFrontierMob(id)) return mixedFrontierAllows(pose);
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
    return (id !== FRONTIER_CHAMPION_ID && id !== SILVER_CHAMPION_ID && !isRealmEventId(id)) || !home || Math.hypot(pose.x - home.x, pose.z - home.z) <= 12;
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
      .map(([id, peer]) => ({ id, x: peer.x, y: peer.y, z: peer.z, archetype: peer.archetype }));
    const spaced = spacedMobDesired(mobId, mob, desired, peers, mob.archetype);
    const next = navigateMob(mob, spaced, goal, navigation, now, this.readWorldBlock,
      pose => allowed(pose) && peers.every(peer => Math.hypot(pose.x - peer.x, pose.z - peer.z)
        >= Math.min(mobPersonalSpace(mob.archetype, peer.archetype), Math.hypot(mob.x - peer.x, mob.z - peer.z)) - .001)
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
    mob.level = enemyLevelForTier(band.tier);
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

  private openTemporaryForestPortal(now: number): boolean {
    if (this.state.portals.has("forest-entry") || this.forestDungeonActive) return false;
    this.forestDungeonUnlocked = true;
    // Repair the known arrival pad so the authoritative portal can never open over an excavation.
    for (let x = 45; x <= 46; x++) for (let z = 28; z <= 29; z++) {
      const a = worldToChunk(x, z), stored = this.getChunk(a.chunkX, a.chunkZ);
      if (getBlock(stored.chunk, a.localX, 7, a.localZ) !== Block.Air) continue;
      setBlock(stored.chunk, a.localX, 7, a.localZ, Block.Stone); stored.revision++;
      this.broadcast("block:changed", { requestId: "forest-pad", x, y: 7, z, block: Block.Stone, revision: stored.revision } satisfies BlockChanged);
    }
    const portal = new ForestPortalState();
    Object.assign(portal, FOREST_PORTAL_POSITION, { kind: "entry", expiresAt: now + FOREST_PORTAL_LIFETIME_MS });
    this.state.portals.set("forest-entry", portal);
    this.forestDungeonReopenAt = portal.expiresAt;
    return true;
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
    const masterTrialTag = this.masterTrialMobTags.get(mobId);
    this.masterTrialMobTags.delete(mobId);
    this.rangerSlows.delete(mobId);
    const wasElite = mob.isElite;
    const huntChampion = this.huntChampions.get(mobId);
    const realmRepeatVictory = mobId === REALM_WARDEN_ID && this.realmWardenRepeatActive;
    const defeatedGreenwoodEvent = mobId === WILDERNESS_EVENT_ID
      ? greenwoodEventDefinition(this.realmEvents.greenwoodVariant) : null;
    const defeatedMistfenEvent = mobId === MISTFEN_EVENT_ID
      ? mistfenEventDefinition(this.realmEvents.mistfenVariant) : null;
    for (const key of this.venomBuildup.keys()) if (key.endsWith(`:${mobId}`)) this.venomBuildup.delete(key);
    const credited = isRealmEventId(mobId)
      ? this.combatContributions.eligiblePersistent(mobId, mob, this.state.players)
      : this.combatContributions.eligible(mobId, mob, this.state.players, now);
    // A long solo fight can age its early hits out of the contribution window.
    // Never turn an actual killing blow into a rewardless defeat when nobody
    // else qualified; the caller has already validated the hit and attacker.
    const fallbackKiller = this.state.players.get(attackerId);
    const creditedOrKiller = credited.length || !fallbackKiller || fallbackKiller.health <= 0
      ? credited : [attackerId];
    const baseRecipients = mobId === CRYSTAL_MATRIARCH_ID && this.roomKind === "silver-depths"
      ? [...new Set([...creditedOrKiller, ...this.activeSilverDepthsParticipants()])]
      : creditedOrKiller;
    const huntOwner = huntChampion ? this.state.players.get(huntChampion.ownerId) : undefined;
    const recipients = huntChampion && huntOwner?.health && Math.abs(huntOwner.y - mob.y) <= 2.5
      && Math.hypot(huntOwner.x - mob.x, huntOwner.z - mob.z) <= 45
      ? [...new Set([...baseRecipients, huntChampion.ownerId])] : baseRecipients;
    this.combatContributions.clear(mobId);
    if ((SILVER_DEPTHS_GUARDS as readonly string[]).includes(mobId) || mobId === CRYSTAL_MATRIARCH_ID) {
      for (const playerId of recipients) {
        const run = this.silverDepthsRuns.get(playerId);
        if (!run || run.completedAt > 0) continue;
        run.enemiesDefeated++;
        if (mobId === CRYSTAL_MATRIARCH_ID) run.completedAt = now;
      }
    }
    if (EMBER_VAULT_MOBS.some(candidate => candidate.id === mobId)) {
      for (const playerId of recipients) {
        const run = this.emberVaultRuns.get(playerId);
        if (!run || run.completedAt > 0) continue;
        run.enemiesDefeated++;
        if (mobId === "forge-colossus") run.completedAt = now;
      }
    }
    const definition = combatMobDefinition(mob);
    const recipientsWithLoot = new Set<string>();
    if (!SILVER_DEPTHS_CACHE_GUARD_IDS.includes(mobId)) for (const playerId of recipients) {
      const fixedReward = mob.isChampion || mob.isElite || isAreaMiniBoss(mobId) || isSilverGuard(mobId) || mobId === "buried-chamber-brute"
        || mobId === CRYSTAL_MATRIARCH_ID || mobId === "forge-colossus" || isRealmEventId(mobId);
      const cadenceId = this.profileTokens.get(playerId) ?? playerId;
      if (!fixedReward && !this.normalLootCadence.record(cadenceId, Math.random())) continue;
      this.spawnLootDrops(mobId, mob, now, playerId);
      recipientsWithLoot.add(playerId);
    }
    if (mobId === REALM_WARDEN_ID) for (const playerId of recipients) {
      const player = this.state.players.get(playerId);
      if (!player) continue;
      const firstClear = !player.realmWardenCleared;
      player.realmWardenCleared = true;
      if (firstClear) this.clients.find(client => client.sessionId === playerId)?.send("chat:notice",
        "FIRST REALM CLEAR · the permanent Warden Gate has awakened at the south edge of the court.");
    }
    if (mobId === "buried-chamber-brute") for (const playerId of recipients) this.advanceFirstExpedition(playerId, "defeated_warden");
    this.advanceSilverDepthsEncounter(mobId);
    if (mobId === CRYSTAL_MATRIARCH_ID) {
      for (const playerId of recipients) {
        this.advanceSilverDepthsExpedition(playerId, "defeated_matriarch");
        const player = this.state.players.get(playerId);
        if (player) {
          const hasNewEdge = [...this.state.lootDrops.values()].some(drop => drop.ownerId === playerId && drop.itemId === "matriarch_edge");
          const alreadyOwnsEdge = (player.inventory.get("matriarch_edge")?.quantity ?? 0) + (player.storage.get("matriarch_edge")?.quantity ?? 0) > 0;
          player.silverDepthsRunStage = !hasNewEdge && alreadyOwnsEdge ? 7 : 6;
        }
      }
      if (!this.state.portals.has("depths-return")) {
        const returnPortal = new ForestPortalState();
        Object.assign(returnPortal, SILVER_DEPTHS_EXIT_POSITION, { kind: "return" });
        this.state.portals.set("depths-return", returnPortal);
      }
    }
    if (mobId === "forge-colossus" && !this.state.portals.has("ember-return")) {
      const returnPortal = new ForestPortalState();
      Object.assign(returnPortal, EMBER_VAULT_EXIT, { kind: "return" });
      this.state.portals.set("ember-return", returnPortal);
    }
    mob.alive = false;
    if (mob.isMiniBoss) {
      this.restoreMiniBossArena(mobId);
      this.areaLeaderPhases.delete(mobId);
      this.miniBossEngagedAt.delete(mobId);
      this.miniBossOrbitPressure.delete(mobId);
    }
    if (isRealmEventId(mobId)) this.realmBossPhases.delete(mobId);
    this.openAreaLeaderAfterFollowerDefeat(mobId, now);
    const areaMainMob = areaMainMobDefinition(mobId);
    if (areaMainMob) this.leaderDefeats.set(mobId, Math.min(5, (this.leaderDefeats.get(mobId) ?? 0) + 1));
    if (areaMainMob) for (const playerId of recipients) {
      const rematch = leaderRematch(mobId, mob.leaderRematchTier);
      this.clients.find(client => client.sessionId === playerId)?.send("objective:completed", {
        objectiveId: `area-main-${mobId}`,
        title: `${mob.leaderRematchTier > 0 ? `Empowered ${areaMainMob.name}` : areaMainMob.name} Defeated`,
        rewardLabel: `${areaMainMob.rewardLabel} · ${ITEM_DEFINITIONS[areaMainMob.rewardItemId].name} · ${rematch.rewardLabel}`,
        coinsGranted: 0,
      } satisfies WorldObjectiveCompleted);
    }
    if (areaMainMob) for (const playerId of recipients) this.advancePlayerHuntContract(playerId, mobId, mob, now);
    if (huntChampion) this.advancePlayerHuntContract(huntChampion.ownerId, mobId, mob, now);
    if (SILVER_DEPTHS_CACHE_GUARD_IDS.includes(mobId)) this.advanceSilverDepthsCacheAmbush();
    if (mobId === CRYSTAL_MATRIARCH_ID && this.roomKind === "silver-depths") this.broadcastSilverDepthsPartyStatus();
    this.delayedMatriarchVolleys.delete(mobId);
    this.mobProgress.delete(mobId); this.mobUnreachableUntil.delete(mobId); this.mobReturning.delete(mobId);
    mob.awarenessState = "patrol"; mob.alertUntil = 0;
    this.mobAwareness.delete(mobId);
    this.crawlerPositioning.delete(mobId);
    this.crawlerRushes.delete(mobId);
    this.championCharges.delete(mobId);
    this.clearMobAttackTimeline(mob);
    this.pendingMobMelee.delete(mobId);
    mob.materializeUntil = 0;
    this.empoweredContractTargets.delete(mobId);
    this.empoweredContractDifficulties.delete(mobId);
    const usesOverworldRhythm = this.roomKind === "overworld" && usesOverworldRespawnRhythm(mobId, mob.isChampion);
    mob.respawnAt = huntChampion ? now + 5_000
      : now + (usesOverworldRhythm ? wildernessRespawnDelay(mobId, mob.level) : definition.respawnMs);
    if (isGreenwoodEventFollower(mobId) || isMistfenEventFollower(mobId)) mob.respawnAt = Number.MAX_SAFE_INTEGER;
    const leaderProgress = areaMainMob && this.roomKind === "overworld" ? this.realmEvents.recordLeader(mobId, now) : null;
    if (leaderProgress?.credited) {
      for (const playerId of recipients) this.clients.find(client => client.sessionId === playerId)?.send("chat:notice",
        leaderProgress.bossArmed
          ? `REALM THREAT ${leaderProgress.completed}/${leaderProgress.required} · the Realm Stone Warden awakens in 8 seconds.`
          : `REALM THREAT ${leaderProgress.completed}/${leaderProgress.required} · ${areaMainMob?.name ?? mob.name} defeated. Explore onward; the next nearby leader appears as you approach.`);
      this.broadcastRealmEvent(now);
    }
    const armedEvent = this.realmEvents.recordTrigger(mobId, now,
      [...this.state.mobs].filter(([id, candidate]) => candidate.alive && isRealmEventId(id)).map(([id]) => id));
    if (armedEvent) {
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        if (armedEvent.key !== "greenwood" && armedEvent.key !== "mistfen"
          && player && Math.abs(player.y - armedEvent.position.y) <= 2.5
          && Math.hypot(player.x - armedEvent.position.x, player.z - armedEvent.position.z) <= REALM_EVENT_TRACKING_RADIUS)
          client.send("chat:notice", `Public event incoming · ${armedEvent.name} arrives in 8 seconds. Follow the marker and gather nearby!`);
      }
      this.broadcastRealmEvent(now);
    }
    if (wasElite) {
      const eliteProgress = this.realmEvents.recordElite(now);
      for (const playerId of recipients) this.clients.find(client => client.sessionId === playerId)?.send("chat:notice", eliteProgress.bossArmed
        ? "ELITE HUNT COMPLETE · the Realm Stone Warden awakens in 8 seconds. Rally at the marker!"
        : eliteProgress.eliteKills === 0
          ? "ELITE DEFEATED · bonus Realm Threat gained. Your improved personal loot has landed."
          : `ELITE DEFEATED · ${eliteProgress.eliteKills}/${eliteProgress.eliteRequired} toward bonus Realm Threat. Improved personal loot has landed.`);
      this.broadcastRealmEvent(now);
    }
    if (this.forestPortalCycle.record(mobId, now) && !this.state.portals.has("forest-entry") && !this.forestDungeonActive) {
      this.openTemporaryForestPortal(now);
    }
    if (isRealmEventId(mobId)) {
      const completion = realmRepeatVictory ? null : this.realmEvents.complete(mobId, now);
      const opened = completion?.definition.opensForestPortal ? this.openTemporaryForestPortal(now) : false;
      if (mobId === WILDERNESS_EVENT_ID) this.clearGreenwoodEventFollowers();
      if (mobId === MISTFEN_EVENT_ID) this.clearMistfenEventFollowers();
      if (realmRepeatVictory) {
        this.realmWardenRepeatActive = false;
        this.realmWardenRepeatAvailableAt = now + 60_000;
        this.broadcast("realm:repeat", { active: false });
        for (const playerId of recipients) this.clients.find(client => client.sessionId === playerId)?.send("chat:notice",
          "ASCENDANT WARDEN DEFEATED · enhanced personal caches have landed. The Warden Gate recovers for 60 seconds.");
      }
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        if (!player || !completion || completion.definition.key === "greenwood" || completion.definition.key === "mistfen"
          || Math.abs(player.y - completion.definition.position.y) > 2.5
          || Math.hypot(player.x - completion.definition.position.x, player.z - completion.definition.position.z) > REALM_EVENT_TRACKING_RADIUS) continue;
        client.send("chat:notice", completion.realmCleared
          ? "REALM CLEARED · personal victory caches have landed. The regional threat cycle has reset."
          : completion.realmBossArmed
            ? "REGIONAL THREATS DEFEATED · the Realm Stone Warden awakens in 8 seconds. Rally at the new marker!"
            : opened
              ? `Public event complete · personal loot has landed and the Forest Dungeon portal is open for ${Math.round(FOREST_PORTAL_LIFETIME_MS / 1000)} seconds.`
              : "Public event complete · personal loot has landed. Realm threat has increased.");
      }
      this.broadcastRealmEvent(now);
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
      const thiefRank = parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "thief" ? this.buildPathRankFor(player, "thief") : 0;
      const plunderer = this.buildSpecializationFor(player, "thief") === "plunderer";
      const plundererGold = plunderer && (Boolean(areaMainMob) || wasElite || mob.isChampion)
        ? this.buildSpecializationMastered(player, "plunderer") ? 5 : 3 : 0;
      const prosperousGold = thiefRank > 0 && (Boolean(areaMainMob) || wasElite || mob.isChampion)
        ? this.equipmentAffixTier(player, "prosperous") : 0;
      const coinsGranted = (Boolean(areaMainMob) ? 5 + Math.ceil(mob.leaderRematchTier / 2) : wasElite ? 5 : 2)
        + (thiefRank > 0 ? Math.min(2, Math.ceil(thiefRank / 2)) : 0) + plundererGold + prosperousGold;
      player.coins = Math.min(1_000_000, player.coins + coinsGranted);
      if (plundererGold > 0) this.grantMasterTrial(playerId, "plunderer", plundererGold);
      this.grantProgression(playerId, mobExperience(mob.archetype, mob.rewardMultiplier, mob.isChampion || wasElite, player.level, mob.level), mob.name);
      this.grantBuildProgress(playerId, mobId === "mistfen-behemoth" ? 5 : Boolean(areaMainMob) || mob.isChampion || wasElite ? 3 : 1);
      if (isMistfenMob(mobId)) this.grantMistfenMastery(playerId, mobId === "mistfen-behemoth" ? 18 : 3);
      else if (isMistfenEventFollower(mobId)) this.grantMistfenMastery(playerId, 4);
      else if (mobId === MISTFEN_EVENT_ID) this.grantMistfenMastery(playerId,
        defeatedMistfenEvent?.masteryReward ?? 15);
      if (isGreenwoodCampMob(mobId)) this.grantGreenwoodMastery(playerId, mobId === "wild-crawler" ? 18 : 3);
      else if (isGreenwoodEventFollower(mobId)) this.grantGreenwoodMastery(playerId, 4);
      else if (mobId === WILDERNESS_EVENT_ID) this.grantGreenwoodMastery(playerId,
        defeatedGreenwoodEvent?.masteryReward ?? 14);
      if (mobId === MISTFEN_EVENT_ID) this.grantRegionalMark(playerId, "mistfen");
      if (mobId === WILDERNESS_EVENT_ID) this.grantRegionalMark(playerId, "greenwood");
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
      this.clients.find(client => client.sessionId === playerId)?.send("chat:notice", recipientsWithLoot.has(playerId)
        ? "Kill contribution credited · your personal loot is on the ground. Press E beside each drop before it expires."
        : `Kill contribution credited · +${coinsGranted} gold and XP. No item drop this time.`);
    }
    if (masterTrialTag && masterTrialTag.playerId === attackerId && now <= masterTrialTag.until)
      this.grantMasterTrial(attackerId, masterTrialTag.specializationId);
  }

  private openAreaLeaderAfterFollowerDefeat(followerId: string, now: number): void {
    const leaderId = leaderForFollower(followerId);
    const leader = leaderId ? this.state.mobs.get(leaderId) : undefined;
    if (!leaderId || !leader?.alive) return;
    leader.combatState = "recover";
    leader.stateUntil = Math.max(leader.stateUntil, now + 2_500);
    leader.targetId = "";
    leader.aimCommitted = false;
    this.pendingMobMelee.delete(leaderId);
    this.mobCommittedAim.delete(leaderId);
    this.clearMobAttackTimeline(leader);
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      if (projectile.mobId !== leaderId) continue;
      this.pendingMobProjectiles.delete(projectileId);
      this.resolveProjectileVisual(projectileId, projectile.position, "miss");
    }
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.health <= 0 || Math.abs(player.y - leader.y) > 2.5
        || Math.hypot(player.x - leader.x, player.z - leader.z) > 28) continue;
      client.send("leader:exposed", { mobId: leaderId, durationMs: 2_500 } satisfies AreaLeaderExposed);
    }
  }

  private enterAreaLeaderPhase(leaderId: string, leader: MobState, previous: AreaLeaderPhase, phase: AreaLeaderPhase, now: number): void {
    const awareness = this.mobAwareness.get(leaderId);
    const targetId = leader.targetId || awareness?.targetId || "";
    leader.enraged = leader.enraged || phase === 3;
    leader.combatState = "recover";
    leader.stateUntil = now + (phase === 3 ? 1_400 : 1_200);
    leader.targetId = "";
    leader.aimCommitted = false;
    this.pendingMobMelee.delete(leaderId);
    this.mobCommittedAim.delete(leaderId);
    this.crawlerRushes.delete(leaderId);
    this.delayedMatriarchVolleys.delete(leaderId);
    this.clearMobAttackTimeline(leader);
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      if (projectile.mobId !== leaderId) continue;
      this.pendingMobProjectiles.delete(projectileId);
      this.resolveProjectileVisual(projectileId, projectile.position, "miss");
    }
    this.erodeMiniBossArenaCover(leaderId, phase);
    this.placeMiniBossArenaPressure(leaderId, leader, phase, now);
    if (leaderId === "wild-crawler" && leader.leaderModifier === "rootslayer") {
      for (const followerId of AREA_LEADER_FOLLOWERS[leaderId] ?? []) {
        const follower = this.state.mobs.get(followerId);
        if (follower && !follower.alive) { follower.respawnAt = now; follower.materializeUntil = 0; }
      }
    }
    const target = targetId ? this.state.players.get(targetId) : undefined;
    if (!target?.health) return;
    const followers = (AREA_LEADER_FOLLOWERS[leaderId] ?? [])
      .map(id => [id, this.state.mobs.get(id)] as const)
      .filter((entry): entry is readonly [string, MobState] => Boolean(entry[1]?.alive));
    const rallyCount = phase === 2 && previous === 1 ? 1 : followers.length;
    for (const [followerId, follower] of followers.slice(0, rallyCount)) {
      const followerAwareness = this.mobAwareness.get(followerId) ?? createMobAwareness();
      provokeMob(followerAwareness, { id: targetId, x: target.x, y: target.y, z: target.z, health: target.health }, now);
      this.mobAwareness.set(followerId, followerAwareness);
      follower.awarenessState = "engaged";
      follower.alertUntil = now + 900;
    }
  }

  private enterRealmBossPhase(mobId: string, mob: MobState, phase: RealmBossPhase, now: number): void {
    mob.enraged = phase >= 2;
    mob.combatState = "recover";
    mob.stateUntil = now + (phase === 3 ? 1_700 : 1_400);
    mob.targetId = "";
    mob.aimCommitted = false;
    this.pendingMobMelee.delete(mobId);
    this.mobCommittedAim.delete(mobId);
    this.delayedMatriarchVolleys.delete(mobId);
    this.clearMobAttackTimeline(mob);
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      if (projectile.mobId !== mobId) continue;
      this.pendingMobProjectiles.delete(projectileId);
      this.resolveProjectileVisual(projectileId, projectile.position, "miss");
    }
    for (let index = this.realmBossPendingHazards.length - 1; index >= 0; index--) {
      if (this.realmBossPendingHazards[index]!.mobId === mobId) this.realmBossPendingHazards.splice(index, 1);
    }
  }

  private sendObjectiveState(client: Client, force = false): void {
    this.ensureFirstExpeditionReward(client, Date.now());
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    this.empowerPlayerHuntTarget(client.sessionId);
    if (player.miningExpeditionStage === 1 && isInsideEastMine(player)) this.advanceFirstExpedition(client, "entered_mine");
    if (player.silverDepthsStage === 1 && isInsideSilverDepths(player)) this.advanceSilverDepthsExpedition(client, "entered_depths");
    const progress = this.objectiveProgress.get(client.sessionId) ?? createObjectiveProgress();
    this.objectiveProgress.set(client.sessionId, progress);
    const now = Date.now();
    let update = nearbyObjective(client.sessionId, player, this.state.mobs, this.state.portals, this.state.lootDrops, now, progress.id, this.realmEvents.status(now), this.roomKind);
    const selectedHuntId = this.selectedRealmHunts.get(client.sessionId) ?? "";
    const selectedHunt = this.state.mobs.get(selectedHuntId);
    const selectedDefinition = areaMainMobDefinition(selectedHuntId);
    const selectedChampion = this.huntChampions.get(selectedHuntId);
    const huntContract = this.huntContracts.get(client.sessionId);
    const selectedName = selectedDefinition?.name ?? selectedChampion?.name;
    if (this.roomKind === "overworld" && selectedHunt?.alive && selectedName
      && Math.abs(player.y - selectedHunt.y) <= 2.5
      && Math.hypot(player.x - selectedHunt.x, player.z - selectedHunt.z) <= 42
      && update.kind !== "loot" && update.kind !== "portal") {
      const rematchLabel = huntContract && huntContract.targetMobId === selectedHuntId
        ? huntContract.championActive
          ? `PATH CHAMPION · ${huntContract.modifier.toUpperCase()}`
          : `CONTRACT ${huntContract.step + 1}/${huntContract.targets.length} · ${huntContract.modifier.toUpperCase()}`
        : selectedHunt.leaderRematchTier > 0
        ? `${selectedHunt.leaderModifier.toUpperCase()} · REMATCH ${selectedHunt.leaderRematchTier}` : "ACTIVE HUNT";
      update = {
        kind: "hunt", showMarker: true, objectiveId: `realm-hunt-${selectedHuntId}`,
        title: selectedName,
        detail: selectedChampion ? `${HUNT_PATHS[selectedChampion.pathId].name} · final champion`
          : `Tracked leader · ${leaderTerritory(selectedHuntId)}`,
        lootHint: selectedChampion ? "Large personal champion cache · guaranteed path weapon"
          : `${ITEM_DEFINITIONS[selectedDefinition!.rewardItemId].name} · guaranteed leader relic`,
        tier: selectedHunt.difficultyTier, recommendedLevel: `LV ${selectedHunt.level}`,
        targetMobId: selectedHuntId, targetMobIds: [selectedHuntId], completedMobIds: [],
        progressLabel: rematchLabel,
        targetX: selectedHunt.x, targetY: selectedHunt.y, targetZ: selectedHunt.z,
      };
    }
    const signatureItemId: SignatureItemId | null = update.objectiveId.includes("depths-matriarch") || update.objectiveId === "depths-recover"
      ? "matriarch_edge"
      : update.objectiveId === "greenwood-event" ? "venom_focus" : null;
    if (signatureItemId) {
      const ownsSignature = (player.inventory.get(signatureItemId)?.quantity ?? 0) + (player.storage.get(signatureItemId)?.quantity ?? 0) > 0;
      update.lootHint = signatureLootHint(signatureItemId, ownsSignature, parseSignaturePity(player.signaturePityJson));
    } else if (update.objectiveId === "mistfen-event") {
      const mistfen = this.mistfenProgress(player);
      const rank = mistfenMasteryRank(mistfen.points, mistfen.discovered);
      update.lootHint = rank >= 3
        ? "Mirebreaker cache · acid, silver, healing supplies · Legendary mantle chance"
        : "Mistfen cache · acid glands, silver and healing supplies";
    } else if (update.kind === "loot") {
      const signatureDrop = [...this.state.lootDrops.values()].find(drop => drop.ownerId === client.sessionId
        && (drop.itemId === "matriarch_edge" || drop.itemId === "venom_focus") && Date.now() < drop.expiresAt);
      if (signatureDrop) update.lootHint = "LEGENDARY · Guaranteed personal drop ready to claim";
    }
    const fingerprint = JSON.stringify({ ...update, targetX: Math.round(update.targetX), targetY: Math.round(update.targetY), targetZ: Math.round(update.targetZ) });
    if (!force && fingerprint === progress.fingerprint) return;
    progress.id = update.objectiveId; progress.fingerprint = fingerprint;
    client.send("objective:update", update satisfies WorldObjectiveUpdate);
  }

  private ensureFirstExpeditionReward(client: Client, now: number): void {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.miningExpeditionStage !== 6) return;
    const ownsLantern = (player.inventory.get("miners_lantern")?.quantity ?? 0)
      + (player.storage.get("miners_lantern")?.quantity ?? 0) > 0;
    const pendingLantern = [...this.state.lootDrops.values()].some(drop => drop.ownerId === client.sessionId
      && drop.itemId === "miners_lantern" && now < drop.expiresAt);
    if (ownsLantern || pendingLantern) return;
    const dropId = `first-expedition-lantern:${client.sessionId}`;
    const drop = new LootDropState();
    Object.assign(drop, CAVE_HIDDEN_HOME, { y: CAVE_HIDDEN_HOME.y + .22, ownerId: client.sessionId,
      itemId: "miners_lantern", quantity: 1,
      contentsJson: encodeLootBagItems([{ itemId: "miners_lantern", quantity: 1 }]), expiresAt: now + LOOT_DESPAWN_MS });
    this.state.lootDrops.set(dropId, drop);
    client.send("loot:spawned", { dropId, ownerId: drop.ownerId, itemId: drop.itemId, quantity: drop.quantity, contentsJson: drop.contentsJson,
      x: drop.x, y: drop.y, z: drop.z, expiresAt: drop.expiresAt });
    client.send("chat:notice", "Stone Warden reward restored · collect your personal Miner's Lantern in the buried chamber.");
  }

  private refreshNearbyObjectives(): void {
    // Guidance is local context, not a quest chain with extra completion bonuses.
    for (const client of this.clients) this.sendObjectiveState(client);
  }

  private advanceRealmEvent(now: number): void {
    const definition = this.realmEvents.release(now);
    if (!definition) return;
    const nearby = [...this.state.players.values()].filter(player => player.health > 0
      && Math.abs(player.y - definition.position.y) <= 2.5
      && Math.hypot(player.x - definition.position.x, player.z - definition.position.z) <= REALM_EVENT_SCALING_RADIUS);
    const scale = realmEventScale(nearby.length, definition);
    const greenwoodVariant = definition.key === "greenwood" ? this.realmEvents.greenwoodVariant : null;
    const greenwoodScale = greenwoodVariant
      ? greenwoodEventScale(greenwoodVariant, nearby.length, Math.max(1, ...nearby.map(player => player.level))) : null;
    const mistfenVariant = definition.key === "mistfen" ? this.realmEvents.mistfenVariant : null;
    const mistfenScale = mistfenVariant
      ? mistfenEventScale(mistfenVariant, nearby.length, Math.max(1, ...nearby.map(player => player.level))) : null;
    const regionalScale = greenwoodScale ?? mistfenScale;
    this.registerMob(definition.id, definition.archetype, definition.position);
    const mob = this.state.mobs.get(definition.id)!;
    const greenwoodEvent = greenwoodEventDefinition(greenwoodVariant);
    const mistfenEvent = mistfenEventDefinition(mistfenVariant);
    mob.name = greenwoodEvent?.name ?? mistfenEvent?.name ?? definition.name;
    mob.isChampion = true;
    mob.health = mob.maxHealth = Math.ceil(scale.maxHealth * (regionalScale?.healthMultiplier ?? 1));
    mob.attackPattern = mistfenVariant ? mistfenEventPattern(mistfenVariant, 0, mob.health, mob.maxHealth)
      : greenwoodVariant === "root-nest" ? "double-fan"
      : greenwoodVariant === "alpha-ambush" ? "venom-ring"
      : definition.archetype === "cave_spitter" ? "aimed" : "rocks";
    mob.attackDamage = Math.max(mob.attackDamage, scale.attackDamage + (regionalScale?.damageBonus ?? 0));
    mob.speedMultiplier *= regionalScale?.speedMultiplier ?? 1;
    mob.rewardMultiplier *= scale.rewardMultiplier * (regionalScale?.rewardMultiplier ?? 1);
    mob.level = Math.max(enemyLevelForTier(mob.difficultyTier, true, true), regionalScale?.level ?? 1);
    if (greenwoodVariant && greenwoodScale) this.spawnGreenwoodEventFollowers(greenwoodVariant, greenwoodScale, definition.position, now);
    if (mistfenVariant && mistfenScale) this.spawnMistfenEventFollowers(mistfenVariant, mistfenScale, definition.position, now);
    if (definition.realmBoss) {
      this.realmRewardLandingIndex = 0;
      this.realmBossEmptySince = 0;
      mob.materializeUntil = now + 2_500;
      mob.combatState = "recover";
      mob.stateUntil = mob.materializeUntil;
      this.realmBossPhases.set(definition.id, 1);
    }
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      const trackingRadius = greenwoodVariant ? GREENWOOD_EVENT_TRACKING_RADIUS : mistfenVariant ? MISTFEN_EVENT_TRACKING_RADIUS
        : definition.realmBoss ? REALM_BOSS_TRACKING_RADIUS : REALM_EVENT_TRACKING_RADIUS;
      if (player && Math.abs(player.y - definition.position.y) <= 2.5
        && Math.hypot(player.x - definition.position.x, player.z - definition.position.z) <= trackingRadius)
        if (definition.realmBoss) client.send("chat:notice", `REALM BOSS live · ${definition.name} scaled for ${scale.players} adventurer${scale.players === 1 ? "" : "s"}. Deal damage to qualify for personal loot.`);
    }
    this.broadcastRealmEvent(now);
    this.refreshNearbyObjectives();
  }

  /** Kept for focused legacy tests while the one-off wilderness event migrates to the realm director. */
  private advanceWildernessEvent(now: number): void { this.advanceRealmEvent(now); }

  private clearGreenwoodEventFollowers(): void {
    for (const [id] of this.state.mobs) {
      if (!isGreenwoodEventFollower(id)) continue;
      this.state.mobs.delete(id); this.mobHomes.delete(id); this.mobNavigation.delete(id);
      this.mobAwareness.delete(id); this.mobBaseNames.delete(id); this.combatContributions.clear(id);
      this.pendingMobMelee.delete(id); this.mobCommittedAim.delete(id); this.crawlerRushes.delete(id);
    }
  }

  private spawnGreenwoodEventFollowers(variant: GreenwoodEventKind,
    scale: ReturnType<typeof greenwoodEventScale>, center: { x: number; y: number; z: number }, now: number): void {
    this.clearGreenwoodEventFollowers();
    for (const follower of greenwoodEventFollowers(variant, scale.followerCount, center)) {
      this.registerMob(follower.id, follower.archetype, follower);
      const mob = this.state.mobs.get(follower.id)!;
      mob.name = follower.name; mob.isElite = true; mob.eliteKind = "stalker";
      mob.health = mob.maxHealth = Math.ceil(mob.maxHealth * (1.05 + (scale.healthMultiplier - 1) * .65));
      mob.attackDamage = Math.max(1, mob.attackDamage + scale.damageBonus);
      mob.speedMultiplier *= scale.speedMultiplier;
      mob.rewardMultiplier *= 1.35 * scale.rewardMultiplier;
      mob.level = Math.max(mob.level, scale.level);
      mob.attackPattern = wildernessElitePattern(follower.archetype, 0);
      mob.materializeUntil = now + 1_500; mob.combatState = "recover"; mob.stateUntil = mob.materializeUntil;
    }
    if (variant === "root-nest") this.placeHuntChampionPincer(WILDERNESS_EVENT_ID, center, 0, "ascendant", now);
  }

  private clearMistfenEventFollowers(): void {
    for (const [id] of this.state.mobs) {
      if (!isMistfenEventFollower(id)) continue;
      this.state.mobs.delete(id); this.mobHomes.delete(id); this.mobNavigation.delete(id);
      this.mobAwareness.delete(id); this.mobBaseNames.delete(id); this.combatContributions.clear(id);
      this.pendingMobMelee.delete(id); this.mobCommittedAim.delete(id); this.championCharges.delete(id);
      this.crawlerRushes.delete(id);
    }
  }

  private spawnMistfenEventFollowers(variant: MistfenEventKind,
    scale: ReturnType<typeof mistfenEventScale>, center: { x: number; y: number; z: number }, now: number): void {
    this.clearMistfenEventFollowers();
    for (const follower of mistfenEventFollowers(variant, scale.followerCount, center)) {
      this.registerMob(follower.id, follower.archetype, follower);
      const mob = this.state.mobs.get(follower.id)!;
      mob.name = follower.name; mob.isElite = true; mob.eliteKind = variant === "toxic-bloom" ? "venomous" : "stalker";
      mob.health = mob.maxHealth = Math.ceil(mob.maxHealth * (1.08 + (scale.healthMultiplier - 1) * .65));
      mob.attackDamage = Math.max(1, mob.attackDamage + scale.damageBonus);
      mob.speedMultiplier *= scale.speedMultiplier;
      mob.rewardMultiplier *= 1.4 * scale.rewardMultiplier;
      mob.level = Math.max(mob.level, scale.level);
      mob.attackPattern = follower.archetype === "stone_brute" ? "bog-charge" : wildernessElitePattern(follower.archetype, 0);
      mob.materializeUntil = now + 1_500; mob.combatState = "recover"; mob.stateUntil = mob.materializeUntil;
    }
  }

  private advanceRealmBossAbandonment(now: number): void {
    const mob = this.state.mobs.get(REALM_WARDEN_ID);
    if ((this.realmEvents.phase !== "active" && !this.realmWardenRepeatActive) || !mob?.alive) { this.realmBossEmptySince = 0; return; }
    const participantPresent = [...this.state.players.values()].some(player => player.health > 0
      && Math.abs(player.y - REALM_WARDEN_HOME.y) <= 2.5 && isInRealmWardenArena(player.x, player.z));
    if (participantPresent) { this.realmBossEmptySince = 0; return; }
    if (!this.realmBossEmptySince) { this.realmBossEmptySince = now; return; }
    if (now - this.realmBossEmptySince < 12_000) return;
    if (!this.realmWardenRepeatActive && !this.realmEvents.abandon(REALM_WARDEN_ID, now)) return;
    if (this.realmWardenRepeatActive) {
      this.realmWardenRepeatActive = false;
      this.realmWardenRepeatAvailableAt = now + 15_000;
      this.broadcast("realm:repeat", { active: false });
    }
    this.realmBossEmptySince = 0;
    this.state.mobs.delete(REALM_WARDEN_ID);
    this.mobHomes.delete(REALM_WARDEN_ID);
    this.mobNavigation.delete(REALM_WARDEN_ID);
    this.mobAwareness.delete(REALM_WARDEN_ID);
    this.pendingMobMelee.delete(REALM_WARDEN_ID);
    this.mobCommittedAim.delete(REALM_WARDEN_ID);
    this.delayedMatriarchVolleys.delete(REALM_WARDEN_ID);
    this.realmBossPhases.delete(REALM_WARDEN_ID);
    this.combatContributions.clear(REALM_WARDEN_ID);
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      if (projectile.mobId !== REALM_WARDEN_ID) continue;
      this.pendingMobProjectiles.delete(projectileId);
      this.resolveProjectileVisual(projectileId, projectile.position, "miss");
    }
    for (let index = this.realmBossPendingHazards.length - 1; index >= 0; index--)
      if (this.realmBossPendingHazards[index]!.mobId === REALM_WARDEN_ID) this.realmBossPendingHazards.splice(index, 1);
    this.broadcast("chat:notice", "REALM WARDEN WITHDREW · the empty arena has reset. It will awaken again shortly.");
    this.broadcastRealmEvent(now);
    this.refreshNearbyObjectives();
  }

  private spawnLootDrops(mobId: string, mob: MobState, now: number, ownerId = ""): void {
    if (mobId === "forest-guardian") return;
    const rewardPlayer = ownerId ? this.state.players.get(ownerId) : undefined;
    const areaReward = areaMainMobDefinition(mobId);
    const huntChampion = this.huntChampions.get(mobId);
    const championMultiplier = huntDifficultyRewardMultiplier(huntChampion?.difficulty ?? "normal");
    const championQuantity = (quantity: number): number => Math.max(1, Math.ceil(quantity * championMultiplier));
    const setRewards = huntChampion ? huntEquipmentRewards(huntChampion.pathId, huntChampion.difficulty,
      this.ownsOrHasPendingItem(ownerId, HUNT_PATH_EQUIPMENT[huntChampion.pathId].armourId), Math.random()) : [];
    const championRewards: { itemId: ItemId; quantity: number }[] = huntChampion?.pathId === "fang"
      ? [...setRewards.map(itemId => ({ itemId, quantity: 1 })), { itemId: "crawler_fang", quantity: championQuantity(6) }, { itemId: "moss_fibre", quantity: championQuantity(6) }, { itemId: "healing_potion", quantity: championQuantity(1) }]
      : huntChampion?.pathId === "venom"
        ? [...setRewards.map(itemId => ({ itemId, quantity: 1 })), { itemId: "acid_gland", quantity: championQuantity(7) }, { itemId: "silver_ore", quantity: championQuantity(4) }, { itemId: "healing_potion", quantity: championQuantity(1) }]
        : huntChampion?.pathId === "crusher"
          ? [...setRewards.map(itemId => ({ itemId, quantity: 1 })), { itemId: "stone_core", quantity: championQuantity(7) }, { itemId: "iron_ore", quantity: championQuantity(6) }, { itemId: "healing_potion", quantity: championQuantity(1) }]
          : [];
    const firstLeaderVictory = Boolean(rewardPlayer && areaReward
      && !this.ownsOrHasPendingItem(ownerId, areaReward.rewardItemId));
    const areaRelicDrops: { itemId: ItemId; quantity: number }[] = rewardPlayer && areaReward
      ? [{ itemId: areaReward.rewardItemId, quantity: mob.leaderRematchTier >= 4 ? 2 : 1 }] : [];
    const rematchMaterialQuantity = areaReward ? leaderRematchMaterialBonus(mob.leaderRematchTier) : 0;
    const rematchMaterialId: ItemId = mob.archetype === "cave_spitter" ? "acid_gland"
      : mob.archetype === "stone_brute" ? "stone_core" : "crawler_fang";
    const rematchDrops: { itemId: ItemId; quantity: number }[] = rematchMaterialQuantity > 0
      ? [{ itemId: rematchMaterialId, quantity: rematchMaterialQuantity }] : [];
    const mistfenProgress = rewardPlayer ? this.mistfenProgress(rewardPlayer) : { points: 0, discovered: false };
    const mistfenRank = mistfenMasteryRank(mistfenProgress.points, mistfenProgress.discovered);
    const mistfenEventMob = mobId === MISTFEN_EVENT_ID || isMistfenEventFollower(mobId);
    const activeMistfenEvent = mistfenEventDefinition(this.realmEvents.mistfenVariant);
    const mistfenMasteryDrops: { itemId: ItemId; quantity: number }[] = isMistfenMob(mobId) && mistfenRank >= 2
      ? mobId === "mistfen-behemoth"
        ? [{ itemId: "acid_gland", quantity: mistfenRank >= 3 ? 3 : 1 },
          ...(mistfenRank >= 3 ? [{ itemId: "silver_ore" as ItemId, quantity: 2 }] : []),
          ...(mistfenRank >= 3 && mob.leaderModifier === "mirebreaker"
            && !this.ownsOrHasPendingItem(ownerId, "mirebreaker_mantle")
            ? [{ itemId: "mirebreaker_mantle" as ItemId, quantity: 1 }] : [])]
        : [{ itemId: mob.archetype === "cave_spitter" ? "acid_gland" : "moss_fibre", quantity: 1 }]
      : [];
    const mistfenEventDrops: { itemId: ItemId; quantity: number }[] = mistfenEventMob && mistfenRank >= 2
      ? isMistfenEventFollower(mobId)
        ? [{ itemId: mob.archetype === "cave_spitter" ? "acid_gland" : "moss_fibre", quantity: 2 },
          { itemId: "healing_potion", quantity: 1 }]
        : [{ itemId: "acid_gland", quantity: 5 }, { itemId: "silver_ore", quantity: 2 },
          ...(mistfenRank >= 3 && activeMistfenEvent && Math.random() < activeMistfenEvent.legendaryChance
            ? [{ itemId: "mirebreaker_mantle" as ItemId, quantity: 1 }] : [])]
      : [];
    const greenwoodProgress = rewardPlayer ? this.greenwoodProgress(rewardPlayer) : { points: 0, discovered: false };
    const greenwoodRank = greenwoodMasteryRank(greenwoodProgress.points, greenwoodProgress.discovered);
    const greenwoodEventMob = mobId === WILDERNESS_EVENT_ID || isGreenwoodEventFollower(mobId);
    const activeGreenwoodEvent = greenwoodEventDefinition(this.realmEvents.greenwoodVariant);
    const greenwoodMasteryDrops: { itemId: ItemId; quantity: number }[] = isGreenwoodCampMob(mobId) && greenwoodRank >= 2
      ? mobId === "wild-crawler"
        ? [{ itemId: "moss_fibre", quantity: greenwoodRank >= 3 ? 3 : 1 },
          ...(greenwoodRank >= 3 ? [{ itemId: "timber" as ItemId, quantity: 2 }] : []),
          ...(greenwoodRank >= 3 && mob.leaderModifier === "rootslayer" && !this.ownsOrHasPendingItem(ownerId, "rootstalker_wrap")
            ? [{ itemId: "rootstalker_wrap" as ItemId, quantity: 1 }] : [])]
        : [{ itemId: "moss_fibre", quantity: 1 }]
      : [];
    const greenwoodEventDrops: { itemId: ItemId; quantity: number }[] = greenwoodEventMob && greenwoodRank >= 2
      ? isGreenwoodEventFollower(mobId)
        ? [{ itemId: "moss_fibre", quantity: 2 }, { itemId: "crawler_fang", quantity: 1 }]
        : [{ itemId: "moss_fibre", quantity: 4 }, { itemId: "timber", quantity: 3 },
          ...(greenwoodRank >= 3 && activeGreenwoodEvent && Math.random() < activeGreenwoodEvent.legendaryChance
            ? [{ itemId: "rootstalker_wrap" as ItemId, quantity: 1 }] : [])]
      : [];
    const ownsLantern = (rewardPlayer?.inventory.get("miners_lantern")?.quantity ?? 0)
      + (rewardPlayer?.storage.get("miners_lantern")?.quantity ?? 0) > 0;
    const signatureDrops = (itemId: SignatureItemId): { itemId: ItemId; quantity: number }[] => {
      if (!rewardPlayer) return [{ itemId, quantity: 1 }];
      const ownsItem = this.ownsOrHasPendingSignature(ownerId, itemId);
      const pity = parseSignaturePity(rewardPlayer.signaturePityJson);
      const result = resolveSignatureDrop(itemId, ownsItem, pity[itemId] ?? 0, Math.random());
      pity[itemId] = result.nextMisses;
      rewardPlayer.signaturePityJson = serializeSignaturePity(pity);
      void this.persistPlayer(ownerId, rewardPlayer, true).catch(() => {});
      const client = this.clients.find(entry => entry.sessionId === ownerId);
      if (result.drop) {
        const reason = result.firstClear ? "First victory guarantee" : result.pityTriggered ? "Bad-luck protection activated" : `${result.chancePercent}% signature roll succeeded`;
        client?.send("chat:notice", `${reason} · your Legendary ${ITEM_DEFINITIONS[itemId].name} is ready.`);
        return [{ itemId, quantity: 1 }];
      }
      client?.send("chat:notice", `No Legendary this clear · guaranteed within ${result.guaranteedIn} more clear${result.guaranteedIn === 1 ? "" : "s"}.`);
      return [];
    };
    const baseDrops: { itemId: ItemId; quantity: number }[] = huntChampion ? championRewards
      : mobId === CRYSTAL_MATRIARCH_ID ? signatureDrops("matriarch_edge")
      : mobId === "forge-colossus" ? [{ itemId: "iron_armour", quantity: 1 }, { itemId: "stone_core_hammer", quantity: 1 }]
      : mobId === "buried-chamber-brute"
      ? ownsLantern
        ? [{ itemId: "stone_core", quantity: 2 }, { itemId: "silver_ore", quantity: 3 }]
        : [{ itemId: "stone_core", quantity: 1 }, { itemId: "miners_lantern", quantity: 1 }]
      : mobId === WILDERNESS_EVENT_ID ? [{ itemId: "acid_gland", quantity: 3 }, ...signatureDrops("venom_focus")]
      : isRealmEventId(mobId) ? [...(realmEventDefinition(mobId)?.rewards ?? []),
        ...(realmEventDefinition(mobId)?.signatureRewards ?? []).flatMap(itemId => signatureDrops(itemId as SignatureItemId))]
      : isAreaMiniBoss(mobId) ? [...lootForArchetype(mob.archetype as MobArchetypeId, mobId, Math.random(), "miniboss", Math.random(), mob.difficultyTier)]
      : mob.isChampion ? lootForArchetype(mob.archetype as MobArchetypeId, mobId, Math.random(), "champion")
        .map(entry => isEquipmentItem(entry.itemId) ? entry : { ...entry, quantity: 3 })
      : mob.isElite ? [...lootForArchetype(mob.archetype as MobArchetypeId, mobId, Math.random(), "elite", Math.random())]
      : [...lootForArchetype(mob.archetype as MobArchetypeId, mobId, Math.random(), "normal", isSilverGuard(mobId) ? Math.random() : 1)];
    const items = normalizeLootBagItems([
      ...baseDrops,
      ...(mobId === REALM_WARDEN_ID && this.realmWardenRepeatActive
        ? [{ itemId: "moonstone" as ItemId, quantity: 2 }, { itemId: "silver_ore" as ItemId, quantity: 6 }]
        : []),
      ...areaRelicDrops,
      ...rematchDrops,
      ...mistfenMasteryDrops,
      ...mistfenEventDrops,
      ...greenwoodMasteryDrops,
      ...greenwoodEventDrops,
      ...armourDropForMob(mob.archetype, mob.difficultyTier, Math.random()),
    ]);
    const representative = lootBagRepresentative(items);
    if (!representative) return;
    const realmReward = mobId === REALM_WARDEN_ID;
    const angle = realmReward ? this.realmRewardLandingIndex++ * Math.PI / 4 - Math.PI / 2 : this.lootDropSequence * 0.7;
    const rewardRadius = realmReward ? 5.5 : .85;
    const landing = findLootLanding(
      { x: mob.x, y: mob.y, z: mob.z },
      { x: mob.x + Math.cos(angle) * rewardRadius, y: mob.y, z: mob.z + Math.sin(angle) * rewardRadius },
      this.readWorldBlock,
      realmReward ? 6.5 : 3.5,
    );
    const drop = new LootDropState();
    const affixTier = realmReward || mobId === CRYSTAL_MATRIARCH_ID || mobId === "forge-colossus" || huntChampion?.difficulty === "ascendant"
      ? 3 : isAreaMiniBoss(mobId) || mob.isChampion || mob.isElite || huntChampion ? 2 : Math.random() < .2 ? 1 : 0;
    Object.assign(drop, {
      ownerId,
      itemId: representative.itemId,
      quantity: Math.min(255, representative.quantity),
      affixTier,
      contentsJson: encodeLootBagItems(items),
      x: landing.x,
      y: landing.y + .22,
      z: landing.z,
      expiresAt: now + LOOT_DESPAWN_MS,
    });
    const dropId = `${mobId}:${now}:${++this.lootDropSequence}`;
    this.state.lootDrops.set(dropId, drop);
    this.clients.find(client => client.sessionId === ownerId)?.send("loot:spawned", {
      dropId, ownerId, itemId: drop.itemId, quantity: drop.quantity, contentsJson: drop.contentsJson, affixTier: drop.affixTier,
      x: drop.x, y: drop.y, z: drop.z, expiresAt: drop.expiresAt,
    });
    if (areaRelicDrops.length) this.clients.find(client => client.sessionId === ownerId)?.send("chat:notice",
      `${firstLeaderVictory ? "FIRST LEADER VICTORY" : mob.leaderRematchTier > 0 ? `EMPOWERED REMATCH ${mob.leaderRematchTier}` : "SIGNATURE DROP"} · ${areaRelicDrops[0]!.quantity} ${ITEM_DEFINITIONS[areaRelicDrops[0]!.itemId].name}${rematchMaterialQuantity ? ` + ${rematchMaterialQuantity} bonus ${ITEM_DEFINITIONS[rematchMaterialId].name}` : ""} added to your personal cache.`);
  }

  private resolveLootPickups(now: number): void {
    for (const [dropId, drop] of this.state.lootDrops) {
      if (now >= drop.expiresAt) {
        this.state.lootDrops.delete(dropId);
      }
    }
  }

  private handleLootCollect(client: Client, payload: unknown): void {
    const parsed = LootCollectRequestSchema.safeParse(payload);
    const reply = (ok: boolean, message: string, details: Partial<LootCollectResult> = {}) => client.send("loot:result", {
      ok, dropId: parsed.success ? parsed.data.dropId : "", message, ...details,
    } satisfies LootCollectResult);
    if (!parsed.success) return reply(false, "Invalid loot request.");
    const player = this.state.players.get(client.sessionId);
    if (!player || player.health <= 0) return reply(false, "You must be alive to collect loot.");
    const drop = this.state.lootDrops.get(parsed.data.dropId);
    if (!drop || Date.now() >= drop.expiresAt) return reply(false, "That bag is no longer available.");
    if (drop.ownerId && drop.ownerId !== client.sessionId) return reply(false, "That is another player's personal loot.");
    const action = parsed.data.action ?? (parsed.data.equip ? "equip" : "keep");
    if (parsed.data.dropId.startsWith("forest-cache:")) {
      if (action === "dismantle") return reply(false, "Claim the cache before dismantling equipment at the blacksmith.");
      const run = this.forestDungeonRun;
      if (!run || run.completedAt === 0 || !run.entered.has(client.sessionId) || run.claimed.has(client.sessionId)) return reply(false, "That cache is no longer available.");
      if (!isLootInPickupRange(player, drop, EQUIPMENT_LOOT_RANGE) || !hasCombatLineOfSight(player, drop, this.readWorldBlock)) return reply(false, "Move beside your cache with a clear path to it.");
      const rewards: { itemId: ItemId; quantity: number; total: number }[] = [];
      const featuredItemId = drop.itemId as ItemId;
      const featuredEquipment = equipmentForItem(featuredItemId) || armourForItem(featuredItemId);
      const duplicateFeatured = Boolean(featuredEquipment)
        && (player.inventory.get(featuredItemId)?.quantity ?? 0) + (player.storage.get(featuredItemId)?.quantity ?? 0) > 0;
      const veteranSupplies = featuredItemId === "silver_ore" || duplicateFeatured;
      const bundle: { itemId: ItemId; quantity: number }[] = [
        { itemId: "stone_core", quantity: 2 + run.scalePlayers + (veteranSupplies ? 2 : 0) },
        { itemId: "iron_ore", quantity: 2 },
        ...(run.scalePlayers >= 2 || veteranSupplies ? [{ itemId: "silver_ore" as ItemId, quantity: (run.scalePlayers >= 2 ? 1 : 0) + (veteranSupplies ? 3 : 0) }] : []),
        { itemId: "healing_potion", quantity: 1 },
        ...(!veteranSupplies ? [{ itemId: featuredItemId, quantity: 1 }] : []),
      ];
      for (const reward of bundle) {
        let item = player.inventory.get(reward.itemId);
        const before = item?.quantity ?? 0;
        const capacity = lootCarryCapacity(reward.itemId, ironCapacity(player.blacksmithUpgrades));
        const quantity = Math.max(0, Math.min(reward.quantity, capacity - before));
        if (quantity === 0) continue;
        if (!item) { item = new InventoryItemState(); player.inventory.set(reward.itemId, item); }
        item.quantity = inventoryTotal(before, quantity);
        rewards.push({ itemId: reward.itemId, quantity, total: item.quantity });
      }
      const goldGranted = 12 + Math.max(0, run.scalePlayers - 1) * 3 + (veteranSupplies ? FOREST_CACHE_DUPLICATE_GOLD : 0);
      const beforeGold = player.coins;
      player.coins = Math.min(1_000_000, player.coins + goldGranted);
      run.claimed.add(client.sessionId);
      this.state.lootDrops.delete(parsed.data.dropId);
      for (const reward of rewards) this.broadcast("loot:picked-up", { playerId: client.sessionId, dropId: parsed.data.dropId, ...reward } satisfies LootPickedUp);
      const conversion = duplicateFeatured ? ` · duplicate ${ITEM_DEFINITIONS[featuredItemId].name} converted` : "";
      const message = `Rootbound Cache claimed${conversion} · +${player.coins - beforeGold} gold · ${rewards.map(reward => `${reward.quantity} ${ITEM_DEFINITIONS[reward.itemId].name}`).join(" · ")}`;
      client.send("dungeon:reward", { runId: run.id, goldGranted: player.coins - beforeGold, totalGold: player.coins, items: rewards, message } satisfies DungeonRewardClaimed);
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      this.refreshNearbyObjectives();
      return reply(true, message);
    }
    if (!isLootInPickupRange(player, drop, EQUIPMENT_LOOT_RANGE) || !hasCombatLineOfSight(player, drop, this.readWorldBlock)) return reply(false, "Move beside the bag with a clear path to it.");
    if (drop.contentsJson) {
      if (action !== "keep") return reply(false, "Pick up the bag before managing its equipment.");
      const collected: { itemId: ItemId; quantity: number; total: number }[] = [];
      const remaining: LootBagItem[] = [];
      for (const entry of decodeLootBagItems(drop.contentsJson, drop.itemId, drop.quantity)) {
        let item = player.inventory.get(entry.itemId);
        const before = item?.quantity ?? 0;
        const capacity = lootCarryCapacity(entry.itemId, ironCapacity(player.blacksmithUpgrades));
        const quantity = Math.max(0, Math.min(entry.quantity, capacity - before));
        if (quantity > 0) {
          if (!item) { item = new InventoryItemState(); player.inventory.set(entry.itemId, item); }
          item.quantity = inventoryTotal(before, quantity);
          collected.push({ itemId: entry.itemId, quantity, total: item.quantity });
        }
        if (quantity < entry.quantity) remaining.push({ itemId: entry.itemId, quantity: entry.quantity - quantity });
      }
      if (collected.length === 0) return reply(false, "Your inventory has no room for anything in this bag.", { remainingItems: remaining });
      for (const reward of collected) this.attuneEquipment(client, player, reward.itemId, drop.affixTier);
      if (remaining.length === 0) this.state.lootDrops.delete(parsed.data.dropId);
      else {
        const representative = lootBagRepresentative(remaining)!;
        drop.itemId = representative.itemId;
        drop.quantity = Math.min(255, representative.quantity);
        drop.contentsJson = encodeLootBagItems(remaining);
      }
      void this.persistPlayer(client.sessionId, player);
      for (const reward of collected) this.broadcast("loot:picked-up", {
        playerId: client.sessionId, dropId: parsed.data.dropId, ...reward,
      } satisfies LootPickedUp);
      if (collected.some(entry => entry.itemId === "miners_lantern")
        && this.advanceFirstExpedition(client, "claimed_lantern")) this.sendObjectiveState(client, true);
      if (collected.some(entry => entry.itemId === "matriarch_edge")) {
        player.silverDepthsRunStage = 7;
        if (this.advanceSilverDepthsExpedition(client, "claimed_moonstone")) this.sendObjectiveState(client, true);
      }
      const summary = collected.map(entry => `${entry.quantity} ${ITEM_DEFINITIONS[entry.itemId].name}`).join(" · ");
      return reply(true, remaining.length > 0
        ? `Collected ${summary} · ${remaining.length} item type${remaining.length === 1 ? "" : "s"} remain because your inventory is full.`
        : `Loot bag collected · ${summary}.`, { action, itemId: collected[0]?.itemId, remainingItems: remaining });
    }
    const mainHandId = equipmentForItem(drop.itemId);
    const armourId = armourForItem(drop.itemId);
    const utilityId = drop.itemId === "miners_lantern" || drop.itemId === "moonstone" ? drop.itemId : null;
    if (action === "equip" && (this.pendingPowers.has(client.sessionId) || this.pendingAttacks.has(client.sessionId) || player.defending)) return reply(false, "Finish your action before equipping, or keep it in your pack.");
    const itemId = drop.itemId as ItemId;
    if (action === "dismantle") {
      if (utilityId || !Object.hasOwn(BLACKSMITH_DISMANTLE, itemId)) return reply(false, "This item cannot be dismantled from the loot bag.");
      const recipe = BLACKSMITH_DISMANTLE[itemId as BlacksmithDismantleItemId] as { gold: number; materialId?: ItemId; materialQuantity?: number };
      const materialId = recipe.materialId;
      const materialQuantity = recipe.materialQuantity ?? 0;
      if (materialId && materialQuantity > 0) {
        let material = player.inventory.get(materialId);
        if (!material) { material = new InventoryItemState(); player.inventory.set(materialId, material); }
        material.quantity = inventoryTotal(material.quantity, materialQuantity);
        this.broadcast("loot:picked-up", { playerId: client.sessionId, dropId: parsed.data.dropId, itemId: materialId,
          quantity: materialQuantity, total: material.quantity } satisfies LootPickedUp);
      }
      const beforeGold = player.coins;
      player.coins = Math.min(1_000_000, player.coins + recipe.gold);
      const dustGranted = drop.affixTier > 0 ? attunementDustYield(drop.affixTier) : 0;
      if (dustGranted > 0) {
        this.setEquipmentAttunements(player, this.equipmentAffixes(player), this.attunementDust(player) + dustGranted, this.attunementOffers(player));
        this.sendEquipmentAffixes(client, `Salvaged ${dustGranted} Attunement Dust from ${ITEM_DEFINITIONS[itemId].name}.`);
      }
      this.state.lootDrops.delete(parsed.data.dropId);
      void this.persistPlayer(client.sessionId, player, true).catch(() => {});
      const materialMessage = materialId && materialQuantity > 0 ? ` · +${materialQuantity} ${ITEM_DEFINITIONS[materialId].name}` : "";
      const dustMessage = dustGranted > 0 ? ` · +${dustGranted} Attunement Dust` : "";
      return reply(true, `Dismantled ${ITEM_DEFINITIONS[itemId].name} · +${player.coins - beforeGold} gold${materialMessage}${dustMessage}.`, {
        action, itemId, goldGranted: player.coins - beforeGold, materialGranted: materialId, materialQuantity,
      });
    }
    let item = player.inventory.get(itemId);
    const before = item?.quantity ?? 0;
    const capacity = lootCarryCapacity(itemId, ironCapacity(player.blacksmithUpgrades));
    if (before + drop.quantity > capacity) return reply(false, `Your ${ITEM_DEFINITIONS[itemId].name} capacity is full.`);
    if (!item) { item = new InventoryItemState(); player.inventory.set(itemId, item); }
    item.quantity = inventoryTotal(before, drop.quantity);
    const affix = this.attuneEquipment(client, player, itemId, drop.affixTier);
    // Synchronous removal makes competing and replayed requests collect at most once.
    this.state.lootDrops.delete(parsed.data.dropId);
    if (action === "equip" && mainHandId) this.handleMainHandEquip(client, { requestId: `loot-equip-${Date.now()}`, mainHandId });
    if (action === "equip" && armourId) this.handleArmourEquip(client, { armourId });
    void this.persistPlayer(client.sessionId, player);
    this.broadcast("loot:picked-up", { playerId: client.sessionId, dropId: parsed.data.dropId, itemId,
      quantity: drop.quantity, total: item.quantity } satisfies LootPickedUp);
    if (utilityId && this.advanceFirstExpedition(client, "claimed_lantern")) this.sendObjectiveState(client, true);
    if (drop.itemId === "matriarch_edge") {
      player.silverDepthsRunStage = 7;
      if (this.advanceSilverDepthsExpedition(client, "claimed_moonstone")) this.sendObjectiveState(client, true);
    }
    if (parsed.data.dropId === `depths-wing-gear:${client.sessionId}`) {
      this.sendObjectiveState(client, true);
      for (const id of this.activeSilverDepthsParticipants()) this.sendSilverDepthsWingRewardStatus(id);
      this.sendSilverDepthsCheckpointStatus(client.sessionId);
    }
    if (parsed.data.dropId === `depths-wing-reward:${client.sessionId}`) {
      this.sendSilverDepthsWingRewardStatus(client.sessionId);
      this.sendSilverDepthsCheckpointStatus(client.sessionId);
    }
    const pickupMessage = utilityId ? `${ITEM_DEFINITIONS[itemId].name} claimed and auto-equipped.`
      : mainHandId || armourId ? `${ITEM_DEFINITIONS[itemId].name} ${action === "equip" ? "equipped" : "kept in your pack"}.`
        : `Picked up ${drop.quantity} ${ITEM_DEFINITIONS[itemId].name}.`;
    reply(true, `${pickupMessage}${affix ? ` ${affix.affixId.toUpperCase()} T${affix.tier}.`
      : drop.affixTier >= 3 && (mainHandId || armourId) ? " Three Tier 3 attunement choices await at the blacksmith." : ""}`, { action, itemId });
  }

  private damagePlayer(mobId: string, playerId: string, damage: number, now: number, blockable = true,
    kind: IncomingDamageKind = "melee"): boolean {
    const player = this.state.players.get(playerId);
    if (!player || player.health <= 0 || isInsideTownSafeZone(player) || !caveEncounterAllows(mobId, player)) return false;
    if (now < player.invulnerableUntil) {
      const dodge = this.activeDodgeWindows.get(playerId);
      if (dodge && now >= dodge.startedAt && now <= dodge.until) {
        this.activeDodgeWindows.delete(playerId);
        this.dodgePressure.set(playerId, { chain: 0, lastAt: Number.NEGATIVE_INFINITY, exhaustedUntil: 0 });
        const counterUntil = now + PERFECT_DODGE_COUNTER_MS;
        this.dodgeCounterUntil.set(playerId, counterUntil);
        const thiefActive = parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "thief";
        const thiefRecovery = thiefActive ? this.buildPathRankFor(player, "thief") * 2 + this.equipmentAffixTier(player, "elusive") * 2 : 0;
        if (parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "assassin" && this.buildPathRankFor(player, "assassin") >= 2) {
          const phantom = this.buildSpecializationFor(player, "assassin") === "phantom";
          const veiledMs = this.equipmentAffixTier(player, "veiled") * 250;
          this.assassinShadowUntil.set(playerId, now + (phantom ? 3_000 : 2_000) + veiledMs);
          this.assassinShadowBonus.set(playerId, 0);
          this.pathConcealedUntil.set(playerId, now + (phantom ? 2_000 : 1_250) + veiledMs);
          if (phantom) player.powerCooldownUntil = this.buildSpecializationMastered(player, "phantom")
            ? now : Math.max(now, player.powerCooldownUntil - 1_500);
          for (const [targetMobId, awareness] of this.mobAwareness) if (awareness.targetId === playerId) {
            const targetMob = this.state.mobs.get(targetMobId);
            if (targetMob && Math.hypot(targetMob.x - player.x, targetMob.z - player.z) <= 7) {
              this.mobAwareness.delete(targetMobId); targetMob.targetId = ""; targetMob.awarenessState = "search";
            }
          }
          this.buildPathProc(playerId, "assassin", "SHADOWSTEP", phantom
            ? "PHANTOM · CONCEALED · POWER REFRESHED" : "CONCEALED · NEXT STRIKE +2", phantom ? 3_000 : 2_000);
        }
        player.stamina = Math.min(player.maxStamina, player.stamina + PERFECT_DODGE_STAMINA_RESTORE + thiefRecovery);
        this.clients.find(client => client.sessionId === playerId)?.send("dodge:pressure", {
          phase: "perfect", cost: 0, chain: 0, exhaustedUntil: 0, counterUntil,
          staminaRestored: PERFECT_DODGE_STAMINA_RESTORE + thiefRecovery,
        } satisfies DodgePressureUpdate);
      }
      return false;
    }
    const mob = this.state.mobs.get(mobId);
    const leaderId = leaderForFollower(mobId);
    const leader = leaderId ? this.state.mobs.get(leaderId) : undefined;
    if (leader?.alive && (leader.archetype === "moss_crawler" || leader.archetype === "briar_crawler")) damage += 1;
    if (mob?.isMiniBoss) damage = miniBossDamage(damage, mob.level, player.level);
    const defense = blockable && mob
      ? resolveDefense(damage, player.defending, player.defenseStartedAt, now, isAttackInGuardArc(player, mob))
      : { damage, guarded: false, parried: false };
    const traitId = player.equippedTrait as TraitId;
    if (defense.guarded) {
      const cost = guardStaminaCost(defense.parried ? 8 : 14, traitId);
      player.stamina = Math.max(0, player.stamina - cost);
      if (defense.parried) player.stamina = Math.min(player.maxStamina, player.stamina + parryStaminaRestore(traitId));
    }
    let perkStaminaRestored = 0;
    if (defense.guarded && player.armourId === "rootguard_armour") {
      const perk = equipmentPerkStats("rootguard_armour", equipmentReforgeRank(player.reforgeRanksJson, "rootguard_armour"));
      perkStaminaRestored = Math.min(perk?.stamina ?? 0, player.maxStamina - player.stamina);
      player.stamina += perkStaminaRestored;
    }
    if (defense.parried && mob) {
      this.staggerMob(mobId, mob, now, PARRY_STAGGER_MS, true);
    }
    if (player.stamina <= 0) player.defending = false;
    let absorbed = false;
    if (!defense.guarded && defense.damage >= 3 && player.armourId === "bastion_plate"
      && now >= (this.bastionWardReadyAt.get(playerId) ?? 0)) {
      const perk = equipmentPerkStats("bastion_plate", equipmentReforgeRank(player.reforgeRanksJson, "bastion_plate"));
      this.bastionWardReadyAt.set(playerId, now + (perk?.cooldownMs ?? 14_000));
      defense.damage = 0;
      absorbed = true;
    }
    defense.damage = armouredDamage(defense.damage, player.armourId, kind,
      equipmentReforgeRank(player.reforgeRanksJson, player.armourId));
    const bulwarkUntil = this.tankBulwarkUntil.get(playerId) ?? 0;
    if (defense.damage > 0 && now < bulwarkUntil) {
      const build = parseBuildPathState(player.huntLoadoutsJson);
      const bulwarkAbility = selectedCallingAbility(build, "tank");
      const beforeBulwark = defense.damage;
      defense.damage = Math.max(0, defense.damage - (selectedCallingAugment(build, bulwarkAbility) === "bulwark_iron_skin" ? 2 : 1));
      this.grantCallingTrial(playerId, "bulwark_iron_skin", beforeBulwark - defense.damage);
    } else if (bulwarkUntil > 0) {
      this.tankBulwarkUntil.delete(playerId);
    }
    const barrierHits = this.mageBarrierHits.get(playerId) ?? 0;
    if (defense.damage > 0 && barrierHits > 0) {
      const build = parseBuildPathState(player.huntLoadoutsJson);
      const beforeBarrier = defense.damage;
      defense.damage = Math.max(0, defense.damage - (selectedCallingAugment(build, "mage_mana_shield") === "shield_reinforced_rune" ? 2 : 1));
      this.grantCallingTrial(playerId, "shield_prismatic_layers", 1);
      this.grantCallingTrial(playerId, "shield_reinforced_rune", beforeBarrier - defense.damage);
      if (barrierHits === 1) this.mageBarrierHits.delete(playerId);
      else this.mageBarrierHits.set(playerId, barrierHits - 1);
      this.callingState(playerId, "mage", "mage_mana_shield", "BARRIER", {
        charges: Math.max(0, barrierHits - 1), clear: barrierHits === 1,
      });
      this.buildPathProc(playerId, "mage", "MANA SHIELD", barrierHits === 1 ? "SHATTERED" : `${barrierHits - 1} CHARGES REMAIN`);
    }
    if (defense.damage > 0 && parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "tank") {
      const fortifiedTier = this.equipmentAffixTier(player, "fortified");
      if (fortifiedTier > 0) defense.damage = Math.max(0, defense.damage - (fortifiedTier >= 3 ? 2 : 1));
    }
    if (defense.damage > 0 && this.tankFieldWards.delete(playerId)) {
      const absorbedByWard = Math.min(2, defense.damage);
      defense.damage -= absorbedByWard;
      this.buildPathProc(playerId, "tank", "FIELD WARD", `${absorbedByWard} DAMAGE PREVENTED`);
    }
    if (defense.damage > 0) for (const [guardId, guard] of this.state.players) {
      const guardian = this.buildSpecializationFor(guard, "tank") === "guardian";
      const guardianMaster = guardian && this.buildSpecializationMastered(guard, "guardian");
      const protectorTier = this.equipmentAffixTier(guard, "protector");
      if (guardId === playerId || guard.health <= 0 || !guard.defending || Math.abs(guard.y - player.y) > 2
        || Math.hypot(guard.x - player.x, guard.z - player.z) > (guardianMaster ? 6 : guardian ? 5 : 4) + protectorTier * .3
        || parseBuildPathState(guard.huntLoadoutsJson).selectedPathId !== "tank" || this.buildPathRankFor(guard, "tank") < 2) continue;
      const beforeProtection = defense.damage;
      defense.damage = Math.max(0, defense.damage - (guardianMaster ? 3 : guardian ? 2 : 1) - (protectorTier >= 2 ? 1 : 0));
      if (guardian) this.grantMasterTrial(guardId, "guardian", beforeProtection - defense.damage);
      if (now - (this.fortressProcAt.get(guardId) ?? 0) >= 600) {
        this.fortressProcAt.set(guardId, now);
        this.buildPathProc(guardId, "tank", "FORTRESS GUARD", `ALLY PROTECTED · ${player.name || "EXPLORER"}`);
      }
      break;
    }
    if (defense.guarded && defense.damage > 0 && parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "tank") {
      const rank = this.buildPathRankFor(player, "tank");
      defense.damage = Math.max(0, defense.damage - (rank >= 4 ? 2 : rank > 0 ? 1 : 0));
    }
    if (defense.guarded && mob && this.buildSpecializationFor(player, "tank") === "juggernaut") {
      this.staggerMob(mobId, mob, now, (this.buildSpecializationMastered(player, "juggernaut") ? 900 : 450)
        + this.equipmentAffixTier(player, "retaliating") * 120, true);
      this.grantMasterTrial(playerId, "juggernaut");
      this.buildPathProc(playerId, "tank", "JUGGERNAUT", "ATTACKER STAGGERED");
    }
    if (defense.damage > 0 && now <= (this.crusherSetGuardUntil.get(playerId) ?? 0))
      defense.damage = Math.max(1, defense.damage - 1);
    if (defense.damage > 0 && kind !== "melee" && ownsDepthsReward(player.blacksmithUpgrades, "matriarch_guard")) {
      defense.damage = Math.max(1, defense.damage - 1);
    }
    player.momentumStacks = momentumAfterDefense(player.momentumStacks, defense.damage, defense.parried, traitId);
    player.health = Math.max(0, player.health - defense.damage);
    const depthsRun = this.silverDepthsRuns.get(playerId);
    if (depthsRun && depthsRun.completedAt === 0) depthsRun.damageTaken += defense.damage;
    const emberRun = this.emberVaultRuns.get(playerId);
    if (emberRun && emberRun.completedAt === 0) emberRun.damageTaken += defense.damage;
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
      absorbed,
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
        perkStaminaRestored,
      } satisfies DefenseResolved);
    }
    if (!defeated) return true;
    this.recordAscendantHuntDefeat(playerId, now);
    const failedDepthsRun = this.silverDepthsRuns.get(playerId);
    if (failedDepthsRun) this.restoreRunMoonstone(player, failedDepthsRun);
    this.silverDepthsRuns.delete(playerId);
    if (failedDepthsRun && this.roomKind === "silver-depths") {
      this.silverDepthsFallen.add(playerId);
      this.silverDepthsDisconnected.delete(playerId);
      this.broadcastSilverDepthsPartyStatus();
    }
    this.silverDepthsCheckpointReady.delete(playerId);
    if (this.silverDepthsAwaitingReady) this.refreshSilverDepthsCheckpointReady();
    this.emberVaultRuns.delete(playerId);
    player.silverDepthsRunStage = 0;
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

  private setGuardianCover(cover: typeof FOREST_DUNGEON_COVER[number], broken: boolean): void {
    const block = broken ? Block.Air : cover.kind === "stone" ? Block.Stone : Block.OakLog;
    for (let y = SURFACE_HEIGHT; y <= SURFACE_HEIGHT + cover.height; y++) {
      const address = worldToChunk(cover.x, cover.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, y, address.localZ) === block) continue;
      setBlock(stored.chunk, address.localX, y, address.localZ, block); stored.revision++;
      this.broadcast("block:changed", { requestId: `guardian-cover-${cover.x}-${cover.z}-${broken ? "break" : "restore"}`,
        x: cover.x, y, z: cover.z, block, revision: stored.revision } satisfies BlockChanged);
    }
  }

  private setMiniBossArenaBlock(mobId: string, x: number, y: number, z: number, block: BlockId, reason: string): void {
    const address = worldToChunk(x, z), stored = this.getChunk(address.chunkX, address.chunkZ);
    if (getBlock(stored.chunk, address.localX, y, address.localZ) === block) return;
    setBlock(stored.chunk, address.localX, y, address.localZ, block); stored.revision++;
    this.broadcast("block:changed", { requestId: `leader-arena-${mobId}-${x}:${y}:${z}-${reason}`,
      x, y, z, block, revision: stored.revision } satisfies BlockChanged);
  }

  private activateMiniBossArena(mobId: string, mob: MobState): void {
    if (this.miniBossArenaCover.has(mobId)) return;
    const home = this.mobHomes.get(mobId) ?? mob;
    const active = new Map<string, ActiveMiniBossCover>();
    for (const site of miniBossCoverSites(home, mob.archetype)) {
      if (isProtectedVoxel(site.x, site.z)
        || [...this.state.players.values()].some(player => player.health > 0 && Math.abs(player.y - site.y) <= 1.75
          && Math.hypot(player.x - (site.x + .5), player.z - (site.z + .5)) <= .8)) continue;
      const address = worldToChunk(site.x, site.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, site.y - 1, address.localZ) === Block.Air) continue;
      const original = [site.y, site.y + 1].map(y => ({ y, block: getBlock(stored.chunk, address.localX, y, address.localZ) }));
      if (original.some(cell => cell.block !== Block.Air)) continue;
      const cover = { x: site.x, z: site.z, minY: site.y, maxY: site.y + 1, hits: 0, original };
      active.set(`${site.x}:${site.z}`, cover);
      for (const cell of original) this.setMiniBossArenaBlock(mobId, site.x, cell.y, site.z, Block.Stone, "raise");
    }
    this.miniBossArenaCover.set(mobId, active);
  }

  private setMiniBossCoverHits(mobId: string, cover: ActiveMiniBossCover, hits: number): void {
    cover.hits = Math.max(cover.hits, Math.min(2, hits));
    const block = cover.hits >= 2 ? Block.Air : cover.hits === 1 ? Block.Dirt : Block.Stone;
    for (let y = cover.minY; y <= cover.maxY; y++) this.setMiniBossArenaBlock(mobId, cover.x, y, cover.z, block,
      cover.hits >= 2 ? "break" : "crack");
  }

  private damageMiniBossArenaCover(mobId: string, impact: { x: number; y: number; z: number }, radius = 1.15): void {
    const covers = this.miniBossArenaCover.get(mobId);
    if (!covers) return;
    for (const cover of covers.values()) {
      if (cover.hits >= 2 || impact.y < cover.minY - .5 || impact.y > cover.maxY + 1
        || Math.hypot(impact.x - (cover.x + .5), impact.z - (cover.z + .5)) > radius) continue;
      this.setMiniBossCoverHits(mobId, cover, cover.hits + 1);
    }
  }

  private erodeMiniBossArenaCover(mobId: string, phase: AreaLeaderPhase): void {
    const covers = [...(this.miniBossArenaCover.get(mobId)?.values() ?? [])];
    const selected = phase === 2 ? covers.slice(0, 2) : covers;
    for (const cover of selected) this.setMiniBossCoverHits(mobId, cover, phase === 3 ? 2 : 1);
  }

  private restoreMiniBossArena(mobId: string): void {
    const covers = this.miniBossArenaCover.get(mobId);
    if (!covers) return;
    for (const cover of covers.values()) for (const cell of cover.original) {
      this.setMiniBossArenaBlock(mobId, cover.x, cell.y, cover.z, cell.block, "restore");
    }
    this.miniBossArenaCover.delete(mobId);
    for (const [hazardId, hazard] of this.mobHazards) if (hazard.mobId === mobId
      && (hazardId.startsWith("arena-pressure:") || hazardId.startsWith("hunt-pincer:"))) {
      this.mobHazards.delete(hazardId);
    }
  }

  private placeMiniBossArenaPressure(mobId: string, mob: MobState, phase: AreaLeaderPhase, now: number): void {
    if (phase === 1) return;
    const duration = phase === 3 ? 4_000 : 3_200;
    for (const [index, site] of miniBossPressureSites(mob, phase, mob.actionSequence).entries()) {
      const hazardId = `arena-pressure:${mobId}:${mob.actionSequence}:${index}`;
      const expiresAt = now + duration;
      this.mobHazards.set(hazardId, { hazardId, mobId, ...site, radius: .68, damage: 1,
        expiresAt, nextDamageAt: now + 550, lastDamageAt: new Map() });
      this.broadcast("combat:mob-hazard", { hazardId, mobId, kind: "pressure", ...site,
        radius: .68, expiresAt } satisfies MobHazardPlaced);
    }
  }

  private placeHuntChampionPincer(mobId: string, target: { x: number; y: number; z: number }, yaw: number,
    difficulty: HuntDifficulty, now: number): void {
    const duration = difficulty === "ascendant" ? 3_400 : 2_700;
    for (const [index, site] of huntChampionPincerSites(target, yaw, difficulty).entries()) {
      const hazardId = `hunt-pincer:${mobId}:${this.state.mobs.get(mobId)?.actionSequence ?? 0}:${index}`;
      const expiresAt = now + duration;
      this.mobHazards.set(hazardId, { hazardId, mobId, ...site, radius: .72, damage: 1,
        expiresAt, nextDamageAt: now + 550, lastDamageAt: new Map() });
      this.broadcast("combat:mob-hazard", { hazardId, mobId, kind: "pressure", ...site,
        radius: .72, expiresAt } satisfies MobHazardPlaced);
    }
  }

  private activeSilverDepthsParticipants(): string[] {
    return [...this.silverDepthsRuns.entries()].flatMap(([id, run]) =>
      run.completedAt === 0 && this.state.players.has(id) ? [id] : []);
  }

  private handleSilverDepthsPing(client: Client, payload: unknown): void {
    if (this.roomKind !== "silver-depths" || !this.silverDepthsRoster.has(client.sessionId)
      || !this.activeSilverDepthsParticipants().includes(client.sessionId)
      || this.silverDepthsFallen.has(client.sessionId) || this.silverDepthsDisconnected.has(client.sessionId)) return;
    const player = this.state.players.get(client.sessionId);
    const parsed = SilverDepthsPingRequestSchema.safeParse(payload);
    if (!player || player.health <= 0 || Math.abs(player.y - 1) > 3 || !parsed.success) return;
    const location = silverDepthsPingLocation(parsed.data.x, parsed.data.z);
    if (!location) return;
    const now = Date.now();
    if (now - (this.lastSilverDepthsPingAt.get(client.sessionId) ?? -Infinity) < 1500) return;
    this.lastSilverDepthsPingAt.set(client.sessionId, now);
    const ping: SilverDepthsPing = { senderId: client.sessionId, senderName: player.name,
      ...location, durationMs: 8000 };
    this.silverDepthsPings.set(client.sessionId, { ...ping, expiresAt: now + ping.durationMs });
    this.broadcast("depths:ping", ping);
  }

  private silverDepthsPartyStatus(): SilverDepthsPartyStatus {
    const active = new Set(this.activeSilverDepthsParticipants());
    const cleared = this.state.mobs.get(CRYSTAL_MATRIARCH_ID)?.alive === false;
    return { phase: cleared ? "cleared" : active.size > 0 ? "active" : "wiped",
      stage: this.silverDepthsEncounterStage,
      activeCount: [...active].filter(id => !this.silverDepthsDisconnected.has(id)).length,
      partySize: this.silverDepthsRoster.size,
      members: [...this.silverDepthsRoster].map(([id, name]) => ({ id, name,
        state: this.silverDepthsFallen.has(id) ? "fallen" as const
          : !active.has(id) ? "left" as const
          : this.silverDepthsDisconnected.has(id) ? "reconnecting" as const : "fighting" as const })) };
  }

  private broadcastSilverDepthsPartyStatus(): void {
    if (this.roomKind !== "silver-depths" || this.silverDepthsRoster.size === 0) return;
    const status = this.silverDepthsPartyStatus();
    for (const client of this.clients) client.send("depths:party-status", status);
  }

  private setSilverDepthsRunStage(stage: number): void {
    for (const id of this.activeSilverDepthsParticipants()) {
      const player = this.state.players.get(id);
      if (player) player.silverDepthsRunStage = stage;
    }
    this.refreshNearbyObjectives();
  }

  private setSilverDepthsGate(gate: { x: number; minZ: number; maxZ: number }, open: boolean, label: string): void {
    for (let z = gate.minZ; z <= gate.maxZ; z++) for (let y = 1; y <= 4; y++) {
      const address = worldToChunk(gate.x, z), stored = this.getChunk(address.chunkX, address.chunkZ);
      const block = open ? Block.Air : Block.Stone;
      if (getBlock(stored.chunk, address.localX, y, address.localZ) === block) continue;
      setBlock(stored.chunk, address.localX, y, address.localZ, block); stored.revision++;
      this.broadcast("block:changed", { requestId: `depths-${label}-${open ? "open" : "close"}-${z}:${y}`,
        x: gate.x, y, z, block, revision: stored.revision } satisfies BlockChanged);
    }
    if (label === "gallery-gate" || label === "boss-gate") {
      this.silverDepthsGates[label === "gallery-gate" ? "gallery" : "boss"] = open;
      this.broadcast("depths:gates", { ...this.silverDepthsGates } satisfies SilverDepthsGateStatus);
    }
  }

  private setSilverDepthsWingGate(gate: { z: number; minX: number; maxX: number }, open: boolean, label: string): void {
    for (let x = gate.minX; x <= gate.maxX; x++) for (let y = 1; y <= 4; y++) {
      const address = worldToChunk(x, gate.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      const block = open ? Block.Air : Block.Stone;
      if (getBlock(stored.chunk, address.localX, y, address.localZ) === block) continue;
      setBlock(stored.chunk, address.localX, y, address.localZ, block); stored.revision++;
      this.broadcast("block:changed", { requestId: `depths-${label}-${open ? "open" : "close"}-${x}:${y}`,
        x, y, z: gate.z, block, revision: stored.revision } satisfies BlockChanged);
    }
    if (label === "iron-wing-gate" || label === "silver-wing-gate") {
      this.silverDepthsGates[label === "iron-wing-gate" ? "iron" : "silver"] = open;
      this.broadcast("depths:gates", { ...this.silverDepthsGates } satisfies SilverDepthsGateStatus);
    }
  }

  private spawnSilverDepthsStage(stage: SilverDepthsEncounterStage): void {
    for (const entry of silverDepthsStageSpawns(stage, this.silverDepthsWing ?? undefined)) {
      if (this.state.mobs.has(entry.id)) continue;
      this.registerMob(entry.id, entry.archetype, entry);
      const mob = this.state.mobs.get(entry.id)!;
      const scaled = silverDepthsScaledStats(entry, this.instancePartySize);
      mob.name = entry.name;
      mob.health = mob.maxHealth = scaled.health;
      mob.attackDamage += scaled.damageBonus;
      mob.speedMultiplier *= scaled.speedMultiplier;
      mob.level = entry.level;
      mob.difficultyTier = stage === 1 ? 2 : 3;
      if (entry.id === CRYSTAL_MATRIARCH_ID) {
        mob.isChampion = true; mob.enraged = false; mob.attackPattern = crystalMatriarchPattern(0, false); mob.rewardMultiplier *= 1.5;
      }
    }
  }

  private chooseSilverDepthsWing(client: Client, payload: unknown): void {
    const parsed = SilverDepthsRouteRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player || player.health <= 0 || !isInsideSilverDepths(player)
      || this.roomKind !== "silver-depths" || this.silverDepthsEncounterStage !== 2) return;
    if (this.silverDepthsWing) {
      client.send("portal:notice", `The party already chose the ${this.silverDepthsWing === "iron" ? "Iron Bastion" : "Silver Echo"} route.`);
      return;
    }
    this.silverDepthsWing = parsed.data.wing;
    this.silverDepthsCacheOpened = false;
    this.silverDepthsCacheAmbushPhase = "sealed";
    this.silverDepthsCacheAmbushReleaseAt = 0;
    this.silverDepthsNextHazardAt = Date.now() + 3_500;
    this.setSilverDepthsWingGate(this.silverDepthsWing === "iron" ? SILVER_DEPTHS_IRON_GATE : SILVER_DEPTHS_SILVER_GATE,
      true, `${this.silverDepthsWing}-wing-gate`);
    for (const id of this.activeSilverDepthsParticipants()) {
      const participant = this.state.players.get(id);
      if (participant) participant.silverDepthsWing = this.silverDepthsWing;
      this.clients.find(other => other.sessionId === id)?.send("portal:notice",
        this.silverDepthsWing === "iron"
          ? "IRON BASTION CHOSEN · defeat the Iron Warden in the northern wing for iron ore."
          : "SILVER ECHO CHOSEN · dodge the Echo Spitters in the southern wing for silver ore.");
    }
    this.spawnSilverDepthsStage(2);
    this.broadcastSilverDepthsCacheStatus();
    this.refreshNearbyObjectives();
  }

  private silverDepthsCacheStatus(): SilverDepthsCacheStatus | null {
    if (this.roomKind !== "silver-depths" || !this.silverDepthsWing) return null;
    const cache = SILVER_DEPTHS_WING_CACHES[this.silverDepthsWing];
    return { wing: this.silverDepthsWing, x: cache.x, z: cache.z, itemId: cache.itemId,
      quantity: cache.quantity, opened: this.silverDepthsCacheOpened, phase: this.silverDepthsCacheAmbushPhase,
      guardsRemaining: this.silverDepthsCacheAmbushPhase === "warning" ? SILVER_DEPTHS_CACHE_GUARDS[this.silverDepthsWing].length
        : this.silverDepthsCacheAmbushPhase === "fighting" ? SILVER_DEPTHS_CACHE_GUARDS[this.silverDepthsWing]
          .filter(guard => this.state.mobs.get(guard.id)?.alive).length : 0 };
  }

  private sendSilverDepthsCacheStatus(client: Client): void {
    const status = this.silverDepthsCacheStatus();
    if (status) client.send("depths:cache", status);
  }

  private broadcastSilverDepthsCacheStatus(): void {
    const status = this.silverDepthsCacheStatus();
    if (status) this.broadcast("depths:cache", status);
  }

  private openSilverDepthsCache(): void {
    if (!this.silverDepthsWing || this.silverDepthsCacheOpened) return;
    this.silverDepthsCacheOpened = true;
    this.silverDepthsCacheAmbushPhase = "warning";
    this.silverDepthsCacheAmbushReleaseAt = Date.now() + 2_200;
    for (const id of this.activeSilverDepthsParticipants()) {
      this.clients.find(client => client.sessionId === id)?.send("portal:notice",
        `CACHE DISTURBED · guards arrive in two seconds! Retreat toward the wing gate; the western lane stays open.`);
    }
    this.broadcastSilverDepthsCacheStatus();
  }

  private advanceSilverDepthsCacheAmbush(now: number = Date.now()): void {
    if (this.roomKind !== "silver-depths" || !this.silverDepthsWing) return;
    const guards = SILVER_DEPTHS_CACHE_GUARDS[this.silverDepthsWing];
    if (this.silverDepthsCacheAmbushPhase === "warning") {
      if (now < this.silverDepthsCacheAmbushReleaseAt) return;
      this.silverDepthsCacheAmbushReleaseAt = 0;
      this.silverDepthsCacheAmbushPhase = "fighting";
      for (const entry of guards) {
        this.registerMob(entry.id, entry.archetype, entry);
        const mob = this.state.mobs.get(entry.id)!;
        const scaled = silverDepthsScaledStats({ ...entry, stage: 2, wing: this.silverDepthsWing }, this.instancePartySize);
        mob.name = entry.name;
        mob.health = mob.maxHealth = scaled.health;
        mob.attackDamage += scaled.damageBonus;
        mob.speedMultiplier *= scaled.speedMultiplier;
        mob.level = entry.level;
        mob.difficultyTier = 3;
      }
      for (const id of this.activeSilverDepthsParticipants()) this.clients.find(client => client.sessionId === id)?.send("portal:notice",
        `CACHE AMBUSH · defeat ${guards.length} guards for the guaranteed materials, or retreat toward the gate.`);
      this.broadcastSilverDepthsCacheStatus();
      return;
    }
    if (this.silverDepthsCacheAmbushPhase !== "fighting") return;
    if (guards.some(guard => this.state.mobs.get(guard.id)?.alive !== false)) {
      this.broadcastSilverDepthsCacheStatus();
      return;
    }
    this.silverDepthsCacheAmbushPhase = "cleared";
    const cache = SILVER_DEPTHS_WING_CACHES[this.silverDepthsWing];
    for (const id of this.activeSilverDepthsParticipants()) {
      const drop = new LootDropState();
      Object.assign(drop, { x: cache.x + .5, y: 1.22, z: cache.dropZ, ownerId: id,
        itemId: cache.itemId, quantity: cache.quantity, expiresAt: Number.MAX_SAFE_INTEGER });
      this.state.lootDrops.set(`depths-mining-cache:${id}`, drop);
      this.clients.find(client => client.sessionId === id)?.send("portal:notice",
        `CACHE SECURED · collect ${cache.quantity} ${ITEM_DEFINITIONS[cache.itemId].name} at the seam.`);
    }
    this.broadcastSilverDepthsCacheStatus();
  }

  private silverDepthsWingRewardStatus(playerId: string): SilverDepthsWingRewardStatus | null {
    if (this.roomKind !== "silver-depths" || !this.silverDepthsWing || this.silverDepthsEncounterStage < 3
      || !this.silverDepthsRuns.has(playerId)) return null;
    const iron = this.silverDepthsWing === "iron";
    const participants = this.activeSilverDepthsParticipants();
    return { wing: this.silverDepthsWing, oreItemId: iron ? "iron_ore" : "silver_ore",
      oreQuantity: iron ? 5 : 3, gearItemId: iron ? "bastion_plate" : "echo_prism",
      oreCollected: !this.state.lootDrops.has(`depths-wing-reward:${playerId}`),
      gearCollected: !this.state.lootDrops.has(`depths-wing-gear:${playerId}`),
      partyGearClaimed: participants.filter(id => !this.state.lootDrops.has(`depths-wing-gear:${id}`)).length,
      partyGearTotal: participants.length };
  }

  private sendSilverDepthsWingRewardStatus(playerId: string): void {
    const status = this.silverDepthsWingRewardStatus(playerId);
    if (status) this.clients.find(client => client.sessionId === playerId)?.send("depths:wing-rewards", status);
  }

  private silverDepthsCheckpointStatus(playerId: string): SilverDepthsCheckpointStatus | null {
    if (this.roomKind !== "silver-depths" || !this.silverDepthsRuns.has(playerId)
      || (!this.silverDepthsAwaitingReady && this.silverDepthsEncounterStage !== 4)) return null;
    const participants = this.activeSilverDepthsParticipants();
    const rewards = this.silverDepthsWingRewardStatus(playerId);
    return { phase: this.silverDepthsAwaitingReady ? "waiting" : "open",
      readyCount: participants.filter(id => this.silverDepthsCheckpointReady.has(id)).length,
      partyTotal: participants.length, selfReady: this.silverDepthsCheckpointReady.has(playerId),
      rewardsCollected: Boolean(rewards?.oreCollected && rewards.gearCollected) };
  }

  private sendSilverDepthsCheckpointStatus(playerId: string): void {
    const status = this.silverDepthsCheckpointStatus(playerId);
    if (status) this.clients.find(client => client.sessionId === playerId)?.send("depths:checkpoint", status);
  }

  private refreshSilverDepthsCheckpointReady(): void {
    if (!this.silverDepthsAwaitingReady) return;
    const participants = this.activeSilverDepthsParticipants();
    if (participants.length > 0 && participants.every(id => this.silverDepthsCheckpointReady.has(id))) {
      this.silverDepthsAwaitingReady = false;
      this.setSilverDepthsGate(SILVER_DEPTHS_BOSS_GATE, true, "boss-gate");
      this.spawnSilverDepthsStage(4); this.setSilverDepthsRunStage(5);
      for (const id of participants) {
        this.advanceSilverDepthsExpedition(id, "defeated_guards");
        this.clients.find(client => client.sessionId === id)?.send("portal:notice",
          "PARTY READY · the Matriarch arena is open.");
      }
    }
    for (const id of participants) this.sendSilverDepthsCheckpointStatus(id);
  }

  private handleSilverDepthsCheckpointReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!this.silverDepthsAwaitingReady || !player || player.health <= 0
      || !this.activeSilverDepthsParticipants().includes(client.sessionId)) return;
    if (Math.hypot(player.x - SILVER_DEPTHS_CHECKPOINT_POSITION.x, player.z - SILVER_DEPTHS_CHECKPOINT_POSITION.z) > 6
      || Math.abs(player.y - SILVER_DEPTHS_CHECKPOINT_POSITION.y) > 3) {
      client.send("portal:notice", "Move to the Crystal Checkpoint to ready up."); return;
    }
    if (this.silverDepthsCheckpointReady.has(client.sessionId)) return;
    this.silverDepthsCheckpointReady.add(client.sessionId);
    this.refreshSilverDepthsCheckpointReady();
  }

  private spawnSilverDepthsWingRewards(): void {
    if (!this.silverDepthsWing) return;
    const iron = this.silverDepthsWing === "iron";
    const site = iron ? { x: 102.5, y: 1.22, z: -9.5 } : { x: 104.5, y: 1.22, z: 33.5 };
    const participants = this.activeSilverDepthsParticipants();
    for (const id of participants) {
      const ore = new LootDropState();
      Object.assign(ore, site, { ownerId: id, itemId: iron ? "iron_ore" : "silver_ore",
        quantity: iron ? 5 : 3, expiresAt: Number.MAX_SAFE_INTEGER });
      this.state.lootDrops.set(`depths-wing-reward:${id}`, ore);
      const gear = new LootDropState();
      Object.assign(gear, { ...site, x: site.x + 2 }, { ownerId: id,
        itemId: iron ? "bastion_plate" : "echo_prism", quantity: 1, expiresAt: Number.MAX_SAFE_INTEGER });
      this.state.lootDrops.set(`depths-wing-gear:${id}`, gear);
      this.clients.find(client => client.sessionId === id)?.send("portal:notice",
        `${iron ? "IRON BASTION" : "SILVER ECHO"} CLEARED · collect your personal ${iron ? "Bastion Plate and iron" : "Echo Prism and silver"} ore, then reach the checkpoint.`);
    }
    for (const id of participants) this.sendSilverDepthsWingRewardStatus(id);
  }

  private spawnSilverDepthsWingSupplies(): void {
    const sites = [{ x: 102.5, y: 1.22, z: -10.5 }, { x: 104.5, y: 1.22, z: 32.5 }];
    for (const playerId of this.activeSilverDepthsParticipants()) for (const [index, site] of sites.entries()) {
      const id = `depths-supply:${playerId}:${index}`;
      if (this.state.lootDrops.has(id)) continue;
      const drop = new LootDropState();
      Object.assign(drop, site, { ownerId: playerId, itemId: "healing_potion", quantity: 1, expiresAt: Number.MAX_SAFE_INTEGER });
      this.state.lootDrops.set(id, drop);
    }
  }

  private activateSilverDepthsCheckpoint(): void {
    for (const playerId of this.activeSilverDepthsParticipants()) {
      const player = this.state.players.get(playerId); if (!player) continue;
      player.health = player.maxHealth; player.stamina = player.maxStamina;
      this.clients.find(client => client.sessionId === playerId)?.send("portal:notice",
        "CHECKPOINT LIT · health and stamina restored · the Crystal Antechamber is open.");
    }
  }

  private advanceSilverDepthsEncounter(mobId: string): void {
    if (this.roomKind !== "silver-depths") return;
    const entry = SILVER_DEPTHS_ENCOUNTERS.find(candidate => candidate.id === mobId);
    if (!entry || entry.stage !== this.silverDepthsEncounterStage || (entry.stage === 2 && entry.wing !== this.silverDepthsWing)) return;
    const cleared = silverDepthsStageSpawns(entry.stage, this.silverDepthsWing ?? undefined).every(candidate =>
      candidate.id === mobId || this.state.mobs.get(candidate.id)?.alive === false);
    if (!cleared || entry.stage === 4) return;
    const nextStage = (entry.stage + 1) as SilverDepthsEncounterStage;
    this.silverDepthsEncounterStage = nextStage;
    if (entry.stage === 2) {
      this.silverDepthsNextHazardAt = 0;
      this.silverDepthsPendingHazards.length = 0;
    }
    if (entry.stage === 1) {
      this.setSilverDepthsRunStage(3);
      for (const id of this.activeSilverDepthsParticipants()) this.clients.find(client => client.sessionId === id)?.send("portal:notice",
        "GALLERY WAVE CLEARED · choose the Iron Bastion or Silver Echo route on your dungeon map.");
    } else if (entry.stage === 2) {
      this.spawnSilverDepthsWingRewards();
      this.setSilverDepthsGate(SILVER_DEPTHS_GALLERY_GATE, true, "gallery-gate");
      this.activateSilverDepthsCheckpoint(); this.spawnSilverDepthsStage(3); this.setSilverDepthsRunStage(4);
    } else {
      this.silverDepthsAwaitingReady = true;
      this.silverDepthsCheckpointReady.clear();
      for (const id of this.activeSilverDepthsParticipants()) {
        this.clients.find(client => client.sessionId === id)?.send("portal:notice",
          "CRYSTAL ANTECHAMBER CLEARED · collect your rewards, regroup at the checkpoint, then ready up for the Matriarch.");
        this.sendSilverDepthsCheckpointStatus(id);
      }
    }
  }

  private resetSilverDepthsInstance(): void {
    for (const id of SILVER_DEPTHS_ENEMY_IDS) this.state.mobs.delete(id);
    for (const id of SILVER_DEPTHS_CACHE_GUARD_IDS) {
      this.state.mobs.delete(id);
      this.mobHomes.delete(id);
      this.mobNavigation.delete(id);
      this.combatContributions.clear(id);
    }
    for (const id of [...this.state.lootDrops.keys()]) if (id.startsWith("depths-supply:") || id.startsWith("depths-wing-reward:") || id.startsWith("depths-wing-gear:") || id.startsWith("depths-mining-cache:")) this.state.lootDrops.delete(id);
    this.silverDepthsCacheOpened = false;
    this.silverDepthsCacheAmbushPhase = "sealed";
    this.silverDepthsCacheAmbushReleaseAt = 0;
    for (const cache of Object.values(SILVER_DEPTHS_WING_CACHES)) {
      const address = worldToChunk(cache.x, cache.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, cache.y, address.localZ) === cache.block) continue;
      setBlock(stored.chunk, address.localX, cache.y, address.localZ, cache.block); stored.revision++;
      this.broadcast("block:changed", { requestId: `depths-cache-${cache.x}:${cache.z}-restore`,
        x: cache.x, y: cache.y, z: cache.z, block: cache.block, revision: stored.revision } satisfies BlockChanged);
    }
    this.silverDepthsEncounterStage = 1; this.silverDepthsSealOpened = false; this.silverDepthsGates.seal = false; this.silverDepthsWing = null;
    this.silverDepthsAwaitingReady = false; this.silverDepthsCheckpointReady.clear();
    this.silverDepthsRoster.clear(); this.silverDepthsFallen.clear(); this.silverDepthsDisconnected.clear();
    this.silverDepthsNextHazardAt = 0; this.silverDepthsPendingHazards.length = 0;
    this.setSilverDepthsWingGate(SILVER_DEPTHS_IRON_GATE, false, "iron-wing-gate");
    this.setSilverDepthsWingGate(SILVER_DEPTHS_SILVER_GATE, false, "silver-wing-gate");
    this.setSilverDepthsGate(SILVER_DEPTHS_GALLERY_GATE, false, "gallery-gate");
    this.setSilverDepthsGate(SILVER_DEPTHS_BOSS_GATE, false, "boss-gate");
    this.restoreMatriarchCover(); this.restoreSilverDepthsMoonstone(); this.spawnSilverDepthsStage(1);
  }

  private damageMatriarchCover(impact: { x: number; y: number; z: number }): void {
    const cover = SILVER_DEPTHS_COVER.find(candidate =>
      Math.hypot(impact.x - (candidate.x + .5), impact.z - (candidate.z + .5)) <= .9
      && impact.y >= .5 && impact.y <= candidate.height + 1.5);
    if (!cover) return;
    const key = `${cover.x}:${cover.z}`;
    const hits = (this.matriarchCoverHits.get(key) ?? 0) + 1;
    if (hits < 2) { this.matriarchCoverHits.set(key, hits); return; }
    this.matriarchCoverHits.delete(key);
    for (let y = 1; y <= cover.height; y++) {
      const address = worldToChunk(cover.x, cover.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, y, address.localZ) === Block.Air) continue;
      setBlock(stored.chunk, address.localX, y, address.localZ, Block.Air); stored.revision++;
      this.broadcast("block:changed", { requestId: `matriarch-cover-${key}-break`, x: cover.x, y, z: cover.z,
        block: Block.Air, revision: stored.revision } satisfies BlockChanged);
    }
  }

  private restoreMatriarchCover(): void {
    this.matriarchCoverHits.clear();
    for (const cover of SILVER_DEPTHS_COVER) for (let y = 1; y <= cover.height; y++) {
      const address = worldToChunk(cover.x, cover.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, y, address.localZ) === Block.Stone) continue;
      setBlock(stored.chunk, address.localX, y, address.localZ, Block.Stone); stored.revision++;
      this.broadcast("block:changed", { requestId: `matriarch-cover-${cover.x}:${cover.z}-restore`, x: cover.x, y, z: cover.z,
        block: Block.Stone, revision: stored.revision } satisfies BlockChanged);
    }
  }

  private restoreSilverDepthsMoonstone(): void {
    const x = Math.floor(SILVER_DEPTHS_MOONSTONE_SEAL_POSITION.x);
    const cells = [10, 11, 12, 13, 14, 15].map(z => ({ x, y: 1, z }));
    for (const cell of cells) {
      const address = worldToChunk(cell.x, cell.z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, cell.y, address.localZ) === Block.MoonstoneOre) continue;
      setBlock(stored.chunk, address.localX, cell.y, address.localZ, Block.MoonstoneOre); stored.revision++;
      this.broadcast("block:changed", { requestId: `depths-moonstone-${cell.x}:${cell.y}:${cell.z}-restore`, ...cell,
        block: Block.MoonstoneOre, revision: stored.revision } satisfies BlockChanged);
    }
  }

  private openSilverDepthsMoonstoneGate(requestId: string): void {
    const x = Math.floor(SILVER_DEPTHS_MOONSTONE_SEAL_POSITION.x);
    for (let z = 10; z <= 15; z++) {
      const address = worldToChunk(x, z), stored = this.getChunk(address.chunkX, address.chunkZ);
      if (getBlock(stored.chunk, address.localX, 1, address.localZ) === Block.Air) continue;
      setBlock(stored.chunk, address.localX, 1, address.localZ, Block.Air); stored.revision++;
      this.recordWorldDelta(x, 1, z, Block.Air);
      this.broadcast("block:changed", { requestId: `${requestId}-gate-${z}`, x, y: 1, z,
        block: Block.Air, revision: stored.revision } satisfies BlockChanged);
    }
    if (this.roomKind === "silver-depths" && !this.silverDepthsSealOpened) {
      this.silverDepthsSealOpened = true;
      this.silverDepthsGates.seal = true;
      this.broadcast("depths:gates", { ...this.silverDepthsGates } satisfies SilverDepthsGateStatus);
      this.spawnSilverDepthsWingSupplies();
      this.setSilverDepthsRunStage(2);
      for (const id of this.activeSilverDepthsParticipants()) this.advanceSilverDepthsExpedition(id, "mined_moonstone");
    }
  }

  private placeGuardianRootLanes(mob: MobState, now: number): void {
    for (const [index, root] of rootLaneHazards({ x: mob.attackStrikeX, y: mob.attackStrikeY, z: mob.attackStrikeZ }).entries()) {
      const hazardId = `root:forest-guardian:${mob.actionSequence}:${index}`;
      const expiresAt = now + ROOT_LANE_DURATION_MS;
      this.mobHazards.set(hazardId, { hazardId, mobId: "forest-guardian", ...root, radius: ROOT_LANE_RADIUS,
        damage: 1, expiresAt, nextDamageAt: now + 350, lastDamageAt: new Map() });
      this.broadcast("combat:mob-hazard", { hazardId, mobId: "forest-guardian", kind: "root", ...root,
        radius: ROOT_LANE_RADIUS, expiresAt } satisfies MobHazardPlaced);
    }
  }

  private spawnForestStage(stage: number): void {
    const scalePlayers = this.forestDungeonRun?.scalePlayers ?? 1;
    const healthScale = 1 + Math.max(0, scalePlayers - 1) * 0.45;
    for (const entry of FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage)) {
      if (this.state.mobs.has(entry.id)) continue;
      this.registerMob(entry.id, entry.archetype, entry);
      const mob = this.state.mobs.get(entry.id)!;
      mob.name = stage === 3 ? "Ancient Root Guardian" : stage === 2 ? "Thicket Guard" : "Forest Sentinel";
      const baseHealth = stage === 3 ? 28 : entry.archetype === "cave_spitter" ? 8 : 10;
      mob.health = mob.maxHealth = Math.ceil(baseHealth * healthScale);
      mob.attackDamage = (stage === 3 ? 2 : 1) + (scalePlayers >= 3 ? 1 : 0);
      mob.speedMultiplier = 1 + Math.max(0, scalePlayers - 1) * 0.04; mob.rewardMultiplier = 1;
      if (stage === 2 && entry.id.endsWith("-b")) mob.actionSequence = 1;
      if (stage === 3) { mob.isChampion = true; mob.enraged = false; mob.attackPattern = "slam"; mob.rewardMultiplier = 1.5; }
      mob.level = stage === 3 ? 10 : stage === 2 ? 8 : 6;
    }
  }

  private advanceForestDungeon(): void {
    for (const stage of [1, 2]) {
      const cleared = FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage).every(entry => this.state.mobs.get(entry.id)?.alive === false);
      const nextSpawned = FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage + 1).some(entry => this.state.mobs.has(entry.id));
      if (cleared && !nextSpawned) {
        this.forestGate(stage === 1 ? 168 : 180, true); this.spawnForestStage(stage + 1);
        for (const client of this.clients) {
          const player = this.state.players.get(client.sessionId);
          if (player && isInForestDungeon(player.x, player.z)) client.send("portal:notice", `Room ${stage} cleared · the next root gate has opened.`);
        }
      }
    }
    if (this.state.mobs.get("forest-guardian")?.alive === false && !this.state.portals.has("forest-victory")) {
      const portal = new ForestPortalState(); Object.assign(portal, { kind: "return", x: 189.5, y: 8, z: 165.5 });
      this.state.portals.set("forest-victory", portal);
      if (this.forestDungeonRun && this.forestDungeonRun.completedAt === 0) {
        this.forestDungeonRun.completedAt = Date.now();
        const durationMs = Math.max(1, Date.now() - this.forestDungeonRun.startedAt);
        const cooldownUntil = Date.now() + 45_000;
        const guardian = this.state.mobs.get("forest-guardian")!;
        let cacheIndex = 0;
        for (const playerId of this.forestDungeonRun.entered) {
          this.forestDungeonCooldownUntil.set(playerId, cooldownUntil);
          const participant = this.state.players.get(playerId);
          if (participant && (participant.forestBestTimeMs === 0 || durationMs < participant.forestBestTimeMs)) {
            participant.forestBestTimeMs = durationMs;
            void this.persistPlayer(playerId, participant);
          }
          const featuredReward = participant
            ? forestCacheFeaturedReward(itemId => (participant.inventory.get(itemId)?.quantity ?? 0) + (participant.storage.get(itemId)?.quantity ?? 0))
            : "silver_ore";
          this.clients.find(client => client.sessionId === playerId)?.send("dungeon:run", {
            runId: this.forestDungeonRun.id,
            phase: "completed",
            partySize: this.forestDungeonRun.entered.size,
            durationMs,
            cooldownUntil,
            reward: `Personal cache: ${forestCacheRewardLabel(featuredReward)}`,
          } satisfies DungeonRunUpdate);
          const angle = (cacheIndex++ / Math.max(1, this.forestDungeonRun.entered.size)) * Math.PI * 2;
          const cache = new LootDropState();
          Object.assign(cache, { ownerId: playerId, itemId: featuredReward, quantity: 1,
            x: guardian.x + Math.cos(angle) * 1.25, y: guardian.y + .22, z: guardian.z + Math.sin(angle) * 1.25,
            expiresAt: Number.MAX_SAFE_INTEGER });
          this.state.lootDrops.set(`forest-cache:${this.forestDungeonRun.id}:${playerId}`, cache);
        }
      }
      for (const client of this.clients) {
        const player = this.state.players.get(client.sessionId);
        if (player && isInForestDungeon(player.x, player.z)) client.send("portal:notice", "Guardian defeated! Claim your personal Rootbound Cache, then use the return portal.");
      }
    }
  }

  private forestDungeonStage(): 0 | 1 | 2 | 3 {
    if (!this.forestDungeonActive) return 0;
    if (this.state.mobs.get("forest-guardian")) return 3;
    if (FOREST_DUNGEON_MOBS.some(entry => entry.stage === 2 && this.state.mobs.has(entry.id))) return 2;
    return 1;
  }

  private sendDungeonBoard(client: Client, message = "Prepare a dungeon run, then open a reserved portal for your group."): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const cooldownUntil = this.forestDungeonCooldownUntil.get(client.sessionId) ?? 0;
    client.send("dungeon:board", {
      available: !this.forestDungeonActive && this.forestDungeonRun === null && Date.now() >= cooldownUntil,
      active: this.forestDungeonActive || this.forestDungeonRun !== null,
      leader: this.parties.isLeader(client.sessionId),
      partySize: this.parties.cohort(client.sessionId).members.length,
      stage: this.forestDungeonStage(),
      cooldownUntil,
      bestTimeMs: player.forestBestTimeMs,
      portalExpiresAt: this.state.portals.get("forest-entry")?.expiresAt ?? 0,
      message,
    } satisfies DungeonBoardUpdate);
  }

  private handleDungeonBoard(client: Client, payload: unknown): void {
    const parsed = DungeonBoardRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (parsed.data.action === "sync") { this.sendDungeonBoard(client); return; }
    if (Math.abs(player.y - TOWN_EXPEDITION_BOARD_POSITION.y) > 1.6
      || Math.hypot(player.x - TOWN_EXPEDITION_BOARD_POSITION.x, player.z - TOWN_EXPEDITION_BOARD_POSITION.z) > 3) {
      this.sendDungeonBoard(client, "Move closer to the dungeon gate."); return;
    }
    if (!this.parties.isLeader(client.sessionId)) {
      this.sendDungeonBoard(client, "Only the party leader can launch the dungeon run."); return;
    }
    const now = Date.now(), cooldownUntil = this.forestDungeonCooldownUntil.get(client.sessionId) ?? 0;
    if (now < cooldownUntil) {
      this.sendDungeonBoard(client, `Your expedition recovers in ${Math.ceil((cooldownUntil - now) / 1000)} seconds.`); return;
    }
    if (this.forestDungeonActive || this.forestDungeonRun) {
      this.sendDungeonBoard(client, "The Forest Dungeon is occupied by another group."); return;
    }
    const cohort = this.parties.cohort(client.sessionId);
    this.forestDungeonUnlocked = true;
    this.forestDungeonRun = { id: `forest-run-${++this.forestDungeonRunSequence}`, key: cohort.key,
      allowed: new Set(cohort.members.filter(id => this.state.players.has(id))), entered: new Set(), ready: new Set(), claimed: new Set(), phase: "lobby", scalePlayers: 1, startedAt: 0, completedAt: 0 };
    const portal = new ForestPortalState();
    Object.assign(portal, TOWN_EXPEDITION_PORTAL_POSITION, { kind: "entry", expiresAt: now + 30_000 });
    this.state.portals.set("forest-entry", portal);
    this.forestDungeonReopenAt = portal.expiresAt;
    for (const memberId of this.forestDungeonRun.allowed) {
      this.clients.find(other => other.sessionId === memberId)?.send("portal:notice", "Expedition portal opened beside the board · enter within 30 seconds.");
    }
    this.sendDungeonBoard(client, "Reserved dungeon portal opened for 30 seconds.");
  }

  private realmHuntContractStatus(sessionId: string): RealmHuntContractStatus | null {
    const contract = this.huntContracts.get(sessionId);
    if (!contract) return null;
    const path = HUNT_PATHS[contract.pathId];
    const player = this.state.players.get(sessionId);
    const recordedTime = player ? parseHuntMastery(player.huntMasteryJson)[contract.pathId].bestTimesMs[contract.difficulty] : undefined;
    const targetName = contract.championActive || contract.completed ? path.championName
      : areaMainMobDefinition(contract.targetMobId)?.name ?? "Unknown Leader";
    return { pathId: contract.pathId, pathName: path.name, forgeName: path.forgeName,
      step: Math.min(contract.step, contract.targets.length), required: contract.targets.length,
      targetMobId: contract.targetMobId, targetName, modifier: contract.modifier,
      tier: huntContractTier(contract), championActive: contract.championActive,
      championName: path.championName, completed: contract.completed, failed: contract.failed,
      difficulty: contract.difficulty, livesRemaining: contract.livesRemaining,
      elapsedMs: contract.completed && recordedTime ? recordedTime : Math.max(0, Date.now() - contract.startedAt) };
  }

  private recordAscendantHuntDefeat(playerId: string, now: number): void {
    const contract = this.huntContracts.get(playerId);
    if (!contract || contract.completed || contract.difficulty !== "ascendant") return;
    const livesRemaining = Math.max(0, contract.livesRemaining - 1);
    const failed = livesRemaining === 0;
    const next = { ...contract, livesRemaining, failed, completed: failed, championActive: failed ? false : contract.championActive };
    this.huntContracts.set(playerId, next);
    if (failed) {
      this.selectedRealmHunts.delete(playerId);
      if (contract.championActive) {
        this.huntChampions.delete(contract.championMobId);
        this.state.mobs.delete(contract.championMobId);
        this.mobHomes.delete(contract.championMobId);
        this.empoweredContractTargets.delete(contract.championMobId);
        this.empoweredContractDifficulties.delete(contract.championMobId);
      }
    }
    const client = this.clients.find(candidate => candidate.sessionId === playerId);
    client?.send("chat:notice", failed ? "ASCENDANT CONTRACT FAILED · all three lives are spent."
      : `ASCENDANT LIFE LOST · ${livesRemaining} ${livesRemaining === 1 ? "life" : "lives"} remain.`);
    if (client) this.sendRealmHuntBoard(client, failed ? "Ascendant contract failed. Choose a new hunt at the board."
      : `Ascendant pressure continues · ${livesRemaining} lives remain.`);
    void now;
  }

  private empowerPlayerHuntTarget(sessionId: string): void {
    const contract = this.huntContracts.get(sessionId);
    if (!contract || contract.completed || contract.championActive) return;
    const mob = this.state.mobs.get(contract.targetMobId);
    if (!mob?.alive) return;
    const tier = huntContractTier(contract);
    const strengthTier = tier + huntDifficultyStatTier(contract.difficulty);
    const alreadyApplied = this.empoweredContractTargets.get(contract.targetMobId) ?? 0;
    const existingTier = Math.max(alreadyApplied, mob.leaderRematchTier);
    if (strengthTier > existingTier) {
      const extra = strengthTier - existingTier;
      const healthGain = Math.max(2, Math.ceil(mob.maxHealth * .1 * extra));
      mob.maxHealth = Math.min(120, mob.maxHealth + healthGain);
      mob.health = Math.min(mob.maxHealth, mob.health + healthGain);
      mob.attackDamage = Math.min(12, mob.attackDamage + Math.ceil(extra / 2));
      mob.speedMultiplier = Math.min(1.65, mob.speedMultiplier * (1 + extra * .035));
      mob.rewardMultiplier *= 1 + extra * .18;
    }
    mob.isMiniBoss = true;
    mob.leaderRematchTier = Math.max(mob.leaderRematchTier, tier);
    mob.leaderModifier = contract.modifier;
    this.empoweredContractTargets.set(contract.targetMobId, Math.max(existingTier, strengthTier));
    this.empoweredContractDifficulties.set(contract.targetMobId, contract.difficulty);
  }

  private spawnHuntChampion(ownerId: string, contract: HuntContractState, origin: { x: number; y: number; z: number }, now: number): void {
    const path = HUNT_PATHS[contract.pathId];
    const angle = (this.huntChampionSequence % 6) * Math.PI / 3;
    const spawn = { x: origin.x + Math.cos(angle) * 4, y: origin.y, z: origin.z + Math.sin(angle) * 4 };
    this.registerMob(contract.championMobId, path.championArchetype, spawn);
    const mob = this.state.mobs.get(contract.championMobId);
    if (!mob) return;
    const base = { maxHealth: mob.maxHealth, damage: mob.attackDamage, armor: mob.armor,
      speedMultiplier: mob.speedMultiplier, rewardMultiplier: Math.max(2, mob.rewardMultiplier) };
    const difficultyTier = huntDifficultyStatTier(contract.difficulty);
    const stats = leaderRematchStats(base, { tier: 5 + difficultyTier, modifier: path.championModifier, rewardLabel: "PATH CHAMPION CACHE" });
    mob.isChampion = true; mob.isMiniBoss = true; mob.name = path.championName;
    mob.health = mob.maxHealth = Math.min(120, Math.ceil(stats.maxHealth * 1.35));
    mob.attackDamage = Math.min(12, stats.damage + 1); mob.armor = stats.armor;
    mob.speedMultiplier = stats.speedMultiplier; mob.rewardMultiplier = stats.rewardMultiplier * 1.5;
    mob.leaderRematchTier = 5 + difficultyTier; mob.leaderModifier = path.championModifier;
    mob.level = Math.min(20, Math.max(mob.level, (this.state.players.get(ownerId)?.level ?? 1) + 3));
    mob.attackPattern = huntChampionPattern(contract.pathId, 0, 1, contract.difficulty); mob.combatState = "recover";
    mob.materializeUntil = now + 2_500; mob.stateUntil = mob.materializeUntil;
    this.mobBaseNames.set(contract.championMobId, path.championName);
    this.huntChampions.set(contract.championMobId, { ownerId, pathId: contract.pathId, name: path.championName, difficulty: contract.difficulty });
    this.empoweredContractDifficulties.set(contract.championMobId, contract.difficulty);
  }

  private advancePlayerHuntContract(playerId: string, defeatedMobId: string, defeated: MobState, now: number): void {
    const contract = this.huntContracts.get(playerId);
    if (!contract || contract.completed || contract.targetMobId !== defeatedMobId) return;
    const championId = `hunt-champion:${contract.pathId}:${++this.huntChampionSequence}`;
    const next = advanceHuntContract(contract, championId);
    this.huntContracts.set(playerId, next);
    const client = this.clients.find(candidate => candidate.sessionId === playerId);
    if (next.completed) {
      const cycles = this.huntContractCycles.get(playerId) ?? {};
      cycles[contract.pathId] = contract.cycle + 1; this.huntContractCycles.set(playerId, cycles);
      this.selectedRealmHunts.delete(playerId);
      const player = this.state.players.get(playerId);
      if (player) {
        const mastery = completeHuntMastery(parseHuntMastery(player.huntMasteryJson), contract.pathId,
          contract.difficulty, Math.max(1, now - contract.startedAt));
        player.huntMasteryJson = serializeHuntMastery(mastery);
        void this.persistPlayer(playerId, player, true).catch(() => {});
        const bestMs = mastery[contract.pathId].bestTimesMs[contract.difficulty] ?? now - contract.startedAt;
        client?.send("chat:notice", `HUNT MASTERY · ${HUNT_PATHS[contract.pathId].name} rank ${mastery[contract.pathId].rank} · ${contract.difficulty.toUpperCase()} best ${Math.ceil(bestMs / 1000)}s.`);
      }
      client?.send("objective:completed", { objectiveId: `hunt-contract-${contract.pathId}`,
        title: `${HUNT_PATHS[contract.pathId].name} Complete`,
        rewardLabel: `${HUNT_PATHS[contract.pathId].championName} defeated · champion cache secured`, coinsGranted: 0 } satisfies WorldObjectiveCompleted);
      client?.send("chat:notice", `CONTRACT COMPLETE · ${HUNT_PATHS[contract.pathId].championName}'s large personal cache has landed.`);
    } else if (next.championActive) {
      this.spawnHuntChampion(playerId, next, defeated, now);
      this.selectedRealmHunts.set(playerId, next.targetMobId);
      client?.send("chat:notice", `PATH CHAMPION AWAKENED · ${HUNT_PATHS[next.pathId].championName} has entered the final territory.`);
    } else {
      this.selectedRealmHunts.set(playerId, next.targetMobId);
      this.empowerPlayerHuntTarget(playerId);
      client?.send("chat:notice", `CONTRACT ${next.step}/${next.targets.length} · next leader marked ${next.modifier.toUpperCase()} at rematch tier ${huntContractTier(next)}.`);
    }
    if (client) this.sendRealmHuntBoard(client, next.completed ? "Contract complete. Choose a path to begin a harder rotation." : "Contract advanced. Your next hunt is marked near its territory.");
  }

  private sendRealmHuntBoard(client: Client, message = "Choose a path contract or track one leader. Guidance awakens only near its territory."): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const playerMastery = parseHuntMastery(player.huntMasteryJson);
    this.empowerPlayerHuntTarget(client.sessionId);
    const now = Date.now();
    const hunts: RealmHuntStatus[] = AREA_MAIN_MOBS.map(definition => {
      const mob = this.state.mobs.get(definition.id);
      const home = this.mobHomes.get(definition.id) ?? mob ?? { x: 0, y: 0, z: 0 };
      const relicId = definition.rewardItemId as AreaLeaderRelicId;
      const recipe = LEADER_FORGE_RECIPES[relicId];
      const relicTotal = (player.inventory.get(relicId)?.quantity ?? 0) + (player.storage.get(relicId)?.quantity ?? 0);
      const awakened = (player.inventory.get(recipe.markId)?.quantity ?? 0) + (player.storage.get(recipe.markId)?.quantity ?? 0) > 0;
      const pending = mob?.alive
        ? { tier: mob.leaderRematchTier, modifier: mob.leaderModifier }
        : leaderRematch(definition.id, this.leaderDefeats.get(definition.id) ?? 0);
      return {
        mobId: definition.id, name: definition.name, territory: leaderTerritory(definition.id),
        status: !mob?.alive ? "recovering" : pending.tier > 0 ? "empowered" : "alive",
        respawnSeconds: !mob?.alive ? Math.max(0, Math.ceil(((mob?.respawnAt ?? now) - now) / 1000)) : 0,
        rematchTier: pending.tier, modifier: pending.modifier,
        relicId, relicName: ITEM_DEFINITIONS[relicId].name,
        relicCount: awakened ? 3 : Math.min(3, relicTotal), awakened,
        forgeName: LEADER_FORGE_MARKS[recipe.markId].name,
        targetX: home.x, targetY: home.y, targetZ: home.z,
      } satisfies RealmHuntStatus;
    });
    client.send("realm-hunt:board", {
      selectedMobId: this.selectedRealmHunts.get(client.sessionId) ?? "", hunts,
      contract: this.realmHuntContractStatus(client.sessionId),
      mastery: Object.fromEntries(((["fang", "venom", "crusher"] as const).map(pathId => {
        const mastery = playerMastery[pathId];
        return [pathId, { rank: mastery.rank, bestTimesMs: mastery.bestTimesMs,
          veteranUnlocked: huntDifficultyUnlocked(mastery.rank, "veteran"),
          ascendantUnlocked: huntDifficultyUnlocked(mastery.rank, "ascendant") }];
      }))) as RealmHuntBoardUpdate["mastery"], message,
    } satisfies RealmHuntBoardUpdate);
  }

  private huntLoadouts(player: PlayerState): HuntLoadoutSlot[] {
    try {
      const raw = JSON.parse(player.huntLoadoutsJson) as HuntLoadoutSlot[] | { loadouts?: HuntLoadoutSlot[] };
      const parsed = Array.isArray(raw) ? raw : raw.loadouts ?? [];
      return Array.isArray(parsed) ? parsed.filter(loadout => [1, 2, 3].includes(loadout.slot)) : [];
    } catch { return []; }
  }

  private setPlayerBuildData(player: PlayerState, loadouts: HuntLoadoutSlot[], buildPath = parseBuildPathState(player.huntLoadoutsJson)): void {
    const mistfen = this.mistfenProgress(player);
    const greenwood = this.greenwoodProgress(player);
    player.huntLoadoutsJson = JSON.stringify({ loadouts, buildPath, affixes: this.equipmentAffixes(player),
      dust: this.attunementDust(player), offers: this.attunementOffers(player), mistfen, greenwood });
  }

  private equipmentAffixes(player: PlayerState): Partial<Record<ItemId, EquipmentAffixRoll>> {
    try {
      const raw = JSON.parse(player.huntLoadoutsJson) as { affixes?: unknown };
      return parseEquipmentAffixes(raw?.affixes);
    } catch { return {}; }
  }

  private setEquipmentAffixes(player: PlayerState, affixes: Partial<Record<ItemId, EquipmentAffixRoll>>): void {
    this.setEquipmentAttunements(player, affixes, this.attunementDust(player), this.attunementOffers(player));
  }

  private attunementDust(player: PlayerState): number {
    try {
      const value = (JSON.parse(player.huntLoadoutsJson) as { dust?: unknown }).dust;
      return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(65_535, Math.floor(value))) : 0;
    } catch { return 0; }
  }

  private attunementOffers(player: PlayerState): EquipmentAffixOffers {
    try { return parseEquipmentAffixOffers((JSON.parse(player.huntLoadoutsJson) as { offers?: unknown }).offers); }
    catch { return {}; }
  }

  private setEquipmentAttunements(player: PlayerState, affixes: Partial<Record<ItemId, EquipmentAffixRoll>>,
    dust: number, offers: EquipmentAffixOffers): void {
    const mistfen = this.mistfenProgress(player);
    const greenwood = this.greenwoodProgress(player);
    player.huntLoadoutsJson = JSON.stringify({ loadouts: this.huntLoadouts(player), buildPath: parseBuildPathState(player.huntLoadoutsJson),
      affixes, dust: Math.max(0, Math.min(65_535, Math.floor(dust))), offers, mistfen, greenwood });
  }

  private sendEquipmentAffixes(client: Client, message = "Equipment attunements strengthen matching Calling mechanics."): void {
    const player = this.state.players.get(client.sessionId);
    if (player) client.send("equipment:affixes", { affixes: this.equipmentAffixes(player), offers: this.attunementOffers(player),
      dust: this.attunementDust(player), message } satisfies EquipmentAffixUpdate);
  }

  private equipmentAffixTier(player: PlayerState, affixId: EquipmentAffixId): number {
    const affixes = this.equipmentAffixes(player);
    const itemIds = [player.mainHandId, player.armourId].filter(itemId => Object.hasOwn(ITEM_DEFINITIONS, itemId)) as ItemId[];
    const baseTier = itemIds.reduce((tier, itemId) => affixes[itemId]?.affixId === affixId ? Math.max(tier, affixes[itemId]!.tier) : tier, 0);
    if (baseTier === 0) return 0;
    const resonance = equipmentAffixResonanceForLoadout(player.mainHandId, player.armourId, affixes);
    return Math.min(4, baseTier + (resonance === EQUIPMENT_AFFIXES[affixId].pathId ? 1 : 0));
  }

  private attuneEquipment(client: Client, player: PlayerState, itemId: ItemId, tier: number): EquipmentAffixRoll | null {
    if (tier <= 0 || (!equipmentForItem(itemId) && !armourForItem(itemId))) return null;
    const buildPath = parseBuildPathState(player.huntLoadoutsJson).selectedPathId;
    if (tier >= 3) {
      const offers = this.attunementOffers(player);
      offers[itemId] = rollEquipmentAffixOptions(buildPath, 3).map(choice => choice.affixId);
      this.setEquipmentAttunements(player, this.equipmentAffixes(player), this.attunementDust(player), offers);
      this.sendEquipmentAffixes(client, `${ITEM_DEFINITIONS[itemId].name} unlocked three Tier 3 attunements at the blacksmith.`);
      return null;
    }
    const candidate = rollEquipmentAffix(buildPath, tier), affixes = this.equipmentAffixes(player);
    const kept = keepBetterAffix(affixes[itemId], candidate);
    if (kept === affixes[itemId]) return kept;
    affixes[itemId] = kept; this.setEquipmentAffixes(player, affixes);
    this.sendEquipmentAffixes(client, `${ITEM_DEFINITIONS[itemId].name} gained ${kept.affixId.toUpperCase()} · TIER ${kept.tier}.`);
    return kept;
  }

  private buildPathRankFor(player: PlayerState, pathId?: BuildPathId): number {
    const state = parseBuildPathState(player.huntLoadoutsJson);
    const selected = pathId ?? state.selectedPathId;
    return selected ? effectiveBuildPathRank(state, selected) : 0;
  }

  private buildSpecializationFor(player: PlayerState, pathId?: BuildPathId): BuildPathSpecializationId | null {
    const state = parseBuildPathState(player.huntLoadoutsJson);
    const selected = pathId ?? state.selectedPathId;
    return selected && state.selectedPathId === selected ? state.specializations[selected] ?? null : null;
  }

  private buildSpecializationMastered(player: PlayerState, specializationId: BuildPathSpecializationId): boolean {
    return parseBuildPathState(player.huntLoadoutsJson).mastered.includes(specializationId);
  }

  private buildPathProc(playerId: string, pathId: BuildPathId, ability: string, detail: string, durationMs = 1_400): void {
    this.clients.find(client => client.sessionId === playerId)?.send("build:path-proc",
      { pathId, ability, detail, durationMs } satisfies BuildPathProc);
  }

  private callingState(playerId: string, pathId: BuildPathId, abilityId: CallingAbilityId, label: string,
    options: { activeUntil?: number; charges?: number; targetId?: string; clear?: boolean } = {}): void {
    this.broadcast("calling:state", {
      playerId, pathId, abilityId, phase: options.clear ? "clear" : "active", label,
      ...(options.activeUntil ? { activeUntil: options.activeUntil } : {}),
      ...(options.charges !== undefined ? { charges: options.charges } : {}),
      ...(options.targetId ? { targetId: options.targetId } : {}),
    } satisfies CallingStateUpdate);
  }

  private grantMasterTrial(playerId: string, specializationId: BuildPathSpecializationId, amount = 1): void {
    const player = this.state.players.get(playerId);
    if (!player) return;
    const before = parseBuildPathState(player.huntLoadoutsJson), result = grantMasterTrialProgress(before, specializationId, amount);
    if (result.state === before) return;
    this.setPlayerBuildData(player, this.huntLoadouts(player), result.state);
    const client = this.clients.find(candidate => candidate.sessionId === playerId);
    const pathId = result.state.selectedPathId;
    const definition = pathId ? BUILD_PATH_SPECIALIZATIONS[pathId].find(option => option.id === specializationId) : null;
    if (client && definition) this.sendBuildPath(client, result.completed
      ? `${definition.name.toUpperCase()} MASTERED · ${definition.capstone}`
      : `${definition.name} trial · ${result.state.trials[specializationId] ?? 0} / ${definition.trialTarget}`);
    void this.persistPlayer(playerId, player);
  }

  private sendBuildPath(client: Client, message = "Your equipment and stat choices shape a hidden calling."): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const state = parseBuildPathState(player.huntLoadoutsJson);
    const xp = state.selectedPathId ? state.xp[state.selectedPathId] ?? 0 : 0;
    const candidates = player.level >= 5 ? buildPathAffinities(player) : [];
    const rank = state.selectedPathId ? effectiveBuildPathRank(state, state.selectedPathId) : 0;
    const specializationId = state.selectedPathId ? state.specializations[state.selectedPathId] ?? null : null;
    const specialization = state.selectedPathId && specializationId
      ? BUILD_PATH_SPECIALIZATIONS[state.selectedPathId].find(option => option.id === specializationId) : null;
    const trialProgress = specializationId ? state.trials[specializationId] ?? 0 : 0;
    client.send("build:path", { selectedPathId: state.selectedPathId, rank, xp,
      selectedCallingAbilityId: state.selectedPathId ? selectedCallingAbility(state, state.selectedPathId) : null,
      selectedCallingAugmentId: state.selectedPathId ? selectedCallingAugment(state, selectedCallingAbility(state, state.selectedPathId)) : null,
      callingAugmentProgress: state.callingAugmentProgress,
      masteredCallingAugments: state.masteredCallingAugments,
      nextRankXp: nextBuildRankXp(xp), candidates, canChoose: player.level >= 5,
      selectedSpecializationId: specializationId,
      canSpecialize: Boolean(state.selectedPathId && rank >= 3 && !state.specializations[state.selectedPathId]),
      masterTrial: specialization ? { name: specialization.name, description: specialization.trial, progress: trialProgress,
        target: specialization.trialTarget, complete: state.mastered.includes(specialization.id), capstone: specialization.capstone } : null,
      inTown: this.roomKind === "overworld" && isInsideTownSafeZone(player), message } satisfies BuildPathUpdate);
  }

  private handleBuildPath(client: Client, payload: unknown): void {
    const parsed = BuildPathRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (parsed.data.action === "sync") { this.sendBuildPath(client); return; }
    if (player.level < 5) { this.sendBuildPath(client, `Your Calling reveals itself at level 5. You are level ${player.level}.`); return; }
    if (this.roomKind !== "overworld" || !isInsideTownSafeZone(player)) {
      this.sendBuildPath(client, "Return to the safety of Town before committing to a Calling."); return;
    }
    if (parsed.data.action === "specialize") {
      const state = parseBuildPathState(player.huntLoadoutsJson), pathId = state.selectedPathId;
      const specializationId = parsed.data.specializationId;
      if (!pathId || !specializationId || buildPathRank(state.xp[pathId] ?? 0) < 3) {
        this.sendBuildPath(client, "Reach Veteran rank before choosing a specialization."); return;
      }
      if (state.specializations[pathId]) { this.sendBuildPath(client, "Your Veteran specialization is already bound to this Calling."); return; }
      const next = chooseBuildSpecialization(state, pathId, specializationId);
      if (next === state) { this.sendBuildPath(client, "That specialization does not belong to your current Calling."); return; }
      this.setPlayerBuildData(player, this.huntLoadouts(player), next); void this.persistPlayer(client.sessionId, player, true);
      const chosen = BUILD_PATH_SPECIALIZATIONS[pathId].find(option => option.id === specializationId)!;
      this.sendBuildPath(client, `${chosen.name.toUpperCase()} VETERAN PATH BOUND · ${chosen.effect}`); return;
    }
    const pathId = parsed.data.pathId;
    const candidates = buildPathAffinities(player);
    if (!pathId || !candidates.some(candidate => candidate.pathId === pathId)) {
      this.sendBuildPath(client, "That path is not among your three strongest affinities. Change your build and check again."); return;
    }
    const previous = parseBuildPathState(player.huntLoadoutsJson).selectedPathId;
    this.setPlayerBuildData(player, this.huntLoadouts(player), chooseBuildPath(parseBuildPathState(player.huntLoadoutsJson), pathId));
    void this.persistPlayer(client.sessionId, player, true);
    this.sendBuildPath(client, previous === pathId ? `${BUILD_PATHS[pathId].name} remains your active Calling.`
      : `${BUILD_PATHS[pathId].name.toUpperCase()} CALLING ACCEPTED · relevant victories now build Path Mastery.`);
  }

  private handleRoleOpportunity(client: Client, payload: unknown): void {
    const player = this.state.players.get(client.sessionId);
    const opportunityId = typeof payload === "object" && payload !== null && "id" in payload && typeof payload.id === "string"
      ? payload.id : "";
    const opportunity = ROLE_FIELD_OPPORTUNITIES.find(candidate => candidate.id === opportunityId);
    if (!player || !opportunity || this.roomKind !== "overworld") return;
    const pathId = parseBuildPathState(player.huntLoadoutsJson).selectedPathId;
    if (pathId !== opportunity.pathId) {
      client.send("chat:notice", `${opportunity.name.toUpperCase()} · this opportunity belongs to the ${BUILD_PATHS[opportunity.pathId].name} Calling.`);
      return;
    }
    const activePathId = opportunity.pathId;
    if (player.y < SURFACE_HEIGHT - 1 || nearestRoleFieldOpportunity(player.x, player.z, opportunity.pathId)?.id !== opportunity.id) {
      client.send("chat:notice", `Move beside ${opportunity.name} to use it.`);
      return;
    }
    const now = Date.now(), cooldownKey = `${client.sessionId}:${opportunity.id}`;
    const readyAt = this.roleOpportunityReadyAt.get(cooldownKey) ?? 0;
    if (now < readyAt) {
      client.send("chat:notice", `${opportunity.name.toUpperCase()} · recovers in ${Math.max(1, Math.ceil((readyAt - now) / 1_000))}s.`);
      return;
    }
    this.roleOpportunityReadyAt.set(cooldownKey, now + 180_000);
    let detail = "PATH MASTERY +2";
    if (activePathId === "tank") {
      this.tankFieldWards.add(client.sessionId);
      player.stamina = player.maxStamina;
      detail = "FIELD WARD READY · NEXT HIT −2";
    } else if (activePathId === "mage") {
      player.powerCooldownUntil = 0;
      player.stamina = Math.min(player.maxStamina, player.stamina + 35);
      detail = "POWER REFRESHED · +35 STAMINA";
    } else if (activePathId === "assassin") {
      this.assassinShadowUntil.set(client.sessionId, now + 8_000);
      this.assassinShadowBonus.set(client.sessionId, 0);
      this.pathConcealedUntil.set(client.sessionId, now + 8_000);
      detail = "CONCEALED · NEXT STRIKE EMPOWERED";
    } else if (activePathId === "thief") {
      player.coins = Math.min(1_000_000, player.coins + 8);
      detail = "HIDDEN CACHE · +8 GOLD";
    } else {
      this.rangerFieldFocusHits.set(client.sessionId, 3);
      player.specialCooldownUntil = 0;
      detail = "TRAIL FOCUS · NEXT 3 RANGED HITS +1";
    }
    this.grantBuildProgress(client.sessionId, 2);
    this.buildPathProc(client.sessionId, activePathId, opportunity.action.toUpperCase(), `${detail} · MASTERY +2`, 2_400);
    client.send("chat:notice", `${opportunity.name.toUpperCase()} · ${detail}. Returns in 3 minutes.`);
    void this.persistPlayer(client.sessionId, player, true);
  }

  private handleCallingAbility(client: Client, payload: unknown): void {
    const parsed = CallingAbilityRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    const state = parseBuildPathState(player.huntLoadoutsJson);
    const pathId = state.selectedPathId;
    if (!pathId) {
      client.send("chat:notice", "Choose a Calling in Town before using a Calling ability.");
      return;
    }
    const abilityId = selectedCallingAbility(state, pathId);
    const augmentId = selectedCallingAugment(state, abilityId);
    const definition = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId)!;
    const now = Date.now();
    const readyAt = this.callingAbilityReadyAt.get(client.sessionId) ?? 0;
    if (now < readyAt) {
      client.send("chat:notice", `${definition.name.toUpperCase()} · recovers in ${Math.max(1, Math.ceil((readyAt - now) / 1_000))}s.`);
      return;
    }
    const rank = this.buildPathRankFor(player, pathId);
    const cooldownUntil = now + definition.cooldownMs;
    this.callingAbilityReadyAt.set(client.sessionId, cooldownUntil);
    let detail = "ACTIVATED";
    let durationMs: number | undefined;
    let effectTargetId: string | undefined;
    const nearbyMobs = (radius: number) => [...this.state.mobs.entries()].filter(([, mob]) => mob.alive
      && Math.abs(mob.y - player.y) <= 2.5 && Math.hypot(mob.x - player.x, mob.z - player.z) <= radius);
    if (abilityId === "tank_bulwark") {
      durationMs = 5_000 + rank * 350 + (augmentId === "bulwark_guardian_wall" ? 2_000 : 0);
      this.tankBulwarkUntil.set(client.sessionId, now + durationMs);
      detail = `BRACED · −${augmentId === "bulwark_iron_skin" ? 2 : 1} DAMAGE PER HIT · ${(durationMs / 1_000).toFixed(1)}s`;
      this.grantCallingTrial(client.sessionId, "bulwark_guardian_wall", 1);
    } else if (abilityId === "tank_challenge") {
      const targets = nearbyMobs(8 + rank * .5 + (augmentId === "challenge_mass_provocation" ? 3 : 0));
      for (const [mobId] of targets) {
        const awareness = this.mobAwareness.get(mobId) ?? createMobAwareness();
        provokeMob(awareness, { id: client.sessionId, x: player.x, y: player.y, z: player.z, health: player.health }, now);
        this.mobAwareness.set(mobId, awareness);
      }
      const staminaBefore = player.stamina;
      player.stamina = Math.min(player.maxStamina, player.stamina + 35 + rank * 5 + (augmentId === "challenge_rallying_cry" ? 30 : 0));
      durationMs = 3_000 + (augmentId === "challenge_mass_provocation" ? 1_500 : 0);
      this.tankBulwarkUntil.set(client.sessionId, now + durationMs);
      detail = `${targets.length} ENEM${targets.length === 1 ? "Y" : "IES"} CHALLENGED · BRACED`;
      this.grantCallingTrial(client.sessionId, "challenge_mass_provocation", targets.length);
      this.grantCallingTrial(client.sessionId, "challenge_rallying_cry", player.stamina - staminaBefore);
    } else if (abilityId === "tank_earthbreaker") {
      const targets = nearbyMobs(4.2 + rank * .2 + (augmentId === "earthbreaker_faultline" ? 1.8 : 0));
      const baseDamage = 2 + (rank >= 4 ? 1 : 0) + (augmentId === "earthbreaker_crushing_force" ? 2 : 0);
      for (const [mobId, mob] of targets) {
        const damage = damageAfterArmor(baseDamage, mob.armor, true);
        this.combatContributions.record(mobId, client.sessionId, Math.min(mob.health, damage), now);
        mob.health = Math.max(0, mob.health - damage); mob.hitSequence += 1;
        this.alertHitMob(mobId, client.sessionId, now);
        if (mob.health === 0) this.defeatMob(mobId, mob, client.sessionId, now);
        else this.staggerMob(mobId, mob, now, 1_200 + rank * 100, true);
      }
      detail = `${targets.length} ENEM${targets.length === 1 ? "Y" : "IES"} HIT · ${baseDamage} DAMAGE`;
      this.grantCallingTrial(client.sessionId, "earthbreaker_faultline", targets.length);
      this.grantCallingTrial(client.sessionId, "earthbreaker_crushing_force", targets.length * baseDamage);
    } else if (abilityId === "mage_arcane_surge") {
      const staminaBefore = player.stamina, specialRecovering = player.specialCooldownUntil > now;
      const stamina = 30 + rank * 5 + (augmentId === "surge_deep_reserves" ? 25 : 0);
      player.powerCooldownUntil = now;
      if (augmentId === "surge_temporal_flux") player.specialCooldownUntil = Math.max(now, player.specialCooldownUntil - 4_000);
      player.stamina = Math.min(player.maxStamina, player.stamina + stamina);
      detail = `POWER REFRESHED · +${stamina} STAMINA`;
      this.grantCallingTrial(client.sessionId, "surge_deep_reserves", player.stamina - staminaBefore);
      this.grantCallingTrial(client.sessionId, "surge_temporal_flux", specialRecovering ? 1 : 0);
    } else if (abilityId === "mage_mana_shield") {
      const hits = (rank >= 4 ? 4 : 3) + (augmentId === "shield_prismatic_layers" ? 2 : 0);
      this.mageBarrierHits.set(client.sessionId, hits);
      detail = `${hits} BARRIER CHARGES · −${augmentId === "shield_reinforced_rune" ? 2 : 1} DAMAGE PER HIT`;
    } else if (abilityId === "mage_overload") {
      this.mageOverloadReady.add(client.sessionId);
      const charges = augmentId === "overload_residual_charge" ? 2 : 1;
      this.mageOverloadCharges.set(client.sessionId, charges);
      detail = `NEXT ${charges > 1 ? `${charges} POWERS` : "POWER"} +${(rank >= 4 ? 4 : 3) + (augmentId === "overload_volatile_core" ? 2 : 0)} DAMAGE`;
    } else if (abilityId === "assassin_vanish") {
      durationMs = 3_000 + rank * 400 + (augmentId === "vanish_deep_cloak" ? 2_000 : 0);
      this.assassinShadowUntil.set(client.sessionId, now + durationMs);
      this.assassinShadowBonus.set(client.sessionId, augmentId === "vanish_killing_intent" ? 2 : 0);
      this.pathConcealedUntil.set(client.sessionId, now + durationMs);
      let diverted = 0;
      for (const [mobId, awareness] of this.mobAwareness) if (awareness.targetId === client.sessionId) {
        const mob = this.state.mobs.get(mobId);
        if (mob && Math.hypot(mob.x - player.x, mob.z - player.z) <= 8) {
          this.mobAwareness.delete(mobId); mob.targetId = ""; mob.awarenessState = "search"; diverted += 1;
        }
      }
      detail = `VANISHED · NEXT STRIKE EMPOWERED · ${(durationMs / 1_000).toFixed(1)}s`;
      this.grantCallingTrial(client.sessionId, "vanish_deep_cloak", diverted);
    } else if (abilityId === "assassin_death_mark") {
      const target = nearbyMobs(8).sort((a, b) => Math.hypot(a[1].x - player.x, a[1].z - player.z)
        - Math.hypot(b[1].x - player.x, b[1].z - player.z))[0];
      if (target) {
        effectTargetId = target[0];
        const markMs = 10_000 + (augmentId === "mark_lingering_sentence" ? 5_000 : 0);
        this.specialMarks.set(client.sessionId, { mobId: target[0], expiresAt: now + markMs, stacks: HUNTERS_MARK.maxStacks });
        if (augmentId === "mark_open_wound") {
          this.combatContributions.record(target[0], client.sessionId, Math.min(target[1].health, 2), now);
          target[1].health = Math.max(0, target[1].health - 2); target[1].hitSequence += 1;
          if (target[1].health === 0) this.defeatMob(target[0], target[1], client.sessionId, now);
        }
        durationMs = markMs;
        detail = `${target[1].name.toUpperCase()} EXPOSED · ${(markMs / 1_000).toFixed(1)}s`;
        this.grantCallingTrial(client.sessionId, "mark_lingering_sentence", 1);
      } else detail = "NO TARGET IN RANGE";
    } else if (abilityId === "assassin_blade_dance") {
      durationMs = 1_000 + rank * 100 + (augmentId === "dance_long_step" ? 600 : 0);
      player.invulnerableUntil = Math.max(player.invulnerableUntil, now + durationMs);
      this.assassinShadowUntil.set(client.sessionId, now + 4_000 + rank * 250);
      this.assassinShadowBonus.set(client.sessionId, 0);
      const danceTargets = nearbyMobs(3.5);
      this.grantCallingTrial(client.sessionId, "dance_long_step", danceTargets.length > 0 ? 1 : 0);
      this.grantCallingTrial(client.sessionId, "dance_blade_storm", danceTargets.length);
      if (augmentId === "dance_blade_storm") for (const [mobId, mob] of danceTargets) {
        this.combatContributions.record(mobId, client.sessionId, Math.min(mob.health, 2), now);
        mob.health = Math.max(0, mob.health - 2); mob.hitSequence += 1;
        if (mob.health === 0) this.defeatMob(mobId, mob, client.sessionId, now);
      }
      detail = `UNTARGETABLE · NEXT STRIKE EMPOWERED`;
    } else if (abilityId === "thief_smoke_bomb") {
      durationMs = 2_500 + rank * 350 + (augmentId === "smoke_dense_cloud" ? 2_000 : 0);
      const radius = 6 + rank;
      let diverted = 0;
      for (const [mobId, awareness] of this.mobAwareness) if (awareness.targetId === client.sessionId) {
        const mob = this.state.mobs.get(mobId);
        if (mob && Math.hypot(mob.x - player.x, mob.z - player.z) <= radius) {
          this.mobAwareness.delete(mobId); mob.targetId = ""; mob.awarenessState = "search"; diverted += 1;
        }
      }
      this.pathConcealedUntil.set(client.sessionId, now + durationMs);
      const stamina = 20 + rank * 3 + (augmentId === "smoke_second_wind" ? 20 : 0), staminaBefore = player.stamina;
      player.stamina = Math.min(player.maxStamina, player.stamina + stamina);
      detail = `${diverted} ENEM${diverted === 1 ? "Y" : "IES"} DIVERTED · +${stamina} STAMINA`;
      this.grantCallingTrial(client.sessionId, "smoke_dense_cloud", diverted);
      this.grantCallingTrial(client.sessionId, "smoke_second_wind", player.stamina - staminaBefore);
    } else if (abilityId === "thief_decoy") {
      durationMs = 3_500 + rank * 250;
      const targets = nearbyMobs(8 + rank * .5 + (augmentId === "decoy_wide_stage" ? 3 : 0));
      for (const [mobId, mob] of targets) {
        const awareness = this.mobAwareness.get(mobId);
        if (awareness?.targetId === client.sessionId) this.mobAwareness.delete(mobId);
        mob.targetId = ""; mob.awarenessState = "search";
        this.staggerMob(mobId, mob, now, 700 + rank * 100 + (augmentId === "decoy_flash_charge" ? 800 : 0), true);
      }
      this.pathConcealedUntil.set(client.sessionId, now + durationMs);
      detail = `${targets.length} ENEM${targets.length === 1 ? "Y" : "IES"} DECOYED · CONCEALED`;
      this.grantCallingTrial(client.sessionId, "decoy_wide_stage", targets.length);
      this.grantCallingTrial(client.sessionId, "decoy_flash_charge", targets.length);
    } else if (abilityId === "thief_escape_artist") {
      const staminaBefore = player.stamina, healthBefore = player.health;
      durationMs = 700 + rank * 80 + (augmentId === "escape_extended_window" ? 500 : 0);
      this.dodgePressure.set(client.sessionId, { chain: 0, lastAt: Number.NEGATIVE_INFINITY, exhaustedUntil: 0 });
      player.invulnerableUntil = Math.max(player.invulnerableUntil, now + durationMs);
      player.stamina = player.maxStamina;
      if (augmentId === "escape_clean_getaway") player.health = Math.min(player.maxHealth, player.health + 1);
      detail = `DODGE RESET · FULL STAMINA · ${(durationMs / 1_000).toFixed(1)}s EVADE`;
      this.grantCallingTrial(client.sessionId, "escape_extended_window", staminaBefore < 25 ? 1 : 0);
      this.grantCallingTrial(client.sessionId, "escape_clean_getaway", healthBefore < player.maxHealth ? 1 : 0);
    } else if (abilityId === "ranger_disengage") {
      const radians = (parsed.data.yaw ?? player.yaw) * Math.PI / 180;
      const leap = 3 + (augmentId === "disengage_long_leap" ? 2 : 0);
      const moved = resolvePlayerMotion({ x: player.x, y: player.y, z: player.z },
        { x: -Math.sin(radians) * leap, y: 0, z: -Math.cos(radians) * leap }, this.readWorldBlock);
      Object.assign(player, moved, { invulnerableUntil: Math.max(player.invulnerableUntil, now + 450 + (augmentId === "disengage_evasive_roll" ? 450 : 0)) });
      this.rangerCallingFocus.set(client.sessionId, { hits: 2, bonus: 1 });
      detail = `DISENGAGED · NEXT 2 SHOTS +1`;
      this.grantCallingTrial(client.sessionId, "disengage_long_leap", nearbyMobs(8).length > 0 ? 1 : 0);
    } else if (abilityId === "ranger_deadeye") {
      const hits = 2 + (augmentId === "deadeye_eagle_eye" ? 1 : 0);
      const bonus = (rank >= 4 ? 4 : 3) + (augmentId === "deadeye_execution_rounds" ? 2 : 0);
      this.rangerCallingFocus.set(client.sessionId, { hits, bonus });
      detail = `NEXT ${hits} RANGED HITS +${bonus}`;
    } else {
      const hits = (rank >= 4 ? 4 : 3) + (augmentId === "volley_deep_quiver" ? 2 : 0);
      const bonus = 1 + (augmentId === "volley_heavy_arrows" ? 1 : 0);
      this.rangerCallingFocus.set(client.sessionId, { hits, bonus });
      detail = `NEXT ${hits} RANGED HITS +${bonus}`;
    }
    const augment = augmentId ? CALLING_ABILITY_AUGMENTS.find(option => option.id === augmentId) : null;
    if (augment) detail += ` · ${augment.name.toUpperCase()}`;
    const update: CallingAbilityUpdate = {
      requestId: parsed.data.requestId, pathId, abilityId, ability: definition.name, detail, cooldownUntil,
      ...(durationMs ? { durationMs } : {}),
    };
    client.send("calling:ability", update);
    this.broadcast("calling:ability:effect", {
      casterId: client.sessionId, pathId, abilityId, x: player.x, y: player.y, z: player.z,
      yaw: parsed.data.yaw ?? player.yaw, ...(durationMs ? { durationMs } : {}), ...(effectTargetId ? { targetId: effectTargetId } : {}),
      ...(augmentId ? { augmentId } : {}),
    } satisfies CallingAbilityEffect);
    if (abilityId === "tank_bulwark" || abilityId === "tank_challenge")
      this.callingState(client.sessionId, pathId, abilityId, "BRACED", { activeUntil: now + (durationMs ?? 3_000) });
    else if (abilityId === "mage_mana_shield")
      this.callingState(client.sessionId, pathId, abilityId, "BARRIER", { charges: this.mageBarrierHits.get(client.sessionId) ?? 0 });
    else if (abilityId === "mage_overload")
      this.callingState(client.sessionId, pathId, abilityId, "POWER CHARGED", { charges: this.mageOverloadCharges.get(client.sessionId) ?? 1 });
    else if (abilityId === "assassin_vanish")
      this.callingState(client.sessionId, pathId, abilityId, "VANISHED · STRIKE READY", { activeUntil: now + (durationMs ?? 0) });
    else if (abilityId === "assassin_death_mark" && effectTargetId)
      this.callingState(client.sessionId, pathId, abilityId, "TARGET EXPOSED", { activeUntil: now + (durationMs ?? 10_000), targetId: effectTargetId });
    else if (abilityId === "assassin_blade_dance")
      this.callingState(client.sessionId, pathId, abilityId, "UNTARGETABLE", { activeUntil: now + (durationMs ?? 0) });
    else if (abilityId === "thief_smoke_bomb" || abilityId === "thief_decoy")
      this.callingState(client.sessionId, pathId, abilityId, "CONCEALED", { activeUntil: now + (durationMs ?? 0) });
    else if (abilityId === "thief_escape_artist")
      this.callingState(client.sessionId, pathId, abilityId, "EVADING", { activeUntil: now + (durationMs ?? 0) });
    else if (abilityId.startsWith("ranger_"))
      this.callingState(client.sessionId, pathId, abilityId, "EMPOWERED SHOTS", { charges: this.rangerCallingFocus.get(client.sessionId)?.hits ?? 0 });
    this.buildPathProc(client.sessionId, pathId, definition.name.toUpperCase(), detail, durationMs ?? 2_000);
  }

  private handleCallingAbilityEquip(client: Client, payload: unknown): void {
    const parsed = CallingAbilityEquipRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    const state = parseBuildPathState(player.huntLoadoutsJson), pathId = state.selectedPathId;
    const definition = CALLING_ABILITY_OPTIONS.find(option => option.id === parsed.data.abilityId);
    if (!pathId || !definition || definition.pathId !== pathId) {
      this.sendBuildPath(client, "That ability does not belong to your active Calling."); return;
    }
    const rank = effectiveBuildPathRank(state, pathId);
    if (rank < definition.unlockRank) {
      this.sendBuildPath(client, `${definition.name.toUpperCase()} unlocks at Path Rank ${definition.unlockRank}.`); return;
    }
    const next = chooseCallingAbility(state, pathId, parsed.data.abilityId as CallingAbilityId);
    this.setPlayerBuildData(player, this.huntLoadouts(player), next);
    void this.persistPlayer(client.sessionId, player, true);
    this.sendBuildPath(client, `${definition.name.toUpperCase()} EQUIPPED · your G slot now uses this ${definition.category.toLowerCase()} ability.`);
  }

  private handleCallingAugmentEquip(client: Client, payload: unknown): void {
    const parsed = CallingAugmentEquipRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    const state = parseBuildPathState(player.huntLoadoutsJson), pathId = state.selectedPathId;
    const abilityId = pathId ? selectedCallingAbility(state, pathId) : null;
    const augment = CALLING_ABILITY_AUGMENTS.find(option => option.id === parsed.data.augmentId);
    if (!pathId || !abilityId || !augment || augment.abilityId !== abilityId) {
      this.sendBuildPath(client, "That upgrade does not belong to your equipped Calling ability."); return;
    }
    if (this.roomKind !== "overworld" || !isInsideTownSafeZone(player)) {
      this.sendBuildPath(client, "Return to Town to reshape a Calling ability."); return;
    }
    if (effectiveBuildPathRank(state, pathId) < augment.unlockRank) {
      this.sendBuildPath(client, `${augment.name.toUpperCase()} unlocks at Path Rank ${augment.unlockRank}.`); return;
    }
    if (!state.masteredCallingAugments.includes(augment.id)) {
      const trial = CALLING_AUGMENT_TRIALS[augment.id];
      this.sendBuildPath(client, `${augment.name.toUpperCase()} trial · ${state.callingAugmentProgress[augment.id] ?? 0} / ${trial.target} · ${trial.description}`); return;
    }
    const next = chooseCallingAugment(state, abilityId, parsed.data.augmentId as CallingAugmentId);
    if (next === state) { this.sendBuildPath(client, "That Calling upgrade is not available."); return; }
    this.setPlayerBuildData(player, this.huntLoadouts(player), next); void this.persistPlayer(client.sessionId, player, true);
    this.sendBuildPath(client, `${augment.name.toUpperCase()} EQUIPPED · ${augment.description}`);
  }

  private grantCallingTrial(playerId: string, augmentId: CallingAugmentId, amount: number): void {
    if (amount <= 0) return;
    const player = this.state.players.get(playerId);
    if (!player) return;
    const before = parseBuildPathState(player.huntLoadoutsJson);
    const result = grantCallingAugmentProgress(before, augmentId, amount);
    if (result.state === before) return;
    this.setPlayerBuildData(player, this.huntLoadouts(player), result.state);
    const client = this.clients.find(candidate => candidate.sessionId === playerId);
    const augment = CALLING_ABILITY_AUGMENTS.find(option => option.id === augmentId)!;
    if (client) this.sendBuildPath(client, result.completed
      ? `${augment.name.toUpperCase()} MASTERED · this branch can now be equipped in Town.`
      : "Calling trial progress updated.");
    void this.persistPlayer(playerId, player);
  }

  private grantBuildProgress(playerId: string, amount: number): void {
    const player = this.state.players.get(playerId);
    if (!player) return;
    const before = parseBuildPathState(player.huntLoadoutsJson);
    const result = grantBuildPathXp(before, amount);
    if (result.state === before) return;
    this.setPlayerBuildData(player, this.huntLoadouts(player), result.state);
    const client = this.clients.find(candidate => candidate.sessionId === playerId);
    const pathId = result.state.selectedPathId;
    if (client && pathId) {
      const beforeRank = effectiveBuildPathRank(before, pathId), afterRank = effectiveBuildPathRank(result.state, pathId);
      const trialRequired = buildPathRank(result.state.xp[pathId] ?? 0) >= 4 && afterRank < 4;
      this.sendBuildPath(client, afterRank > beforeRank
        ? `${BUILD_PATHS[pathId].name.toUpperCase()} PATH RANK ${afterRank} · passive strengthened.`
        : trialRequired ? `MASTER XP READY · complete your Veteran trial to activate Rank 4.` : `Path Mastery +${amount}`);
    }
  }

  private grantMistfenMastery(playerId: string, amount: number): void {
    const player = this.state.players.get(playerId);
    if (!player || amount <= 0) return;
    const progress = this.mistfenProgress(player);
    if (!progress.discovered) return;
    const before = mistfenMasteryRank(progress.points, true);
    progress.points = Math.min(MISTFEN_MASTERY_CAP, progress.points + amount);
    this.setMistfenProgress(player, progress);
    const after = mistfenMasteryRank(progress.points, true);
    if (after > before) {
      const names = ["", "PATHFINDER", "MARSH HUNTER", "MIREBREAKER"];
      const rewards = ["", "Marsh routes charted.", "Bonus marsh materials unlocked.", "Enhanced Mireback caches unlocked."];
      this.clients.find(candidate => candidate.sessionId === playerId)?.send("chat:notice",
        `MISTFEN MASTERY · ${names[after]} · ${rewards[after]}`);
    }
  }

  private grantRegionalMark(playerId: string, region: RegionalForgeId, amount = 1): void {
    const player = this.state.players.get(playerId);
    if (!player || amount <= 0) return;
    const progress = region === "greenwood" ? this.greenwoodProgress(player) : this.mistfenProgress(player);
    progress.marks = Math.min(65_535, progress.marks + amount);
    if (region === "greenwood") this.setGreenwoodProgress(player, progress); else this.setMistfenProgress(player, progress);
    const recipe = REGIONAL_FORGE_RECIPES[region];
    this.clients.find(candidate => candidate.sessionId === playerId)?.send("chat:notice",
      `${region === "greenwood" ? "GREENWOOD" : "MISTFEN"} MARK +${amount} · ${progress.marks} / ${recipe.marks} for guaranteed ${ITEM_DEFINITIONS[recipe.itemId].name}.`);
  }

  private discoverMistfen(playerId: string, player: PlayerState): void {
    const progress = this.mistfenProgress(player);
    if (this.roomKind !== "overworld" || progress.discovered || player.y < SURFACE_HEIGHT - 1
      || !isInMistfenMarsh(player.x, player.z)) return;
    progress.discovered = true;
    progress.points = Math.max(5, progress.points);
    this.setMistfenProgress(player, progress);
    this.clients.find(candidate => candidate.sessionId === playerId)?.send("chat:notice",
      "MISTFEN MASTERY · PATHFINDER · marsh routes charted. Hunt marsh creatures, mine silver, and defeat Mireback to advance.");
    void this.persistPlayer(playerId, player, true);
  }

  private mistfenProgress(player: PlayerState): { points: number; discovered: boolean; marks: number } {
    try {
      const value = (JSON.parse(player.huntLoadoutsJson) as { mistfen?: { points?: unknown; discovered?: unknown; marks?: unknown } }).mistfen;
      return { points: typeof value?.points === "number" && Number.isFinite(value.points)
        ? Math.max(0, Math.min(MISTFEN_MASTERY_CAP, Math.floor(value.points))) : 0, discovered: value?.discovered === true,
        marks: typeof value?.marks === "number" && Number.isFinite(value.marks) ? Math.max(0, Math.min(65_535, Math.floor(value.marks))) : 0 };
    } catch { return { points: 0, discovered: false, marks: 0 }; }
  }

  private setMistfenProgress(player: PlayerState, mistfen: { points: number; discovered: boolean; marks: number }): void {
    let raw: Record<string, unknown> = {};
    try { const parsed = JSON.parse(player.huntLoadoutsJson); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed; }
    catch { /* legacy */ }
    player.huntLoadoutsJson = JSON.stringify({ ...raw, mistfen });
  }

  private activeMistfenMasteryRank(): number {
    let rank = 0;
    for (const player of this.state.players.values()) {
      if (player.health <= 0 || player.y < SURFACE_HEIGHT - 1 || !isInMistfenMarsh(player.x, player.z)) continue;
      const progress = this.mistfenProgress(player);
      rank = Math.max(rank, mistfenMasteryRank(progress.points, progress.discovered));
    }
    return rank;
  }

  private greenwoodProgress(player: PlayerState): { points: number; discovered: boolean; marks: number } {
    try {
      const value = (JSON.parse(player.huntLoadoutsJson) as { greenwood?: { points?: unknown; discovered?: unknown; marks?: unknown } }).greenwood;
      return { points: typeof value?.points === "number" && Number.isFinite(value.points)
        ? Math.max(0, Math.min(GREENWOOD_MASTERY_CAP, Math.floor(value.points))) : 0, discovered: value?.discovered === true,
        marks: typeof value?.marks === "number" && Number.isFinite(value.marks) ? Math.max(0, Math.min(65_535, Math.floor(value.marks))) : 0 };
    } catch { return { points: 0, discovered: false, marks: 0 }; }
  }

  private setGreenwoodProgress(player: PlayerState, greenwood: { points: number; discovered: boolean; marks: number }): void {
    let raw: Record<string, unknown> = {};
    try { const parsed = JSON.parse(player.huntLoadoutsJson); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) raw = parsed; }
    catch { /* legacy */ }
    player.huntLoadoutsJson = JSON.stringify({ ...raw, greenwood });
  }

  private grantGreenwoodMastery(playerId: string, amount: number): void {
    const player = this.state.players.get(playerId), progress = player ? this.greenwoodProgress(player) : null;
    if (!player || !progress?.discovered || amount <= 0) return;
    progress.points = Math.min(GREENWOOD_MASTERY_CAP, progress.points + amount);
    this.setGreenwoodProgress(player, progress);
  }

  private discoverGreenwood(playerId: string, player: PlayerState): void {
    const progress = this.greenwoodProgress(player);
    if (this.roomKind !== "overworld" || progress.discovered || player.y < SURFACE_HEIGHT - 1 || !isInGreenwoodRegion(player.x, player.z)) return;
    progress.discovered = true; progress.points = Math.max(5, progress.points); this.setGreenwoodProgress(player, progress);
    void this.persistPlayer(playerId, player, true);
  }

  private activeGreenwoodMasteryRank(): number {
    let rank = 0;
    for (const player of this.state.players.values()) {
      if (player.health <= 0 || player.y < SURFACE_HEIGHT - 1 || !isInGreenwoodRegion(player.x, player.z)) continue;
      const progress = this.greenwoodProgress(player);
      rank = Math.max(rank, greenwoodMasteryRank(progress.points, progress.discovered));
    }
    return rank;
  }

  private buildPathDamageBonus(player: PlayerState, mob: MobState, mobId: string, playerId: string, now: number, source: "weapon" | "power"): number {
    const state = parseBuildPathState(player.huntLoadoutsJson);
    if (!state.selectedPathId) return 0;
    const rank = this.buildPathRankFor(player, state.selectedPathId);
    if (state.selectedPathId === "ranger" && source === "weapon" && player.mainHandTag === "ranged") {
      const focusHits = this.rangerFieldFocusHits.get(playerId) ?? 0;
      const callingFocus = this.rangerCallingFocus.get(playerId);
      if (focusHits > 0) {
        if (focusHits === 1) this.rangerFieldFocusHits.delete(playerId); else this.rangerFieldFocusHits.set(playerId, focusHits - 1);
        this.buildPathProc(playerId, "ranger", "TRAIL FOCUS", `+1 DAMAGE · ${focusHits - 1} SHOTS REMAIN`);
      }
      if (callingFocus) {
        const callingAbility = selectedCallingAbility(state, "ranger");
        if (callingAbility === "ranger_volley_focus") {
          this.grantCallingTrial(playerId, "volley_deep_quiver", 1);
          this.grantCallingTrial(playerId, "volley_heavy_arrows", callingFocus.bonus);
        } else if (callingAbility === "ranger_disengage") {
          this.grantCallingTrial(playerId, "disengage_evasive_roll", 1);
        } else if (callingAbility === "ranger_deadeye") {
          this.grantCallingTrial(playerId, "deadeye_eagle_eye", 1);
          this.grantCallingTrial(playerId, "deadeye_execution_rounds", callingFocus.bonus);
        }
        if (callingFocus.hits <= 1) this.rangerCallingFocus.delete(playerId);
        else this.rangerCallingFocus.set(playerId, { ...callingFocus, hits: callingFocus.hits - 1 });
        this.callingState(playerId, "ranger", callingAbility, "EMPOWERED SHOTS", {
          charges: Math.max(0, callingFocus.hits - 1), clear: callingFocus.hits <= 1,
        });
        this.buildPathProc(playerId, "ranger", "FOCUSED SHOT", `+${callingFocus.bonus} DAMAGE · ${callingFocus.hits - 1} SHOTS REMAIN`);
      }
      return (rank > 0 ? rank >= 4 ? 2 : 1 : 0) + Math.ceil(this.equipmentAffixTier(player, "piercing") / 2)
        + (focusHits > 0 ? 1 : 0) + (callingFocus?.bonus ?? 0);
    }
    if (rank <= 0) return 0;
    const mark = this.specialMarks.get(playerId);
    const marked = Boolean(mark && mark.mobId === mobId && mark.expiresAt > now);
    if (state.selectedPathId === "assassin"
      && (mob.health <= Math.ceil(mob.maxHealth * .35) || marked))
      return (rank >= 4 ? 2 : 1) + this.equipmentAffixTier(player, "lethal");
    return 0;
  }

  private playerOwns(player: PlayerState, itemId: ItemId): boolean {
    return (player.inventory.get(itemId)?.quantity ?? 0) + (player.storage.get(itemId)?.quantity ?? 0) > 0;
  }

  private sendHuntCollection(client: Client, message = "Save and switch hunt loadouts while inside Town."): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const mastery = parseHuntMastery(player.huntMasteryJson);
    const marks = { fang: "alpha_forgemark", venom: "venom_forgemark", crusher: "crusher_forgemark" } as const;
    const sets = Object.fromEntries((Object.keys(HUNT_EQUIPMENT_SETS) as HuntSetId[]).map(setId => {
      const set = HUNT_EQUIPMENT_SETS[setId];
      return [setId, { weaponOwned: this.playerOwns(player, set.weaponId), armourOwned: this.playerOwns(player, set.armourId),
        forgemarkOwned: this.playerOwns(player, marks[setId]) }];
    })) as HuntCollectionUpdate["sets"];
    const masteryStatus = Object.fromEntries((Object.keys(HUNT_EQUIPMENT_SETS) as HuntSetId[]).map(setId => [setId, {
      rank: mastery[setId].rank, bestTimesMs: mastery[setId].bestTimesMs,
      veteranUnlocked: huntDifficultyUnlocked(mastery[setId].rank, "veteran"),
      ascendantUnlocked: huntDifficultyUnlocked(mastery[setId].rank, "ascendant"),
    }])) as HuntCollectionUpdate["mastery"];
    client.send("hunt:collection", { loadouts: this.huntLoadouts(player), mastery: masteryStatus, sets,
      rewardClaimed: player.huntCollectionRewardClaimed,
      canClaim: Object.values(sets).every(set => set.weaponOwned && set.armourOwned) && !player.huntCollectionRewardClaimed,
      inTown: this.roomKind === "overworld" && isInsideTownSafeZone(player), message } satisfies HuntCollectionUpdate);
  }

  private handleHuntCollection(client: Client, payload: unknown): void {
    const parsed = HuntCollectionRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (parsed.data.action === "sync") { this.sendHuntCollection(client); return; }
    if (this.roomKind !== "overworld" || !isInsideTownSafeZone(player)) {
      this.sendHuntCollection(client, "Loadouts and collection rewards can only be changed inside Town."); return;
    }
    if (parsed.data.action === "claim") {
      const complete = (Object.values(HUNT_EQUIPMENT_SETS)).every(set => this.playerOwns(player, set.weaponId) && this.playerOwns(player, set.armourId));
      if (!complete || player.huntCollectionRewardClaimed) {
        this.sendHuntCollection(client, player.huntCollectionRewardClaimed ? "The Hunt Collector reward is already claimed." : "Collect both pieces from all three hunt sets first."); return;
      }
      player.huntCollectionRewardClaimed = true;
      player.coins = Math.min(1_000_000, player.coins + 150);
      const moonstone = player.inventory.get("moonstone") ?? new InventoryItemState();
      moonstone.quantity = Math.min(65_535, moonstone.quantity + 3); player.inventory.set("moonstone", moonstone);
      void this.persistPlayer(client.sessionId, player, true);
      this.sendHuntCollection(client, "HUNT COLLECTOR COMPLETE · 150 gold and 3 Moonstone added to your pack."); return;
    }
    const slot = parsed.data.slot as 1 | 2 | 3 | undefined;
    if (!slot) return;
    const loadouts = this.huntLoadouts(player).filter(loadout => loadout.slot !== slot);
    if (parsed.data.action === "save") {
      const name = (parsed.data.name ?? `Loadout ${slot}`).replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 18) || `Loadout ${slot}`;
      loadouts.push({ slot, name, mainHandId: player.mainHandId as HuntLoadoutSlot["mainHandId"], armourId: player.armourId as HuntLoadoutSlot["armourId"],
        equippedPower: player.equippedPower as HuntLoadoutSlot["equippedPower"], equippedPowerSecondary: player.equippedPowerSecondary as HuntLoadoutSlot["equippedPowerSecondary"],
        equippedSpecial: player.equippedSpecial as HuntLoadoutSlot["equippedSpecial"], equippedTrait: player.equippedTrait as HuntLoadoutSlot["equippedTrait"],
        seismicMastery: player.seismicMastery as HuntLoadoutSlot["seismicMastery"], buildPathId: parseBuildPathState(player.huntLoadoutsJson).selectedPathId });
      this.setPlayerBuildData(player, loadouts.sort((a, b) => a.slot - b.slot));
      void this.persistPlayer(client.sessionId, player, true);
      this.sendHuntCollection(client, `${name} saved from your current build.`); return;
    }
    const loadout = this.huntLoadouts(player).find(saved => saved.slot === slot);
    if (!loadout) { this.sendHuntCollection(client, `Loadout ${slot} has not been saved yet.`); return; }
    if (!canEquipMainHand(loadout.mainHandId, itemId => player.inventory.get(itemId)?.quantity ?? 0)
      || (loadout.armourId !== "none" && (player.inventory.get(loadout.armourId)?.quantity ?? 0) <= 0)) {
      this.sendHuntCollection(client, `${loadout.name} needs gear that is not in your pack.`); return;
    }
    const hand = MAIN_HAND_DEFINITIONS[loadout.mainHandId];
    player.mainHandId = loadout.mainHandId; player.mainHandTag = hand.tag; player.armourId = loadout.armourId;
    player.equippedPower = compatiblePowerOrFallback(loadout.equippedPower, hand.tag);
    player.equippedPowerSecondary = compatiblePowerOrFallback(loadout.equippedPowerSecondary, hand.tag);
    player.equippedSpecial = loadout.equippedSpecial; player.equippedTrait = loadout.equippedTrait; player.seismicMastery = loadout.seismicMastery;
    if (loadout.buildPathId) this.setPlayerBuildData(player, this.huntLoadouts(player), chooseBuildPath(parseBuildPathState(player.huntLoadoutsJson), loadout.buildPathId));
    void this.persistPlayer(client.sessionId, player, true);
    this.sendHuntCollection(client, `${loadout.name} equipped.`);
    this.sendBuildPath(client, loadout.buildPathId ? `${BUILD_PATHS[loadout.buildPathId].name} Calling restored with ${loadout.name}.` : "Loadout equipped. Your current Calling was preserved.");
  }

  private handleRealmHuntBoard(client: Client, payload: unknown): void {
    const parsed = RealmHuntBoardRequestSchema.safeParse(payload);
    const player = this.state.players.get(client.sessionId);
    if (!parsed.success || !player) return;
    if (parsed.data.action === "sync") { this.sendRealmHuntBoard(client); return; }
    if (Math.abs(player.y - TOWN_EXPEDITION_BOARD_POSITION.y) > 1.6
      || Math.hypot(player.x - TOWN_EXPEDITION_BOARD_POSITION.x, player.z - TOWN_EXPEDITION_BOARD_POSITION.z) > 3) {
      this.sendRealmHuntBoard(client, "Return to the Realm Hunt Board in town to change your tracked leader."); return;
    }
    if (parsed.data.action === "contract") {
      if (!isHuntPathId(parsed.data.pathId)) { this.sendRealmHuntBoard(client, "Choose Fang, Venom, or Crusher."); return; }
      const current = this.huntContracts.get(client.sessionId);
      if (current && !current.completed && current.pathId === parsed.data.pathId) {
        this.sendRealmHuntBoard(client, `${HUNT_PATHS[current.pathId].name} is already active.`); return;
      }
      const difficulty = parsed.data.difficulty ?? "normal";
      const mastery = parseHuntMastery(player.huntMasteryJson)[parsed.data.pathId];
      if (!huntDifficultyUnlocked(mastery.rank, difficulty)) {
        this.sendRealmHuntBoard(client, difficulty === "ascendant"
          ? "Ascendant unlocks at path rank 3." : "Veteran unlocks after one Normal clear."); return;
      }
      const cycles = this.huntContractCycles.get(client.sessionId) ?? {};
      const contract = beginHuntContract(parsed.data.pathId, cycles[parsed.data.pathId] ?? 0, difficulty, Date.now());
      this.huntContracts.set(client.sessionId, contract);
      this.selectedRealmHunts.set(client.sessionId, contract.targetMobId);
      this.empowerPlayerHuntTarget(client.sessionId);
      this.sendRealmHuntBoard(client, `${difficulty.toUpperCase()} ${HUNT_PATHS[contract.pathId].name} accepted · three leaders, then ${HUNT_PATHS[contract.pathId].championName}.`);
      this.sendObjectiveState(client, true); return;
    }
    const activeContract = this.huntContracts.get(client.sessionId);
    if (activeContract && !activeContract.completed) {
      this.sendRealmHuntBoard(client, `Finish ${HUNT_PATHS[activeContract.pathId].name} before tracking another leader.`); return;
    }
    const mobId = parsed.data.mobId ?? "";
    if (!AREA_MAIN_MOBS.some(definition => definition.id === mobId)) {
      this.sendRealmHuntBoard(client, "That leader is not recorded on this board."); return;
    }
    const deselected = this.selectedRealmHunts.get(client.sessionId) === mobId;
    if (deselected) this.selectedRealmHunts.delete(client.sessionId);
    else this.selectedRealmHunts.set(client.sessionId, mobId);
    this.sendRealmHuntBoard(client, deselected
      ? "Hunt guidance cleared."
      : `${areaMainMobDefinition(mobId)?.name ?? "Leader"} tracked. Guidance will appear near its territory.`);
    this.sendObjectiveState(client, true);
  }

  private sendDungeonLobby(message = "Assemble at the entrance and ready up."): void {
    const run = this.forestDungeonRun;
    if (!run) return;
    for (const playerId of run.allowed) {
      const recipient = this.clients.find(client => client.sessionId === playerId);
      if (!recipient) continue;
      recipient.send("dungeon:lobby", {
        runId: run.id,
        phase: run.phase,
        leader: this.parties.isLeader(playerId),
        members: [...run.allowed].map(id => ({ id, name: this.state.players.get(id)?.name ?? "Explorer",
          entered: run.entered.has(id), ready: run.ready.has(id) })),
        scalePlayers: run.scalePlayers,
        message,
      } satisfies DungeonLobbyUpdate);
    }
  }

  private startForestDungeonRun(now: number): void {
    const run = this.forestDungeonRun;
    if (!run || run.phase === "active" || run.entered.size === 0) return;
    run.phase = "active"; run.scalePlayers = Math.max(1, run.entered.size); run.startedAt = now;
    this.state.portals.delete("forest-entry");
    this.spawnForestStage(1);
    for (const playerId of run.entered) this.clients.find(client => client.sessionId === playerId)?.send("dungeon:run", {
      runId: run.id, phase: "started", partySize: run.scalePlayers,
    } satisfies DungeonRunUpdate);
    this.sendDungeonLobby(`Expedition started · enemies scaled for ${run.scalePlayers} player${run.scalePlayers === 1 ? "" : "s"}.`);
  }

  private handleDungeonLobby(client: Client, payload: unknown): void {
    const parsed = DungeonLobbyRequestSchema.safeParse(payload), run = this.forestDungeonRun;
    if (!parsed.success || !run || run.phase !== "lobby" || !run.entered.has(client.sessionId)) return;
    if (parsed.data.action === "ready") run.ready.add(client.sessionId);
    else if (!this.parties.isLeader(client.sessionId)) { this.sendDungeonLobby("Only the party leader can start before everyone is ready."); return; }
    const everyoneReady = [...run.allowed].every(id => run.entered.has(id) && run.ready.has(id));
    if (parsed.data.action === "start" || everyoneReady) this.startForestDungeonRun(Date.now());
    else this.sendDungeonLobby(`${run.ready.size}/${run.allowed.size} ready · waiting at the entrance.`);
  }

  private sendSilverDepthsLobby(key: string, lobby: { leaderId: string; members: string[]; ready: Set<string>; expiresAt: number },
    message = `${lobby.ready.size}/${lobby.members.length} ready · waiting for the party.`): void {
    const update: SilverDepthsLobbyUpdate = { phase: "assembling", leaderId: lobby.leaderId, expiresAt: lobby.expiresAt,
      members: lobby.members.map(id => ({ id, name: this.state.players.get(id)?.name ?? "Explorer", ready: lobby.ready.has(id) })), message };
    for (const id of lobby.members) this.clients.find(client => client.sessionId === id)?.send("depths:lobby", update);
  }

  private closeSilverDepthsLobby(key: string, message: string): void {
    const lobby = this.silverDepthsLobbies.get(key);
    if (!lobby) return;
    this.silverDepthsLobbies.delete(key);
    const update: SilverDepthsLobbyUpdate = { phase: "closed", leaderId: lobby.leaderId, members: [], expiresAt: 0, message };
    for (const id of lobby.members) this.clients.find(client => client.sessionId === id)?.send("depths:lobby", update);
  }

  private validateSilverDepthsLobbies(now: number): void {
    for (const [key, lobby] of this.silverDepthsLobbies) {
      if (now >= lobby.expiresAt) { this.closeSilverDepthsLobby(key, "Assembly expired · use the portal to try again."); continue; }
      const cohort = this.parties.cohort(lobby.leaderId);
      if (cohort.key !== key || cohort.members.length !== lobby.members.length
        || lobby.members.some(id => !cohort.members.includes(id) || !this.clients.some(client => client.sessionId === id)
          || (this.state.players.get(id)?.health ?? 0) <= 0))
        this.closeSilverDepthsLobby(key, "Assembly cancelled · the party changed.");
    }
  }

  private handleSilverDepthsLobby(client: Client, payload: unknown): void {
    if (this.roomKind !== "overworld" || !payload || typeof payload !== "object" || !("action" in payload)
      || (payload.action !== "ready" && payload.action !== "cancel")) return;
    this.validateSilverDepthsLobbies(Date.now());
    const entry = [...this.silverDepthsLobbies].find(([, lobby]) => lobby.members.includes(client.sessionId));
    if (!entry) return;
    const [key, lobby] = entry;
    if (payload.action === "cancel") { this.closeSilverDepthsLobby(key, "Assembly cancelled · the party remains together."); return; }
    if ((this.state.players.get(client.sessionId)?.health ?? 0) <= 0) return;
    lobby.ready.add(client.sessionId);
    if (lobby.ready.size !== lobby.members.length) { this.sendSilverDepthsLobby(key, lobby); return; }
    this.closeSilverDepthsLobby(key, "Everyone is ready · entering Silver Depths.");
    this.silverDepthsTransferPending.set(key, Date.now() + 3000);
    const leader = this.clients.find(member => member.sessionId === lobby.leaderId);
    if (leader) void this.transferPartyToSilverDepths(leader);
  }

  private useSilverDepthsPortal(client: Client, payload: unknown): void {
    if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") return;
    const player = this.state.players.get(client.sessionId), portal = this.state.portals.get(payload.id), now = Date.now();
    if (!player || !portal || !canUseForestPortal(player, portal, now)
      || now - (this.forestTravelAt.get(client.sessionId) ?? -Infinity) < 1000
      || !hasCombatLineOfSight(player, portal, this.readWorldBlock)) return;
    const entering = payload.id === "depths-entry";
    if (entering) {
      if (this.roomKind !== "overworld") return;
      if (!canEnterSilverDepths(player) && process.env.NODE_ENV === "production") {
        client.send("portal:notice", player.level < 7
          ? "The Silver Depths open at level 7. Fight nearby threats and strengthen your gear."
          : "Defeat the Stone Warden and claim its Miner's Lantern to open the Silver Depths.");
        return;
      }
      if (player.silverDepthsStage === 0) this.advanceSilverDepthsExpedition(client, "briefed");
      const cohort = this.parties.cohort(client.sessionId);
      if (cohort.members.length > 1) {
        if (!this.parties.isLeader(client.sessionId)) {
          client.send("portal:notice", "Ask your party leader to start the Silver Depths ready check."); return;
        }
        if ((this.silverDepthsTransferPending.get(cohort.key) ?? 0) > now) return;
        const existing = this.silverDepthsLobbies.get(cohort.key);
        if (existing) { this.sendSilverDepthsLobby(cohort.key, existing); return; }
        const lobby = { leaderId: client.sessionId, members: cohort.members, ready: new Set<string>(), expiresAt: now + 60_000 };
        this.silverDepthsLobbies.set(cohort.key, lobby);
        this.sendSilverDepthsLobby(cohort.key, lobby, "Party leader opened Silver Depths · everyone choose Ready within 60 seconds.");
        return;
      }
      this.forestTravelAt.set(client.sessionId, now);
      void this.transferPartyToSilverDepths(client);
      return;
    }
    const activeRun = this.silverDepthsRuns.get(client.sessionId);
    const ownsEdge = (player.inventory.get("matriarch_edge")?.quantity ?? 0) > 0;
    if (!canExitSilverDepths(player) && !(activeRun?.completedAt && ownsEdge)) {
      client.send("portal:notice", "Defeat the Crystal Matriarch and claim your personal Matriarch's Edge before extracting.");
      return;
    }
    if (activeRun && activeRun.completedAt === 0) {
      client.send("portal:notice", "This dungeon run is still active · defeat the Crystal Matriarch before extracting.");
      return;
    }
    this.forestTravelAt.set(client.sessionId, now);
    if (player.silverDepthsStage === 6) this.advanceSilverDepthsExpedition(client, "returned_to_blacksmith");
    this.pendingMining.delete(client.sessionId); this.pendingAttacks.delete(client.sessionId);
    this.pendingPowers.delete(client.sessionId); this.cancelWeaponProjectiles(client.sessionId);
    this.attackChains.delete(client.sessionId); this.brambleSnares.delete(client.sessionId); this.specialMarks.delete(client.sessionId);
    this.trading.disconnect(client.sessionId);
    player.defending = false; player.powerCastStartedAt = 0;
    if (activeRun?.completedAt) this.completeSilverDepthsRun(client, player, activeRun);
    player.silverDepthsRunStage = 0;
    this.sendObjectiveState(client, true);
    void this.returnFromSilverDepths(client, player);
  }

  private async transferPartyToSilverDepths(trigger: Client): Promise<void> {
    const cohort = this.parties.cohort(trigger.sessionId);
    const memberIds = new Set(cohort.members);
    const members = this.clients.filter(candidate => memberIds.has(candidate.sessionId));
    if (!members.some(candidate => candidate.sessionId === trigger.sessionId)) members.push(trigger);
    const instanceKey = `silver-${this.roomId || "world"}-${Date.now().toString(36)}-${++this.silverInstanceSequence}`;
    const profiles = members.map(member => this.profileTokens.get(member.sessionId)).filter((token): token is string => !!token);
    let partyTicket: string | undefined;
    if (members.length > 1 && profiles.length === members.length && new Set(profiles).size === profiles.length) {
      try {
        partyTicket = randomUUID();
        await this.presence.setex(expeditionPartyKey(partyTicket), JSON.stringify({ instanceKey, worldRoomId: this.roomId, profiles } satisfies ExpeditionPartyTicket), 7200);
      } catch (error) { partyTicket = undefined; console.warn("Expedition party ticket could not be saved.", error); }
    }
    for (const member of members) {
      const player = this.state.players.get(member.sessionId);
      if (player?.silverDepthsStage === 0 && canEnterSilverDepths(player)) this.advanceSilverDepthsExpedition(member, "briefed");
    }
    await Promise.allSettled(members.map(member => {
      const player = this.state.players.get(member.sessionId);
      return player ? this.persistPlayer(member.sessionId, player, true) : Promise.resolve();
    }));
    const transfer: RoomTransfer = { room: SILVER_DEPTHS_ROOM, instanceKey, partySize: Math.max(1, Math.min(4, members.length)), ...(partyTicket ? { partyTicket } : {}) };
    for (const member of members) member.send("room:transfer", transfer);
  }

  private async returnFromSilverDepths(client: Client, player: PlayerState): Promise<void> {
    await this.persistPlayer(client.sessionId, player, true);
    client.send("portal:notice", "Dungeon cleared · returning to the Town of Beginnings.");
    client.send("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths", ...await this.expeditionReturnTicket(client.sessionId) } satisfies RoomTransfer);
  }

  private async expeditionReturnTicket(sessionId: string): Promise<Pick<RoomTransfer, "partyTicket" | "worldRoomId">> {
    const partyTicket = this.expeditionTicketBySession.get(sessionId);
    if (!partyTicket) return {};
    try {
      const record = parseExpeditionPartyTicket(await this.presence.get(expeditionPartyKey(partyTicket)));
      return record && record.instanceKey === this.silverInstanceKey
        ? { partyTicket, worldRoomId: record.worldRoomId } : {};
    } catch { return {}; }
  }

  private beginSilverDepthsRun(client: Client, player: PlayerState, now: number): void {
    const occupied = [...this.state.players.entries()].some(([id, other]) =>
      id !== client.sessionId && other.health > 0 && isInsideSilverDepths(other));
    if (!occupied) {
      this.state.portals.delete("depths-return");
      this.resetSilverDepthsInstance();
    }
    const run: SilverDepthsRunStats = { runId: `depths-run-${++this.silverDepthsRunSequence}`,
      partySize: this.roomKind === "silver-depths" ? this.instancePartySize : Math.max(1, this.parties.cohort(client.sessionId).members.length), startedAt: now, completedAt: 0,
      enemiesDefeated: 0, damageTaken: 0, moonstoneCollected: 0, moonstoneAtStart: player.inventory.get("moonstone")?.quantity ?? 0,
      edgeAtStart: player.inventory.get("matriarch_edge")?.quantity ?? 0 };
    this.silverDepthsRuns.set(client.sessionId, run);
    this.silverDepthsRoster.set(client.sessionId, player.name);
    this.broadcastSilverDepthsPartyStatus();
    player.silverDepthsWing = this.silverDepthsWing ?? "";
    player.silverDepthsRunStage = this.silverDepthsSealOpened ? this.silverDepthsEncounterStage + 1 : 1;
    client.send("dungeon:run", { runId: run.runId, phase: "started", dungeon: "silver-depths", partySize: run.partySize } satisfies DungeonRunUpdate);
  }

  private completeSilverDepthsRun(client: Client, player: PlayerState, run: SilverDepthsRunStats): void {
    const durationMs = Math.max(1, run.completedAt - run.startedAt);
    const priorBest = player.silverDepthsBestTimeMs;
    const newBest = priorBest === 0 || durationMs < priorBest;
    if (newBest) player.silverDepthsBestTimeMs = durationMs;
    const signatureItemObtained = (player.inventory.get("matriarch_edge")?.quantity ?? 0) > run.edgeAtStart;
    const rank = silverDepthsRank(durationMs, run.damageTaken);
    const intendedAward = silverDepthsMoonstoneReward(rank);
    let moonstone = player.inventory.get("moonstone");
    if (!moonstone) { moonstone = new InventoryItemState(); player.inventory.set("moonstone", moonstone); }
    moonstone.quantity = Math.min(ironCapacity(player.blacksmithUpgrades), run.moonstoneAtStart + intendedAward);
    const moonstoneAwarded = moonstone.quantity - run.moonstoneAtStart;
    client.send("dungeon:run", { runId: run.runId, phase: "completed", dungeon: "silver-depths", partySize: run.partySize,
      durationMs, rank, bestTimeMs: player.silverDepthsBestTimeMs, newBest,
      reward: `+${moonstoneAwarded} Moonstone · ${signatureItemObtained ? "Matriarch's Edge obtained" : "Matriarch's Edge secured"}`,
      stats: { enemiesDefeated: run.enemiesDefeated, damageTaken: run.damageTaken,
        moonstoneCollected: run.moonstoneCollected, moonstoneAwarded, moonstoneTotal: moonstone.quantity, signatureItemObtained } } satisfies DungeonRunUpdate);
    this.silverDepthsRuns.delete(client.sessionId);
    this.broadcastSilverDepthsPartyStatus();
  }

  private restoreRunMoonstone(player: PlayerState, run: SilverDepthsRunStats): void {
    const item = player.inventory.get("moonstone");
    if (item) item.quantity = run.moonstoneAtStart;
  }

  private useEmberVaultPortal(client: Client, payload: unknown): void {
    if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") return;
    const player = this.state.players.get(client.sessionId), portal = this.state.portals.get(payload.id), now = Date.now();
    if (!player || !portal || (payload.id !== "ember-entry" && payload.id !== "ember-return")) return;
    const entering = payload.id === "ember-entry";
    if (!entering && !canUseForestPortal(player, portal, now)) return;
    const run = this.emberVaultRuns.get(client.sessionId);
    if (!entering && (!run || run.completedAt === 0)) {
      client.send("portal:notice", "Defeat the Forge Colossus before extracting from the Ember Vault."); return;
    }
    if (entering) this.beginEmberVaultRun(client, player, now);
    const destination = entering ? EMBER_VAULT_ENTRY : EMBER_VAULT_PORTAL_POSITION;
    this.pendingMining.delete(client.sessionId); this.pendingAttacks.delete(client.sessionId);
    this.pendingPowers.delete(client.sessionId); this.cancelWeaponProjectiles(client.sessionId);
    player.defending = false; player.x = destination.x; player.y = destination.y; player.z = destination.z;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, now + 1200);
    this.movementInputs.set(client.sessionId, { request: idleMovementInput(), receivedAt: now });
    this.verticalVelocities.set(client.sessionId, 0);
    client.send("player:portal", { ...destination, entering });
    client.send("world:bootstrap", this.bootstrapPayload(destination));
    client.send("portal:notice", entering ? "Ember Vault entered · cross the heat lanes and defeat the Forge Colossus." : "Ember Vault cleared · returned to the frontier.");
    if (!entering && run) this.completeEmberVaultRun(client, player, run);
    this.sendObjectiveState(client, true);
    void this.persistPlayer(client.sessionId, player, !entering);
  }

  private beginEmberVaultRun(client: Client, player: PlayerState, now: number): void {
    this.state.portals.delete("ember-return");
    for (const definition of EMBER_VAULT_MOBS) {
      const mob = this.state.mobs.get(definition.id); if (!mob) continue;
      mob.alive = false; mob.respawnAt = now; this.clearMobAttackTimeline(mob);
    }
    const run: EmberVaultRunStats = {
      runId: `ember-run-${++this.emberVaultRunSequence}`, startedAt: now, completedAt: 0, enemiesDefeated: 0, damageTaken: 0,
      coreAtStart: player.inventory.get("ember_core")?.quantity ?? 0, armourAtStart: player.inventory.get("iron_armour")?.quantity ?? 0,
    };
    this.emberVaultRuns.set(client.sessionId, run);
    client.send("dungeon:run", { runId: run.runId, phase: "started", dungeon: "ember-vault", partySize: 1 } satisfies DungeonRunUpdate);
  }

  private completeEmberVaultRun(client: Client, player: PlayerState, run: EmberVaultRunStats): void {
    const durationMs = Math.max(1, run.completedAt - run.startedAt);
    const rank = silverDepthsRank(durationMs, run.damageTaken);
    const awarded = silverDepthsMoonstoneReward(rank);
    let cores = player.inventory.get("ember_core");
    if (!cores) { cores = new InventoryItemState(); player.inventory.set("ember_core", cores); }
    cores.quantity = Math.min(65_535, cores.quantity + awarded);
    const equipmentObtained = (player.inventory.get("iron_armour")?.quantity ?? 0) > run.armourAtStart;
    client.send("dungeon:run", {
      runId: run.runId, phase: "completed", dungeon: "ember-vault", partySize: 1, durationMs, rank,
      reward: `+${awarded} Ember Core${awarded === 1 ? "" : "s"} · ${equipmentObtained ? "Forged armour obtained" : "Colossus equipment secured"}`,
      stats: { enemiesDefeated: run.enemiesDefeated, damageTaken: run.damageTaken, moonstoneCollected: 0,
        emberCoresAwarded: awarded, emberCoresTotal: cores.quantity, signatureItemObtained: equipmentObtained },
    } satisfies DungeonRunUpdate);
    this.emberVaultRuns.delete(client.sessionId);
  }

  private async resolveAdminAccess(profileToken: string, requestedPass: unknown): Promise<boolean> {
    const profileKey = adminProfileKey(profileToken);
    try {
      if (await this.presence.hget(ADMIN_PROFILE_HASH, profileKey) === "1") return true;
      if (!matchesAdminBootstrapPass(requestedPass)) return false;
      const claimedBy = await this.presence.hget(ADMIN_BOOTSTRAP_HASH, "claimedBy");
      if (claimedBy && claimedBy !== profileKey) return false;
      await this.presence.hset(ADMIN_BOOTSTRAP_HASH, "claimedBy", profileKey);
      await this.presence.hset(ADMIN_PROFILE_HASH, profileKey, "1");
      return true;
    } catch (error) {
      console.warn("Admin entitlement could not be resolved.", error);
      return false;
    }
  }

  private useRealmWardenGate(client: Client, payload: unknown): void {
    if (!payload || typeof payload !== "object" || !("id" in payload) || payload.id !== "warden-gate") return;
    const player = this.state.players.get(client.sessionId), portal = this.state.portals.get("warden-gate"), now = Date.now();
    if (!player || !portal || !canUseForestPortal(player, portal, now) || !hasCombatLineOfSight(player, portal, this.readWorldBlock)) return;
    if (!player.realmWardenCleared) {
      client.send("portal:notice", "WARDEN GATE LOCKED · defeat the Realm Stone Warden once to awaken this challenge.");
      return;
    }
    const existing = this.state.mobs.get(REALM_WARDEN_ID);
    if (this.realmWardenRepeatActive || existing?.alive) {
      client.send("portal:notice", "WARDEN GATE ACTIVE · the Ascendant Warden is already waiting in the court.");
      return;
    }
    if (now < this.realmWardenRepeatAvailableAt) {
      client.send("portal:notice", `WARDEN GATE RECOVERING · available in ${Math.ceil((this.realmWardenRepeatAvailableAt - now) / 1000)} seconds.`);
      return;
    }
    const definition = realmEventDefinition(REALM_WARDEN_ID)!;
    const nearbyPlayers = [...this.state.players.values()].filter(candidate => candidate.health > 0
      && Math.abs(candidate.y - REALM_WARDEN_HOME.y) <= 2.5
      && Math.hypot(candidate.x - REALM_WARDEN_HOME.x, candidate.z - REALM_WARDEN_HOME.z) <= REALM_EVENT_SCALING_RADIUS).length;
    const scale = realmEventScale(nearbyPlayers, definition);
    this.registerMob(definition.id, definition.archetype, definition.position);
    const mob = this.state.mobs.get(definition.id)!;
    mob.name = "Ascendant Realm Stone Warden";
    mob.isChampion = true;
    mob.health = mob.maxHealth = Math.min(120, Math.ceil(scale.maxHealth * 1.35));
    mob.attackPattern = "rocks";
    mob.attackDamage = Math.max(4, scale.attackDamage + 1);
    mob.rewardMultiplier = Math.max(3.5, scale.rewardMultiplier + 1);
    mob.level = Math.min(20, enemyLevelForTier(mob.difficultyTier, true, true) + 2);
    mob.materializeUntil = now + 2_500;
    mob.combatState = "recover";
    mob.stateUntil = mob.materializeUntil;
    this.realmBossPhases.set(definition.id, 1);
    this.realmRewardLandingIndex = 0;
    this.realmBossEmptySince = 0;
    this.realmWardenRepeatActive = true;
    this.broadcast("realm:repeat", { active: true });
    this.broadcast("chat:notice", "WARDEN GATE OPENED · the Ascendant Realm Stone Warden has awakened. Improved personal rewards await contributors.");
    this.refreshNearbyObjectives();
  }

  private useForestPortal(client: Client, payload: unknown): void {
    if (!payload || typeof payload !== "object" || !("id" in payload) || typeof payload.id !== "string") return;
    const player = this.state.players.get(client.sessionId), portal = this.state.portals.get(payload.id), now = Date.now();
    if (!player || !portal || !canUseForestPortal(player, portal, now)
      || now - (this.forestTravelAt.get(client.sessionId) ?? -Infinity) < 1000
      || !hasCombatLineOfSight(player, portal, this.readWorldBlock)) return;
    if (portal.kind === "return" && !this.forestReturns.has(client.sessionId)) return;
    if (portal.kind === "return" && this.forestDungeonRun?.completedAt && this.forestDungeonRun.entered.has(client.sessionId)
      && !this.forestDungeonRun.claimed.has(client.sessionId)) {
      client.send("portal:notice", "Claim your personal Rootbound Cache before returning to town.");
      return;
    }
    this.forestTravelAt.set(client.sessionId, now);
    let destination = this.forestReturns.get(client.sessionId) ?? FOREST_PORTAL_POSITION;
    if (portal.kind === "entry") {
      const cooldownUntil = this.forestDungeonCooldownUntil.get(client.sessionId) ?? 0;
      if (now < cooldownUntil) {
        client.send("portal:notice", `Forest Dungeon recovering · available in ${Math.ceil((cooldownUntil - now) / 1000)} seconds.`);
        return;
      }
      if (this.forestDungeonRun && !this.forestDungeonRun.allowed.has(client.sessionId)) {
        client.send("portal:notice", "Forest Dungeon occupied · this run belongs to another adventurer or party.");
        return;
      }
      if (this.forestDungeonRun?.phase === "active") {
        client.send("portal:notice", "Expedition already underway · late entry is closed.");
        return;
      }
      if (!this.forestDungeonActive) {
        this.forestDungeonActive = true;
        if (!this.forestDungeonRun) {
          const cohort = this.parties.cohort(client.sessionId);
          this.forestDungeonRun = { id: `forest-run-${++this.forestDungeonRunSequence}`, key: cohort.key,
            allowed: new Set(cohort.members.filter(id => this.state.players.has(id))), entered: new Set(), ready: new Set(), claimed: new Set(), phase: "lobby", scalePlayers: 1, startedAt: 0, completedAt: 0 };
        }
        this.state.portals.delete("forest-victory");
        this.forestGate(168, false); this.forestGate(180, false);
        for (const cover of FOREST_DUNGEON_COVER.filter(entry => entry.stage === 3)) this.setGuardianCover(cover, false);
        const exit = new ForestPortalState(); Object.assign(exit, FOREST_DUNGEON_EXIT, { kind: "return" });
        this.state.portals.set("forest-return", exit);
      }
      this.forestDungeonRun!.entered.add(client.sessionId);
      this.forestReturns.set(client.sessionId, { x: portal.x, y: portal.y, z: portal.z });
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
    if (portal.kind === "entry") this.sendDungeonLobby();
    void this.persistPlayer(client.sessionId, player);
  }

  private async returnPlayerToTown(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.health > 0) return;
    const now = Date.now();
    const returningFromSilverDepths = this.roomKind === "silver-depths";
    const spawn = returningFromSilverDepths ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : this.spawnPoint();
    this.silverDepthsRuns.delete(client.sessionId);
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
    await this.persistPlayer(client.sessionId, player, true);
    if (returningFromSilverDepths) {
      client.send("portal:notice", "Expedition failed · returning to the Town of Beginnings.");
      client.send("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths", retry: true,
        ...await this.expeditionReturnTicket(client.sessionId) } satisfies RoomTransfer);
    } else client.send("player:returned", spawn);
  }

  private releaseMobVolley(mobId: string, mob: MobState, origin: { x: number; y: number; z: number }, shots: { x: number; y: number; z: number }[], now: number, travelMs: number, damage: number, hazardRadius: number, hazardDurationMs: number): void {
    for (const aim of shots) {
      const projectileId = `${mobId}:${++this.mobProjectileSequence}`;
      const start = { x: origin.x, y: origin.y + 1.05, z: origin.z };
      const end = { x: aim.x, y: aim.y + .08, z: aim.z };
      this.pendingMobProjectiles.set(projectileId, { projectileId, mobId, archetype: mob.archetype, damage, hazardRadius, hazardDurationMs,
        start, end, position: start, startedAt: now, impactAt: now + travelMs });
      this.broadcast("combat:mob-projectile", { projectileId, mobId, kind: mobId === CRYSTAL_MATRIARCH_ID || mobId === ASHGLASS_ORACLE_ID ? "crystal" : mob.archetype === "stone_brute" ? "rock" : "acid", ...origin, targetX: aim.x, targetY: aim.y, targetZ: aim.z, travelMs, releasedAt: now } satisfies MobProjectileReleased);
    }
  }

  private scheduleRealmFallingRocks(mobId: string, target: { x: number; y: number; z: number }, now: number, damage: number, barrage = false): void {
    const sequence = ++this.realmBossHazardSequence;
    const impactAt = now + (barrage ? 1_350 : 1_650);
    for (const [index, site] of fallingRockSites(target, sequence, barrage ? 4 : 3).entries()) {
      const hazard = { hazardId: `realm-rock-${sequence}-${index}`, kind: "falling-rock" as const,
        x: site.x, y: site.y, z: site.z, radius: site.radius, impactAt, expiresAt: impactAt + 550, mobId, damage };
      this.realmBossPendingHazards.push(hazard);
      this.broadcast("depths:hazard", hazard satisfies DepthsRouteHazard);
    }
  }

  private advanceRealmBossHazards(now: number): void {
    for (let index = this.realmBossPendingHazards.length - 1; index >= 0; index--) {
      const hazard = this.realmBossPendingHazards[index]!;
      const mob = this.state.mobs.get(hazard.mobId);
      if (!mob?.alive) { this.realmBossPendingHazards.splice(index, 1); continue; }
      if (now < hazard.impactAt) continue;
      this.realmBossPendingHazards.splice(index, 1);
      this.broadcast("depths:hazard-impact", hazard satisfies DepthsRouteHazard);
      for (const [id, player] of this.state.players) {
        if (player.health > 0 && !isInsideTownSafeZone(player) && Math.abs(player.y - hazard.y) <= 1.5
          && Math.hypot(player.x - hazard.x, player.z - hazard.z) <= hazard.radius
          && hasCombatLineOfSight(hazard, player, this.readWorldBlock))
          this.damagePlayer(hazard.mobId, id, hazard.damage, now, false, "hazard");
      }
    }
  }

  private teleportAshglassOracle(mob: MobState, target: { x: number; y: number; z: number }, sequence: number): void {
    const angle = (45 + sequence * 90) * Math.PI / 180;
    const desired = { x: target.x + Math.sin(angle) * 5, y: target.y, z: target.z + Math.cos(angle) * 5 };
    const landing = walkableMobSpawn(desired, this.readWorldBlock, pose => this.mobPositionAllowed(pose)
      && this.championAllowed(ASHGLASS_ORACLE_ID, pose) && !isInsideTownSafeZone(pose));
    mob.x = landing.x; mob.y = landing.y; mob.z = landing.z;
    mob.yaw = Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI;
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
      if (collision?.kind === "terrain") {
        if (projectile.mobId === CRYSTAL_MATRIARCH_ID) this.damageMatriarchCover(impact);
        if (this.state.mobs.get(projectile.mobId)?.isMiniBoss) this.damageMiniBossArenaCover(projectile.mobId, impact);
        continue;
      }
      const definition = mobArchetype(projectile.archetype);
      const target = collision?.targetId ? this.state.players.get(collision.targetId) : undefined;
      if (target && collision?.targetId) {
        this.damagePlayer(projectile.mobId, collision.targetId, projectile.damage, now, true, "projectile");
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
        if (this.damagePlayer(hazard.mobId, playerId, hazard.damage, now, false, "hazard")) hazard.lastDamageAt.set(playerId, now);
      }
    }
    for (const [playerId, player] of this.state.players) {
      if (player.health <= 0 || player.y < 7 || player.y > 9 || !isMistfenToxicPool(player.x, player.z)) continue;
      const lastDamageAt = this.mistfenPoolDamageAt.get(playerId) ?? 0;
      if (now - lastDamageAt < 1_250) continue;
      if (this.damagePlayer("mistfen-pool", playerId, 1, now, false, "hazard")) this.mistfenPoolDamageAt.set(playerId, now);
    }
  }

  private createVenomSetPool(sessionId: string, origin: MobState, now: number): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const perk = equipmentPerkStats("venomweave_mantle", equipmentReforgeRank(player.reforgeRanksJson, "venomweave_mantle"))!;
    const hazardId = `venom-set:${sessionId}:${++this.huntSetEffectSequence}`;
    const pool: ActiveVenomSetPool = {
      hazardId, ownerId: sessionId, x: origin.x, y: origin.y, z: origin.z,
      radius: perk.radius ?? 2.1, damage: perk.damage ?? 1,
      expiresAt: now + (perk.durationMs ?? 3_000), nextDamageAt: now + 700,
    };
    this.venomSetPools.set(hazardId, pool);
    this.broadcast("combat:mob-hazard", { hazardId, mobId: sessionId, kind: "acid", x: pool.x, y: pool.y,
      z: pool.z, radius: pool.radius, expiresAt: pool.expiresAt } satisfies MobHazardPlaced);
  }

  private resolveVenomSetPools(now: number): void {
    for (const [hazardId, pool] of this.venomSetPools) {
      if (now >= pool.expiresAt) { this.venomSetPools.delete(hazardId); continue; }
      if (now < pool.nextDamageAt) continue;
      pool.nextDamageAt = now + 900;
      const player = this.state.players.get(pool.ownerId);
      if (!player || player.health <= 0) { this.venomSetPools.delete(hazardId); continue; }
      for (const [mobId, mob] of this.state.mobs) {
        if (!mob.alive || mob.health <= 0 || Math.abs(mob.y - pool.y) > 1.75
          || Math.hypot(mob.x - pool.x, mob.z - pool.z) > pool.radius
          || !hasCombatLineOfSight(pool, mob, this.readWorldBlock)) continue;
        const damage = damageAfterArmor(pool.damage, mob.armor);
        this.combatContributions.record(mobId, pool.ownerId, Math.min(mob.health, damage), now);
        mob.health = Math.max(0, mob.health - damage); mob.hitSequence += 1;
        this.alertHitMob(mobId, pool.ownerId, now, pool);
        if (mob.health === 0) this.defeatMob(mobId, mob, pool.ownerId, now);
        this.broadcast("combat:hit", { attackerId: pool.ownerId, mainHandId: "acid_gland_focus", mobId,
          damage, health: mob.health, defeated: !mob.alive, comboStep: 1, knockback: 0,
          momentumStacks: player.momentumStacks, secondary: true, perk: "venom_set", setBonus: "venom" } satisfies CombatHit);
      }
    }
  }

  private advanceSilverDepthsRouteHazards(now: number): void {
    if (this.roomKind !== "silver-depths" || this.silverDepthsEncounterStage !== 2 || !this.silverDepthsWing) return;
    const wing = this.silverDepthsWing;
    const inWing = (player: PlayerState) => player.health > 0 && player.y >= .8 && player.y <= 5.2
      && player.x >= 88 && player.x <= 112
      && (wing === "iron" ? player.z >= -14 && player.z <= 2 : player.z >= 27 && player.z <= 35);
    const participants = this.activeSilverDepthsParticipants()
      .flatMap(id => { const player = this.state.players.get(id); return player && inWing(player) ? [{ id, player }] : []; });
    if (participants.length && now >= this.silverDepthsNextHazardAt) {
      const sequence = ++this.silverDepthsHazardSequence;
      const impactAt = now + (wing === "iron" ? 1_500 : 1_700);
      const sites = wing === "iron"
        ? [{ x: participants[(sequence - 1) % participants.length]!.player.x,
          z: participants[(sequence - 1) % participants.length]!.player.z, radius: 1.8 }]
        : sequence % 2
          ? [{ x: 96.5, z: 29.5, radius: 2.3 }, { x: 105.5, z: 32.5, radius: 2.3 }]
          : [{ x: 96.5, z: 32.5, radius: 2.3 }, { x: 105.5, z: 29.5, radius: 2.3 }];
      for (const [index, site] of sites.entries()) {
        const hazard: DepthsRouteHazard = { hazardId: `depths-${wing}-${sequence}-${index}`,
          kind: wing === "iron" ? "falling-rock" : "crystal-pulse", x: site.x, y: 1, z: site.z,
          radius: site.radius, impactAt, expiresAt: impactAt + 550 };
        this.silverDepthsPendingHazards.push(hazard);
        this.broadcast("depths:hazard", hazard);
      }
      this.silverDepthsNextHazardAt = now + (wing === "iron" ? 5_200 : 5_800);
    }
    for (let index = this.silverDepthsPendingHazards.length - 1; index >= 0; index--) {
      const hazard = this.silverDepthsPendingHazards[index]!;
      if (now < hazard.impactAt) continue;
      this.silverDepthsPendingHazards.splice(index, 1);
      this.broadcast("depths:hazard-impact", hazard);
      for (const { id, player } of participants) {
        if (Math.hypot(player.x - hazard.x, player.z - hazard.z) <= hazard.radius
          && this.damagePlayer("depths-environment", id, wing === "iron" ? 2 : 1, now, false, "hazard")) {
          this.clients.find(client => client.sessionId === id)?.send("portal:notice",
            wing === "iron" ? "FALLING ROCK · move out of the marked circle!" : "CRYSTAL PULSE · dodge into the clear lane!");
        }
      }
    }
  }

  private handleMove(client: Client, payload: unknown): void {
    if (this.movementPilotControllers.has(client.sessionId)) return;
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

  private resetForestDungeon(now: number): void {
    const entered = this.forestDungeonRun ? [...this.forestDungeonRun.entered] : [...this.forestReturns.keys()];
    for (const playerId of entered) this.forestDungeonCooldownUntil.set(playerId,
      Math.max(this.forestDungeonCooldownUntil.get(playerId) ?? 0, now + 45_000));
    this.forestDungeonActive = false;
    this.forestDungeonRun = null;
    this.forestDungeonReopenAt = now + 45_000;
    this.state.portals.delete("forest-return"); this.state.portals.delete("forest-entry");
    this.state.portals.delete("forest-victory");
    for (const dropId of [...this.state.lootDrops.keys()]) if (dropId.startsWith("forest-cache:")) this.state.lootDrops.delete(dropId);
    this.forestReturns.clear();
    this.forestGate(168, false); this.forestGate(180, false);
    for (const cover of FOREST_DUNGEON_COVER.filter(entry => entry.stage === 3)) this.setGuardianCover(cover, false);
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

  private simulateMovementShadows(deltaTime: number): void {
    if (!this.inputs) return;
    const now = Date.now();
    const report = now - this.movementShadowSampleAt >= 100;
    if (report) this.movementShadowSampleAt = now;
    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      const shadow = this.movementShadows.get(client.sessionId);
      if (!player || player.health <= 0) continue;
      const command = this.inputs.get(client.sessionId).next();
      if (this.movementPilotControllers.has(client.sessionId)) {
        const direction = command ?? { strafe: 0, forward: 0, yaw: player.yaw };
        const speed = movementSpeedWithMomentum(player.defending ? 2.1 : 4.2, player.momentumStacks, player.equippedTrait as TraitId)
          * armourStats(player.armourId).speed * progressionSpeedMultiplier(player);
        const next = stepShadowMovement({ x: player.x, y: player.y, z: player.z, verticalVelocity: player.pilotVy },
          direction, speed, deltaTime, this.readWorldBlock);
        player.x = next.x; player.y = next.y; player.z = next.z; player.pilotVy = next.verticalVelocity;
        if (command && Number.isFinite(command.yaw)) player.yaw = command.yaw;
        const previous = this.movementInputs.get(client.sessionId)?.request.sequence ?? 0;
        this.movementInputs.set(client.sessionId, { request: { sequence: previous + 1,
          strafe: direction.strafe, forward: direction.forward, yaw: player.yaw }, receivedAt: now });
        if (Math.hypot(direction.strafe, direction.forward) > 0.01) this.pendingMining.delete(client.sessionId);
        if (report) client.send("movement:shadow:sample", { x: next.x, y: next.y, z: next.z,
          authorityX: player.x, authorityY: player.y, authorityZ: player.z, reset: false, control: true });
        continue;
      }
      if (!shadow) continue;
      const teleportDistance = Math.hypot(player.x - shadow.x, player.y - shadow.y, player.z - shadow.z);
      if (teleportDistance > 8) {
        this.movementShadows.set(client.sessionId, { x: player.x, y: player.y, z: player.z, verticalVelocity: 0 });
        if (report) client.send("movement:shadow:sample", { x: player.x, y: player.y, z: player.z,
          authorityX: player.x, authorityY: player.y, authorityZ: player.z, reset: true });
        continue;
      }
      const speed = movementSpeedWithMomentum(player.defending ? 2.1 : 4.2, player.momentumStacks, player.equippedTrait as TraitId)
        * armourStats(player.armourId).speed * progressionSpeedMultiplier(player);
      const next = stepShadowMovement(shadow, command ?? { strafe: 0, forward: 0 }, speed, deltaTime, this.readWorldBlock);
      this.movementShadows.set(client.sessionId, next);
      if (report) client.send("movement:shadow:sample", { x: next.x, y: next.y, z: next.z,
        authorityX: player.x, authorityY: player.y, authorityZ: player.z, reset: false });
    }
  }

  private simulatePlayers(deltaTime: number): void {
    if (this.roomKind === "overworld") for (const [playerId, player] of this.state.players) this.discoverMistfen(playerId, player);
    if (this.roomKind === "overworld") for (const [playerId, player] of this.state.players) this.discoverGreenwood(playerId, player);
    if (Date.now() - this.lastPartyUpdateAt >= 500) {
      if (this.roomKind === "overworld") this.sendPartyUpdates(Date.now());
      else this.lastPartyUpdateAt = Date.now();
      for (const client of this.clients) this.sendObjectiveState(client);
    }
    const now = Date.now();
    if (this.roomKind === "overworld" && this.silverDepthsLobbies.size) this.validateSilverDepthsLobbies(now);
    if (this.roomKind === "overworld") {
      const entrance = this.state.portals.get("forest-entry");
      if (entrance && entrance.expiresAt > 0 && now >= entrance.expiresAt) {
        this.state.portals.delete("forest-entry");
        if (!this.forestDungeonActive) this.forestDungeonRun = null;
      }
      if (this.forestDungeonActive && ![...this.state.players.values()].some(player => isInForestDungeon(player.x, player.z))) {
        this.resetForestDungeon(now);
      }
    }
    this.resolveMining(now);
    if (this.silverDepthsCacheAmbushPhase === "warning") this.advanceSilverDepthsCacheAmbush(now);
    if (this.roomKind === "overworld") this.regrowMinerals(now);
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
    this.resolveVenomSetPools(now);
    this.advanceRealmBossHazards(now);
    this.advanceSilverDepthsRouteHazards(now);
    if (this.roomKind === "overworld") {
      this.advanceRealmEvent(now);
      this.advanceRealmBossAbandonment(now);
      for (const pack of ROAMING_PACKS) {
        const route = this.roamingRoutes.get(pack.id) ?? createRoamingRouteState(now);
        this.roamingRoutes.set(pack.id, route);
        const members = pack.offsets.flatMap((_, index) => {
          const mob = this.state.mobs.get(roamingMemberId(pack, index));
          return mob?.alive ? [{ index, pose: mob, idle: mob.combatState === "idle" && !this.roamingEngaged.has(roamingMemberId(pack, index)) && !this.roamingReturning.has(roamingMemberId(pack, index)) }] : [];
        });
        advanceRoamingRoute(pack, route, now, members);
      }
    }
    for (const [mobId, mob] of this.state.mobs) {
      const huntChampion = this.huntChampions.get(mobId);
      if (isRealmEventId(mobId) && !mob.alive) continue;
      if (!mob.alive && this.huntChampions.has(mobId)) {
        if (now >= mob.respawnAt) {
          this.huntChampions.delete(mobId); this.state.mobs.delete(mobId); this.mobHomes.delete(mobId);
          this.mobNavigation.delete(mobId); this.mobAwareness.delete(mobId); this.areaLeaderPhases.delete(mobId);
        }
        continue;
      }
      if (!mob.alive && FOREST_DUNGEON_MOBS.some(entry => entry.id === mobId)) continue;
      if (!mob.alive && this.roomKind === "silver-depths"
        && (SILVER_DEPTHS_ENEMY_IDS.includes(mobId) || SILVER_DEPTHS_CACHE_GUARD_IDS.includes(mobId))) continue;
      if (mobId === "mistfen-behemoth" && mob.alive && mob.leaderRematchTier > 0
        && mob.leaderModifier !== "mirebreaker" && this.activeMistfenMasteryRank() >= 3) {
        const healthRatio = mob.health / Math.max(1, mob.maxHealth);
        mob.leaderRematchTier = Math.max(5, mob.leaderRematchTier);
        mob.leaderModifier = "mirebreaker";
        mob.maxHealth = Math.min(120, Math.ceil(mob.maxHealth * 1.2));
        mob.health = Math.max(1, Math.ceil(mob.maxHealth * healthRatio));
        mob.attackDamage = Math.min(12, mob.attackDamage + 1);
        mob.speedMultiplier = Math.min(1.65, mob.speedMultiplier * 1.08);
        mob.rewardMultiplier *= 1.35;
      }
      if (mobId === "wild-crawler" && mob.alive && mob.leaderRematchTier > 0
        && mob.leaderModifier !== "rootslayer" && this.activeGreenwoodMasteryRank() >= 3) {
        const healthRatio = mob.health / Math.max(1, mob.maxHealth);
        mob.leaderRematchTier = Math.max(5, mob.leaderRematchTier); mob.leaderModifier = "rootslayer";
        mob.maxHealth = Math.min(120, Math.ceil(mob.maxHealth * 1.22));
        mob.health = Math.max(1, Math.ceil(mob.maxHealth * healthRatio));
        mob.attackDamage = Math.min(12, mob.attackDamage + 1); mob.speedMultiplier = Math.min(1.65, mob.speedMultiplier * 1.12);
        mob.rewardMultiplier *= 1.35;
      }
      let currentAreaLeaderPhase: AreaLeaderPhase = 1;
      if (mob.isMiniBoss && mob.alive) {
        currentAreaLeaderPhase = huntChampion
          ? huntChampionPhase(mob.health, mob.maxHealth)
          : areaLeaderPhase(mob.health, mob.maxHealth);
        const previousPhase = this.areaLeaderPhases.get(mobId);
        if (previousPhase === undefined) this.areaLeaderPhases.set(mobId, currentAreaLeaderPhase);
        else if (currentAreaLeaderPhase > previousPhase) {
          this.areaLeaderPhases.set(mobId, currentAreaLeaderPhase);
          this.enterAreaLeaderPhase(mobId, mob, previousPhase, currentAreaLeaderPhase, now);
        }
      }
      if (isRealmEventId(mobId)) {
        if (mob.materializeUntil > now) {
          mob.combatState = "recover"; mob.stateUntil = mob.materializeUntil; mob.targetId = ""; continue;
        }
        if (mob.materializeUntil > 0) mob.materializeUntil = 0;
        const currentRealmPhase = realmBossPhase(mob.health, mob.maxHealth);
        const previousRealmPhase = this.realmBossPhases.get(mobId);
        if (previousRealmPhase === undefined) this.realmBossPhases.set(mobId, currentRealmPhase);
        else if (currentRealmPhase > previousRealmPhase) {
          this.realmBossPhases.set(mobId, currentRealmPhase);
          this.enterRealmBossPhase(mobId, mob, currentRealmPhase, now);
        }
        mob.enraged = currentRealmPhase >= 2;
        if (mob.combatState === "idle") mob.attackPattern = mobId === MISTFEN_EVENT_ID && this.realmEvents.mistfenVariant
          ? mistfenEventPattern(this.realmEvents.mistfenVariant, mob.actionSequence, mob.health, mob.maxHealth)
          : realmBossPattern(mobId, mob.actionSequence, mob.health, mob.maxHealth) ?? mob.attackPattern;
      }
      else if (mobId === WILDERNESS_EVENT_ID || mobId === CRYSTAL_MATRIARCH_ID) {
        if (!mob.enraged && matriarchEnraged(mob.health, mob.maxHealth)) mob.enraged = true;
        if (mob.combatState === "idle") mob.attackPattern = mobId === CRYSTAL_MATRIARCH_ID
          ? crystalMatriarchPattern(mob.actionSequence, mob.enraged) : matriarchPattern(mob.actionSequence, mob.enraged);
      }
      else if (mobId === "forest-guardian") {
        if (!mob.enraged && mob.health > 0 && mob.health * 2 < mob.maxHealth) mob.enraged = true;
        if (mob.combatState === "idle") mob.attackPattern = mob.enraged ? championPattern(mob) : "slam";
      }
      else if (isAreaMiniBoss(mobId) && mob.combatState === "idle") {
        const orbitCounter = (this.miniBossOrbitPressure.get(mobId)?.counterUntil ?? 0) > now;
        mob.attackPattern = orbitCounter ? miniBossOrbitCounterPattern(mob.archetype)
          : areaLeaderPattern(mob.archetype, mob.actionSequence, currentAreaLeaderPhase, mobId);
      }
      else if (mob.isElite && mob.combatState === "idle") mob.attackPattern = isMistfenEventFollower(mobId)
        && this.realmEvents.mistfenVariant === "mireback-stampede" ? "bog-charge"
        : wildernessElitePattern(mob.archetype as MobArchetypeId, mob.actionSequence);
      else if (mob.isChampion && mob.combatState === "idle") mob.attackPattern = huntChampion
        ? huntChampionPattern(huntChampion.pathId, mob.actionSequence, currentAreaLeaderPhase, huntChampion.difficulty)
        : mob.isMiniBoss && (this.miniBossOrbitPressure.get(mobId)?.counterUntil ?? 0) > now
          ? miniBossOrbitCounterPattern(mob.archetype) : championPattern(mob);
      else if (mobId === "frontier-brute" && mob.combatState === "idle") mob.attackPattern = frontierBrutePattern(mob.actionSequence);
      else if (mob.archetype === "cave_spitter" && mob.combatState === "idle") mob.attackPattern = isAshenSentry(mobId)
        ? ashenSentryPattern(mob.actionSequence) : spitterPattern(mob.actionSequence + (mobId === "frontier-spitter" ? 1 : 0));
      if (mob.archetype === "stone_brute" && mob.combatState === "idle") {
        const eligible = [...this.state.players.values()].filter(player => player.health > 0 && !isInsideTownSafeZone(player)
          && Math.abs(player.y - mob.y) <= 1.75 && caveEncounterAllows(mobId, player) && this.roamingAllowed(mobId, player) && this.championAllowed(mobId, player));
        const distance = Math.min(...eligible.map(player => Math.hypot(player.x - mob.x, player.z - mob.z)));
        const realmPattern = mobId === MISTFEN_EVENT_ID && this.realmEvents.mistfenVariant
          ? mistfenEventPattern(this.realmEvents.mistfenVariant, mob.actionSequence, mob.health, mob.maxHealth)
          : realmBossPattern(mobId, mob.actionSequence, mob.health, mob.maxHealth);
        const orbitCounter = mob.isMiniBoss && (this.miniBossOrbitPressure.get(mobId)?.counterUntil ?? 0) > now;
        mob.attackPattern = realmPattern ?? (mobId === "forest-guardian" && mob.enraged ? championPattern(mob)
          : orbitCounter ? miniBossOrbitCounterPattern(mob.archetype)
          : isAreaMiniBoss(mobId) ? mobId === "frontier-brute" && currentAreaLeaderPhase === 1 && bruteVolleyReady(mob.actionSequence, distance)
              ? "rocks" : areaLeaderPattern(mob.archetype, mob.actionSequence, currentAreaLeaderPhase, mobId)
          : mob.isElite ? isMistfenEventFollower(mobId) && this.realmEvents.mistfenVariant === "mireback-stampede"
            ? "bog-charge" : wildernessElitePattern(mob.archetype as MobArchetypeId, mob.actionSequence)
          : bruteVolleyReady(mob.actionSequence, distance) ? "rocks"
          : huntChampion ? huntChampionPattern(huntChampion.pathId, mob.actionSequence, currentAreaLeaderPhase, huntChampion.difficulty)
          : mob.isChampion ? championPattern(mob)
          : mobId === "frontier-brute" ? frontierBrutePattern(mob.actionSequence)
          : "slam");
      }
      if (!huntChampion && mob.isMiniBoss && mob.combatState === "idle" && mob.leaderRematchTier > 0) {
        mob.attackPattern = leaderRematchPattern(mob.attackPattern, mob.archetype, mob.actionSequence, mob.leaderModifier);
      }
      const definition = combatMobDefinition(mob);
      const home = this.mobHomes.get(mobId) ?? definition.spawn;
      if (!mob.alive && now >= mob.respawnAt) {
        const isWildernessEnemy = this.roomKind === "overworld" && !mob.isChampion
          && (WILDERNESS_ENCOUNTERS.some(encounter => encounter.id === mobId) || roamingMembership(mobId) !== null);
        const materializing = isWildernessEnemy && mob.materializeUntil > 0;
        const spawn = materializing ? { x: mob.x, y: mob.y, z: mob.z }
          : walkableMobSpawn(home, this.readWorldBlock, pose => this.mobPositionAllowed(pose)
            && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose));
        if (materializing && !wildernessSpawnClear(spawn, this.state.players.values())) {
          mob.materializeUntil = 0;
          mob.respawnAt = now + WILDERNESS_RESPAWN_RECHECK_MS;
          continue;
        }
        if (isWildernessEnemy && !materializing) {
          if (!wildernessSpawnClear(spawn, this.state.players.values())) {
            mob.respawnAt = now + WILDERNESS_RESPAWN_RECHECK_MS;
            continue;
          }
          const band = dangerBandAt(home);
          const activeElites = [...this.state.mobs.entries()].filter(([id, candidate]) => id !== mobId && !isAreaMiniBoss(id) && candidate.isElite
            && (candidate.alive || candidate.materializeUntil > now)).length;
          const areaMiniBoss = areaMiniBossDefinition(mobId);
          const pendingRematch = leaderRematch(mobId, this.leaderDefeats.get(mobId) ?? 0);
          const mistfenRank = isMistfenMob(mobId) ? this.activeMistfenMasteryRank() : 0;
          const greenwoodRank = isGreenwoodCampMob(mobId) ? this.activeGreenwoodMasteryRank() : 0;
          mob.isElite = !areaMiniBoss && (mistfenRank >= 2 || greenwoodRank >= 2 || shouldBecomeWildernessElite(band.tier, activeElites, Math.random()));
          const eliteKind = wildernessEliteKind(definition.id);
          mob.eliteKind = mob.isElite ? eliteKind : "";
          const baseName = this.mobBaseNames.get(mobId) ?? definition.name;
          mob.name = areaMiniBoss?.name ?? (mob.isElite ? wildernessEliteName(eliteKind, baseName) : baseName);
          if (areaMiniBoss) {
            mob.leaderRematchTier = pendingRematch.tier;
            mob.leaderModifier = pendingRematch.modifier;
          }
          mob.actionSequence = 0;
          if (areaMiniBoss) mob.attackPattern = areaLeaderPattern(definition.id, 0, 1, mobId);
          else if (mob.isElite) mob.attackPattern = wildernessElitePattern(definition.id, 0);
          mob.x = spawn.x; mob.y = spawn.y; mob.z = spawn.z;
          mob.materializeUntil = now + WILDERNESS_MATERIALIZE_MS;
          mob.respawnAt = mob.materializeUntil;
          continue;
        }
        this.combatContributions.clear(mobId);
        this.mobProgress.delete(mobId); this.mobUnreachableUntil.delete(mobId); this.mobReturning.delete(mobId);
        mob.awarenessState = "patrol"; mob.alertUntil = 0;
        this.mobAwareness.delete(mobId);
        const band = dangerBandAt(home);
        const baseStats = scaledMobStats(definition, band);
        const stats = isAreaMiniBoss(mobId) || mob.isElite ? wildernessEliteStats(baseStats) : baseStats;
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
        this.restoreMiniBossArena(mobId);
        this.miniBossEngagedAt.delete(mobId);
        this.miniBossOrbitPressure.delete(mobId);
        mob.aimCommitted = false;
        mob.health = stats.maxHealth;
        mob.maxHealth = stats.maxHealth;
        mob.armor = stats.armor;
        mob.attackDamage = stats.damage;
        mob.speedMultiplier = stats.speedMultiplier;
        mob.rewardMultiplier = stats.rewardMultiplier;
        mob.enraged = false;
        mob.level = enemyLevelForTier(mob.difficultyTier, mob.isChampion || mob.isElite || isAreaMiniBoss(mobId), false);
        if (mob.isChampion) { mob.rewardMultiplier *= 1.5; mob.actionSequence = 0; mob.attackPattern = championPattern(mob); }
        if (mobId === CRYSTAL_MATRIARCH_ID) { mob.health = mob.maxHealth = 28; mob.attackPattern = crystalMatriarchPattern(0, false); }
        if (mobId === "forge-colossus") { mob.health = mob.maxHealth = 38; mob.attackDamage = 3; mob.attackPattern = "rocks"; }
        const areaLeader = areaMainMobDefinition(mobId);
        if (areaLeader) {
          const rematch = leaderRematch(mobId, this.leaderDefeats.get(mobId) ?? 0);
          const empowered = leaderRematchStats({ maxHealth: mob.maxHealth, damage: mob.attackDamage, armor: mob.armor,
            speedMultiplier: mob.speedMultiplier, rewardMultiplier: mob.rewardMultiplier }, rematch);
          mob.leaderRematchTier = rematch.tier;
          mob.leaderModifier = rematch.modifier;
          mob.health = mob.maxHealth = empowered.maxHealth;
          mob.attackDamage = empowered.damage;
          mob.armor = empowered.armor;
          mob.speedMultiplier = empowered.speedMultiplier;
          mob.rewardMultiplier = empowered.rewardMultiplier;
          if (mobId === "mistfen-behemoth" && this.activeMistfenMasteryRank() >= 3 && rematch.tier > 0) {
            mob.leaderRematchTier = Math.max(5, mob.leaderRematchTier);
            mob.leaderModifier = "mirebreaker";
            mob.health = mob.maxHealth = Math.min(120, Math.ceil(mob.maxHealth * 1.2));
            mob.attackDamage = Math.min(12, mob.attackDamage + 1);
            mob.speedMultiplier = Math.min(1.65, mob.speedMultiplier * 1.08);
            mob.rewardMultiplier *= 1.35;
          }
          if (mobId === "wild-crawler" && this.activeGreenwoodMasteryRank() >= 3 && rematch.tier > 0) {
            mob.leaderRematchTier = Math.max(5, mob.leaderRematchTier); mob.leaderModifier = "rootslayer";
            mob.health = mob.maxHealth = Math.min(120, Math.ceil(mob.maxHealth * 1.22));
            mob.attackDamage = Math.min(12, mob.attackDamage + 1); mob.speedMultiplier = Math.min(1.65, mob.speedMultiplier * 1.12);
            mob.rewardMultiplier *= 1.35;
          }
        }
        if (mobId === CRYSTAL_MATRIARCH_ID) this.restoreMatriarchCover();
        mob.alive = true;
        mob.respawnAt = 0;
        mob.materializeUntil = 0;
        mob.combatState = "idle";
        mob.stateUntil = 0;
        mob.targetId = "";
        if (mob.isMiniBoss) this.areaLeaderPhases.set(mobId, 1);
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
        if (mob.combatState === "recover" && crawlerRushDistance(mob.archetype) > 0 && mob.attackContactEndAt > 0) {
          const next = retreatCrawler(mob, mob.yaw, now, deltaTime, mob.attackContactEndAt, mob.attackRecoveryEndAt,
            this.readWorldBlock, pose => this.mobPositionAllowed(pose) && this.championAllowed(mobId, pose)
              && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && !isInStoneBruteArena(pose.x, pose.z));
          mob.x = next.x; mob.z = next.z;
        }
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
        if (targetPlayer && now < mob.stateUntil - mobAimCommitMs(mob.archetype)
          && hasCombatLineOfSight(mob, targetPlayer, this.readWorldBlock)) {
          const predicted = mob.isMiniBoss
            ? predictedMiniBossAim(mob, targetPlayer, activeMovementInput(this.movementInputs.get(mob.targetId), now, targetPlayer.yaw),
              mob.archetype === "cave_spitter" ? .55 : mob.archetype === "stone_brute" ? .25 : .42)
            : { x: targetPlayer.x, y: targetPlayer.y, z: targetPlayer.z, yaw: Math.atan2(targetPlayer.x - mob.x, targetPlayer.z - mob.z) * 180 / Math.PI };
          const desiredYaw = predicted.yaw;
          mob.yaw = mob.archetype === "stone_brute" ? turnBruteAim(mob.yaw, desiredYaw, deltaTime) : desiredYaw;
          this.mobCommittedAim.set(mobId, { x: predicted.x, y: predicted.y, z: predicted.z, yaw: mob.yaw });
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
        if (mob.isMiniBoss && currentAreaLeaderPhase >= 2
          && mob.actionSequence % leaderRematchPressureCadence(mob.leaderRematchTier, mob.leaderModifier) === 0) {
          this.placeMiniBossArenaPressure(mobId, mob, currentAreaLeaderPhase, now);
        }
        if (!targetPlayer && mob.archetype !== "stone_brute") {
          mob.combatState = "recover";
          mob.stateUntil = now + definition.recoverMs;
          mob.aimCommitted = false;
          this.clearMobAttackTimeline(mob);
          continue;
        }
        if (definition.attackKind === "projectile") {
          if (mob.archetype === "cave_spitter" && !allyFireLaneClear(mobId, mob, aim,
            [...this.state.mobs].map(([id, peer]) => ({ id, x: peer.x, y: peer.y, z: peer.z, alive: peer.alive, archetype: peer.archetype })))) {
            const positioning = this.spitterPositioning.get(mobId) ?? createSpitterPositioning();
            positioning.sidestepPending = true; this.spitterPositioning.set(mobId, positioning);
            mob.targetId = ""; continue;
          }
          const shots = usesRockVolley(mob.attackPattern) ? bruteRockEndpoints(mob, aim.yaw)
            : (mob.isChampion || mob.isElite || mob.isMiniBoss) && mobId !== WILDERNESS_EVENT_ID && mobId !== CRYSTAL_MATRIARCH_ID && !isRealmSpitterBoss(mobId) ? spitterChampionShots(mob, aim, mob.attackPattern) : spitterShotEndpoints(mob, aim.yaw, mob.attackPattern);
          const origin = { x: mob.x, y: mob.y, z: mob.z };
          const championVenom = huntChampion?.pathId === "venom" ? huntChampionVenomHazard(mob.attackPattern) : null;
          const venomPools = mobId === GREENWOOD_MATRIARCH_ID && (mob.attackPattern === "double-fan" || mob.attackPattern === "venom-ring");
          const mistfenEruption = (mobId === "mistfen-behemoth" || mobId === MISTFEN_EVENT_ID)
            && mob.attackPattern === "toxic-eruption";
          this.releaseMobVolley(mobId, mob, origin, shots, now, definition.projectileTravelMs, mob.attackDamage,
            championVenom?.radius ?? (mistfenEruption ? 1.15 : venomPools ? .82 : definition.hazardRadius),
            championVenom?.durationMs ?? (mistfenEruption ? 4_500 : venomPools ? 3_600 : definition.hazardDurationMs));
          if (usesFallingRockZones(mob.attackPattern)) this.scheduleRealmFallingRocks(mobId, aim, now, mob.attackDamage,
            mob.attackPattern === "warden-barrage" || mob.attackPattern === "fault-line" && huntChampion?.difficulty === "ascendant");
          if ((usesDoubleVolley(mob.attackPattern) && (mobId === WILDERNESS_EVENT_ID || mobId === CRYSTAL_MATRIARCH_ID || isRealmEventId(mobId) || isAreaMiniBoss(mobId)))
            || Boolean(huntChampion && huntChampionUsesSecondVolley(huntChampion.pathId, mob.attackPattern))) {
            const secondYaw = matriarchSecondVolleyYaw(aim.yaw, Math.max(0, mob.actionSequence - 1));
            const secondShots = usesRockVolley(mob.attackPattern) ? bruteRockEndpoints(mob, secondYaw)
              : spitterShotEndpoints(mob, secondYaw, mob.attackPattern === "cross-volley" ? "double-fan" : mob.attackPattern);
            this.delayedMatriarchVolleys.set(mobId, { origin, shots: secondShots, releaseAt: now + MATRIARCH_PHASE.volleyGapMs, damage: mob.attackDamage, travelMs: definition.projectileTravelMs });
          }
          if (mobId === ASHGLASS_ORACLE_ID && mob.attackPattern === "teleport-burst") this.teleportAshglassOracle(mob, aim, mob.actionSequence);
          mob.targetId = "";
          continue;
        }
        const deltaX = aim.x - mob.x;
        const deltaZ = aim.z - mob.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (huntChampion?.pathId === "fang" && mob.attackPattern === "pincer-rush")
          this.placeHuntChampionPincer(mobId, aim, aim.yaw, huntChampion.difficulty, now);
        if (mobId === "wild-crawler" && mob.leaderModifier === "rootslayer"
          && (mob.attackPattern === "pincer-rush" || mob.attackPattern === "root-cage"))
          this.placeHuntChampionPincer(mobId, aim, aim.yaw, "ascendant", now);
        if (crawlerRushDistance(mob.archetype) > 0) {
          const leaderRushMultiplier = mob.isMiniBoss ? currentAreaLeaderPhase === 1 ? 1.18 : currentAreaLeaderPhase === 2 ? 1.28 : 1.36 : 1;
          const championRushMultiplier = huntChampion?.pathId === "fang" ? huntChampionRushMultiplier(mob.attackPattern) : 1;
          this.crawlerRushes.set(mobId, { yaw: aim.yaw, distance: crawlerRushDistance(mob.archetype)
            * (mob.isElite ? 1.3 : leaderRushMultiplier) * championRushMultiplier, startedAt: now, progress: 0 });
        } else if (distance > 0.001) {
          const lungeDistance = Math.min(definition.lungeDistance, Math.max(0, distance - definition.stopDistance * 0.6));
          this.displaceMob(mobId, mob, {
            x: Math.sin(aim.yaw * Math.PI / 180) * lungeDistance, z: Math.cos(aim.yaw * Math.PI / 180) * lungeDistance,
          });
        }
        if (mob.isChampion && mob.attackPattern === "charge"
          || (mobId === "mistfen-behemoth" || mobId === MISTFEN_EVENT_ID || isMistfenEventFollower(mobId)) && mob.attackPattern === "bog-charge") {
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
        && now >= (this.pathConcealedUntil.get(player.id) ?? 0)
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
        if (mob.isMiniBoss) {
          this.restoreMiniBossArena(mobId);
          this.miniBossEngagedAt.delete(mobId);
          this.miniBossOrbitPressure.delete(mobId);
          mob.enraged = currentAreaLeaderPhase === 3;
        }
        this.crawlerPositioning.delete(mobId);
        this.spitterPositioning.delete(mobId);
        if (previousTarget && !roamingMembership(mobId)) {
          this.mobReturning.add(mobId);
          this.mobPatrols.delete(mobId);
          this.mobNavigation.set(mobId, createMobNavigationState());
        }
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
      if (mob.isMiniBoss && target.visible) {
        this.activateMiniBossArena(mobId, mob);
        const engagedAt = this.miniBossEngagedAt.get(mobId) ?? now;
        this.miniBossEngagedAt.set(mobId, engagedAt);
        if (now - engagedAt >= MINI_BOSS_ENRAGE_MS) mob.enraged = true;
        this.miniBossOrbitPressure.set(mobId,
          updateOrbitPressure(this.miniBossOrbitPressure.get(mobId), mob, target, now));
      }
      if (target.visible && previousTarget !== target.id) mob.alertUntil = now + 900;
      mob.awarenessState = target.visible ? "engaged" : "search";
      if (roamingMembership(mobId)) this.roamingEngaged.add(mobId);
      if (this.mobPatrols.delete(mobId)) this.mobNavigation.set(mobId, createMobNavigationState());
      const positioning = this.spitterPositioning.get(mobId) ?? createSpitterPositioning();
      if (definition.attackKind === "projectile") this.spitterPositioning.set(mobId, positioning);
      const rangerSlow = this.rangerSlows.get(mobId);
      const movementSpeed = definition.speed * mob.speedMultiplier * (now < (rangerSlow?.until ?? 0) ? rangerSlow!.multiplier : 1);
      const rangedPursuit = mob.archetype === "cave_spitter" && definition.attackKind === "projectile" && target.visible
        ? positionSpitter(mob, target, home, positioning, now, deltaTime, movementSpeed,
          this.readWorldBlock, pose => this.mobPositionAllowed(pose) && this.roamingAllowed(mobId, pose) && caveEncounterAllows(mobId, pose) && !isInStoneBruteArena(pose.x, pose.z),
          pose => allyFireLaneClear(mobId, pose, target, [...this.state.mobs].map(([id, peer]) => ({ id, x: peer.x, y: peer.y, z: peer.z, alive: peer.alive, archetype: peer.archetype }))))
        : null;
      let circling = null;
      if (crawlerRushDistance(mob.archetype) > 0 && target.visible) {
        let flank = this.crawlerPositioning.get(mobId);
        if (!flank || flank.targetId !== target.id) {
          flank = createCrawlerPositioning(mobId, target.id, [...this.state.mobs]
            .filter(([, peer]) => peer.alive && crawlerRushDistance(peer.archetype) > 0 && Math.abs(peer.y - target.y) <= 1.75
              && Math.hypot(peer.x - target.x, peer.z - target.z) <= 8).map(([id]) => id));
          this.crawlerPositioning.set(mobId, flank);
        }
        circling = circleCrawler(mob, target, flank, now, deltaTime, movementSpeed, definition.stopDistance);
      } else this.crawlerPositioning.delete(mobId);
      const attackers = () => [...this.state.mobs.entries()].map(([id, peer]) => ({
        id, alive: peer.alive, health: peer.health, archetype: peer.archetype, combatState: peer.combatState, targetId: peer.targetId,
      }));
      const waiting = definition.attackKind === "melee" && target.visible && meleeSlotsFull(target.id, attackers());
      const waitingGoal = waiting ? meleeWaitingGoal(mobId, target, [...this.mobAwareness.entries()]
        .filter(([id, awareness]) => awareness.targetId === target.id && this.state.mobs.get(id)?.alive
          && this.state.mobs.get(id)?.archetype !== "cave_spitter").map(([id]) => id), definition.stopDistance + 1.1) : null;
      const pursuit = waitingGoal ? pursueTarget(mob, waitingGoal, deltaTime, movementSpeed, .2)
        : circling ?? rangedPursuit ?? pursueTarget(mob, target, deltaTime, movementSpeed, target.visible ? definition.stopDistance : .3);
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
      const baseWindupMs = (mobId === CRYSTAL_MATRIARCH_ID || mobId === ASHGLASS_ORACLE_ID) && (mob.attackPattern === "crystal-burst" || mob.attackPattern === "teleport-burst")
        ? MATRIARCH_PHASE.crystalBurstWindupMs
        : (mobId === "frontier-brute" || isAreaMiniBoss(mobId) && mob.archetype === "stone_brute") && mob.attackPattern === "smash"
          ? FRONTIER_BRUTE.smash.windupMs : definition.windupMs;
      const rematchTiming = leaderRematchTiming(mob.leaderModifier);
      const huntTiming = huntDifficultyTiming(this.huntChampions.get(mobId)?.difficulty
        ?? this.empoweredContractDifficulties.get(mobId) ?? "normal");
      const windupMs = Math.round((baseWindupMs + miniBossWindupDelay(mob.isMiniBoss, mob.actionSequence))
        * rematchTiming.windup * huntTiming.windup);
      if (definition.attackKind === "projectile" && mob.archetype === "cave_spitter"
        && !allyFireLaneClear(mobId, mob, target, [...this.state.mobs].map(([id, peer]) => ({ id, x: peer.x, y: peer.y, z: peer.z, alive: peer.alive, archetype: peer.archetype })))) {
        positioning.sidestepPending = true;
        continue;
      }
      const actualDistance = Math.hypot(target.x - mob.x, target.z - mob.z);
      const inAttackRange = definition.attackKind === "projectile"
        ? (rangedPursuit?.cornered || actualDistance >= definition.minimumAttackRange - 0.05) && actualDistance <= definition.stopDistance + 0.05
        : actualDistance <= definition.stopDistance + 0.05;
      if (waiting || (definition.attackKind === "melee" && meleeSlotsFull(target.id, attackers()))
        || !this.silverGuardVolley.canStart(mobId, now, now + windupMs)
        || !this.attackCoordination.canStart(mobId, target.id, mob, now, now + windupMs, (id, startedAt) => {
          const peer = this.state.mobs.get(id);
          return Boolean(peer?.alive && peer.attackStartedAt === startedAt && ["windup", "strike", "recover"].includes(peer.combatState));
        })
        || circling || rangedPursuit?.repositioning || !target.visible || !inAttackRange || Math.abs(target.y - mob.y) > 1.75 || now - lastAttackAt < definition.cooldownMs * rematchTiming.cooldown * huntTiming.cooldown
        || (definition.attackKind === "projectile" && [...this.pendingMobProjectiles.values()].some(shot => shot.mobId === mobId))
        || !hasCombatLineOfSight(mob, target, this.readWorldBlock)) continue;
      if (mobId === "frontier-brute" && !mob.isMiniBoss && mob.attackPattern !== "rocks") mob.attackPattern = frontierBrutePattern(mob.actionSequence);
      mob.combatState = "windup";
      this.silverGuardVolley.started(mobId, now + windupMs);
      this.crawlerPositioning.delete(mobId);
      if (definition.attackKind !== "projectile") this.spitterPositioning.delete(mobId);
      this.mobNavigation.set(mobId, createMobNavigationState());
      mob.stateUntil = now + windupMs;
      this.setMobAttackTimeline(mob, now, mob.stateUntil, mobId);
      this.attackCoordination.started(mobId, target.id, mob, now, mob.stateUntil);
      mob.targetId = target.id;
      mob.aimCommitted = false;
      const predicted = mob.isMiniBoss
        ? predictedMiniBossAim(mob, target, activeMovementInput(this.movementInputs.get(target.id), now),
          mob.archetype === "cave_spitter" ? .55 : mob.archetype === "stone_brute" ? .25 : .42)
        : { x: target.x, y: target.y, z: target.z, yaw: Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI };
      mob.yaw = predicted.yaw;
      this.mobCommittedAim.set(mobId, predicted);
      this.updateMobStrikeOrigin(mobId, mob);
    }
    for (const [sessionId, player] of this.state.players) {
      if (player.health <= 0) continue;
      player.dangerTier = dangerBandAt(player).tier;
      if (player.defending) {
        player.stamina = Math.max(0, player.stamina - guardStaminaCost(GUARD_STAMINA_DRAIN_PER_SECOND, player.equippedTrait as TraitId) * deltaTime);
        if (player.stamina <= 0) player.defending = false;
      } else if (now >= (this.dodgePressure.get(sessionId)?.exhaustedUntil ?? 0)) {
        const rootstalkerRecovery = player.armourId === "rootstalker_wrap" ? 5 : 0;
        player.stamina = Math.min(player.maxStamina, player.stamina + (staminaRecoveryWithMomentum(18, player.momentumStacks, player.equippedTrait as TraitId) + rootstalkerRecovery) * deltaTime);
      }
      if (this.movementPilotControllers.has(sessionId)) continue;
      const input = activeMovementInput(this.movementInputs.get(sessionId), now, player.yaw);
      const inputLength = Math.hypot(input.strafe, input.forward);
      const scale = inputLength > 1 ? 1 / inputLength : 1;
      const speed = movementSpeedWithMomentum(player.defending ? 2.1 : 4.2, player.momentumStacks, player.equippedTrait as TraitId)
        * armourStats(player.armourId).speed * progressionSpeedMultiplier(player);
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
    const previous = this.dodgePressure.get(client.sessionId);
    if (now < (previous?.exhaustedUntil ?? 0)) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "rate" });
    const chain = previous ? nextDodgeChain(previous.chain, previous.lastAt, now) : 0;
    const cost = dodgeChainStaminaCost(chain);
    if (player.stamina < cost) return this.reject(client, { requestId: parsed.data.requestId, action: "dodge", reason: "stamina" });
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
    player.stamina -= cost;
    player.invulnerableUntil = now + 320;
    const exhaustedUntil = chain >= 1 ? now + DODGE_EXHAUSTION_MS : 0;
    this.dodgePressure.set(client.sessionId, { chain, lastAt: now, exhaustedUntil });
    this.activeDodgeWindows.set(client.sessionId, { startedAt: now, until: player.invulnerableUntil });
    client.send("dodge:pressure", {
      phase: exhaustedUntil > now ? "exhausted" : "dodge", cost, chain, exhaustedUntil, counterUntil: 0, staminaRestored: 0,
    } satisfies DodgePressureUpdate);
    player.dodgeSequence += 1;
    this.lastDodgeAt.set(client.sessionId, now);
    if (exhaustedUntil > now && parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "thief"
      && this.buildPathRankFor(player, "thief") >= 2) {
      let diverted = 0;
      const trickster = this.buildSpecializationFor(player, "thief") === "trickster";
      for (const [mobId, awareness] of this.mobAwareness) if (awareness.targetId === client.sessionId) {
        const mob = this.state.mobs.get(mobId);
        if (mob && Math.hypot(mob.x - player.x, mob.z - player.z) <= (trickster ? 8 : 6)) {
          this.mobAwareness.delete(mobId); mob.targetId = ""; mob.awarenessState = "search"; diverted += 1;
          if (trickster && this.buildSpecializationMastered(player, "trickster")) this.staggerMob(mobId, mob, now, 700, true);
        }
      }
      if (diverted > 0) this.buildPathProc(client.sessionId, "thief", "SMOKE DECOY", `${diverted} ENEM${diverted === 1 ? "Y" : "IES"} DIVERTED`);
      if (diverted > 0) this.pathConcealedUntil.set(client.sessionId,
        now + (trickster ? 1_500 : 900) + this.equipmentAffixTier(player, "deceptive") * 200);
      if (trickster && diverted > 0) this.grantMasterTrial(client.sessionId, "trickster", diverted);
    }
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
    const equipped = player.equippedPower === powerId || milestoneUnlocked(player.level, "second_power") && player.equippedPowerSecondary === powerId;
    if (!definition || !equipped) {
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
    const mageRank = parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "mage" ? this.buildPathRankFor(player, "mage") : 0;
    player.powerCooldownUntil = now + Math.round(definition.cooldownMs * (1 - Math.min(.2, mageRank * .05)));
    player.powerCastStartedAt = now;
    player.activePower = powerId;
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
    if (parsed.data.specialId === "venom_fan") {
      if (player.mainHandId !== "venom_focus" || (player.inventory.get("venom_focus")?.quantity ?? 0) <= 0 || parsed.data.target)
        return this.reject(client, { requestId: parsed.data.requestId, action: "special", reason: "compatibility" });
      const fan = SPECIAL_DEFINITIONS.venom_fan;
      player.specialCooldownUntil = now + fan.cooldownMs;
      player.attackStep = 1; player.actionSequence++;
      for (const offset of fan.offsets) {
        const yaw = (parsed.data.yaw + offset) * Math.PI / 180;
        const endpoint = { x: player.x + Math.sin(yaw) * fan.range, y: player.y, z: player.z + Math.cos(yaw) * fan.range };
        const start = { x: player.x, y: player.y + 1.05, z: player.z }, end = bodyPoint(endpoint);
        const projectileId = `venom:${client.sessionId}:${++this.weaponProjectileSequence}`;
        this.pendingWeaponProjectiles.set(projectileId, { requestId: parsed.data.requestId, mainHandId: "venom_focus", step: 1, yaw: parsed.data.yaw + offset,
          impactAt: now + fan.travelMs, projectileId, attackerId: client.sessionId, start, end, position: start, startedAt: now });
        this.broadcast("combat:projectile", { projectileId, attackerId: client.sessionId, mainHandId: "venom_focus", x: player.x, y: player.y, z: player.z,
          targetX: endpoint.x, targetY: endpoint.y, targetZ: endpoint.z, travelMs: fan.travelMs, releasedAt: now } satisfies WeaponAttackReleased);
      }
      return;
    }
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
    if (player.mainHandId === "venom_focus") return this.reject(client, { requestId: parsed.data.requestId, action: "loadout", reason: "compatibility" });
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
    const slot = parsed.data.slot ?? "primary";
    if (slot === "secondary" && !milestoneUnlocked(player.level, "second_power")) {
      return this.reject(client, { requestId: parsed.data.requestId, action: "power", reason: "missing" });
    }
    if (slot === "secondary") player.equippedPowerSecondary = parsed.data.powerId;
    else player.equippedPower = parsed.data.powerId;
    void this.persistPlayer(client.sessionId, player);
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
    if (mainHand.id === "venom_focus") player.equippedSpecial = "venom_fan";
    else if (player.equippedSpecial === "venom_fan") player.equippedSpecial = "hunters_mark";
    this.attackChains.delete(client.sessionId);
    player.equippedPower = compatiblePowerOrFallback(player.equippedPower, mainHand.tag);
    player.equippedPowerSecondary = compatiblePowerOrFallback(player.equippedPowerSecondary, mainHand.tag);
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
      const mageRank = parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "mage" ? this.buildPathRankFor(player, "mage") : 0;
      const buildState = parseBuildPathState(player.huntLoadoutsJson);
      const mageOverloadAugment = selectedCallingAugment(buildState, "mage_overload");
      const mageOverloadBonus = this.mageOverloadReady.has(sessionId)
        ? (mageRank >= 4 ? 4 : 3) + (mageOverloadAugment === "overload_volatile_core" ? 2 : 0) : 0;
      const mageCastCount = mageRank >= 2 ? (this.magePowerCasts.get(sessionId) ?? 0) + 1 : 0;
      if (mageRank >= 2) this.magePowerCasts.set(sessionId, mageCastCount % 3);
      const arcaneEcho = mageRank >= 2 && mageCastCount % 3 === 0;
      const shadowstepActive = now <= (this.assassinShadowUntil.get(sessionId) ?? 0);
      const mageSpecialization = this.buildSpecializationFor(player, "mage");
      const assassinSpecialization = this.buildSpecializationFor(player, "assassin");
      let shadowstepReady = shadowstepActive;
      let shadowstepAppliedDamage = 0;
      let arcaneEchoDamage = 0;
      const rootbound = player.mainHandId === "rootbound_hammer" && definition.core === "line";
      const rootDurationMs = rootbound ? 700 : 0;
      for (const target of targets) {
        const mob = this.state.mobs.get(target.id);
        if (!mob || !mob.alive || !hasCombatLineOfSight(impactCenter, mob, this.readWorldBlock)) continue;
        const mark = this.specialMarks.get(sessionId);
        const payoff = huntersMarkPowerPayoff(mark, target.id, now);
        if (mark && now >= mark.expiresAt) this.specialMarks.delete(sessionId);
        if (payoff.consumed) {
          this.specialMarks.delete(sessionId);
          if (selectedCallingAbility(parseBuildPathState(player.huntLoadoutsJson), "assassin") === "assassin_death_mark")
            this.callingState(sessionId, "assassin", "assassin_death_mark", "TARGET EXPOSED", { clear: true });
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
        const shadowstepDamage = shadowstepReady ? (assassinSpecialization === "executioner" ? 4 : 2)
          + (this.assassinShadowBonus.get(sessionId) ?? 0)
          + this.equipmentAffixTier(player, "executioner") : 0;
        shadowstepAppliedDamage = Math.max(shadowstepAppliedDamage, shadowstepDamage);
        if (shadowstepReady) {
          shadowstepReady = false; this.assassinShadowUntil.delete(sessionId); this.assassinShadowBonus.delete(sessionId);
          const activeAbility = selectedCallingAbility(parseBuildPathState(player.huntLoadoutsJson), "assassin");
          if (activeAbility === "assassin_vanish" || activeAbility === "assassin_blade_dance")
            this.callingState(sessionId, "assassin", activeAbility, "EMPOWERED STRIKE", { clear: true });
        }
        const echoStrength = Math.min(1, (mageSpecialization === "arcanist"
          ? this.buildSpecializationMastered(player, "arcanist") ? 1 : .75 : .5)
          + this.equipmentAffixTier(player, "echoing") * .08);
        const echoDamage = arcaneEcho ? damageAfterArmor(Math.max(1, Math.ceil(definition.damage * echoStrength)), mob.armor, true) : 0;
        arcaneEchoDamage = Math.max(arcaneEchoDamage, echoDamage);
        const damage = damageAfterArmor(definition.damage + payoff.bonusDamage + progressionAttackBonus(player) + mageOverloadBonus
          + this.buildPathDamageBonus(player, mob, target.id, sessionId, now, "power") + shadowstepDamage, mob.armor, true)
          + traitBonusDamage + echoDamage + (mageRank > 0 ? this.equipmentAffixTier(player, "volatile") : 0);
        const aftershock = pending.powerId === "seismic_cleave"
          && isSeismicAftershockTarget(impactCenter, pending.yaw, mob, resolvedRange);
        if (aftershock) aftershockHitCount += 1;
        resolvedDamage = Math.max(resolvedDamage, damage);
        this.combatContributions.record(target.id, sessionId, Math.min(mob.health, damage), now);
        mob.health = Math.max(0, mob.health - damage);
        if (mob.health > 0 && mageSpecialization === "elementalist") {
          const mastered = this.buildSpecializationMastered(player, "elementalist");
          const elementalTier = this.equipmentAffixTier(player, "elemental");
          const slowMs = (mastered ? 3_000 : 2_000) + elementalTier * 250;
          this.rangerSlows.set(target.id, { until: now + slowMs, multiplier: Math.max(.48, (mastered ? .58 : .78) - elementalTier * .05) });
          this.masterTrialMobTags.set(target.id, { playerId: sessionId, specializationId: "elementalist", until: now + slowMs });
        }
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
          if (payoff.consumed) this.grantCallingTrial(sessionId, "mark_open_wound", 1);
          if (shadowstepDamage > 0 && assassinSpecialization === "executioner") {
            this.grantMasterTrial(sessionId, "executioner");
            if (this.buildSpecializationMastered(player, "executioner")) player.stamina = Math.min(player.maxStamina, player.stamina + 20);
          }
          this.defeatMob(target.id, mob, sessionId, now);
          defeatedMobIds.push(target.id);
          const consumed = consumedMarks.find(mark => mark.mobId === target.id);
          if (consumed) consumed.staggerMs = 0;
        } else {
          const duration = definition.staggerMs + payoff.staggerBonusMs + rootDurationMs
            + (aftershock ? SEISMIC_CLEAVE_UPGRADES.aftershockStaggerBonusMs : 0);
          const resistedDuration = Math.round(duration * (mob.archetype === "stone_brute" ? 0.65 : 1));
          const staggered = this.staggerMob(target.id, mob, now, resistedDuration);
          const consumed = consumedMarks.find(mark => mark.mobId === target.id);
          if (consumed) consumed.staggerMs = staggered ? resistedDuration : 0;
        }
      }
      if (arcaneEcho && targets.length > 0) {
        this.buildPathProc(sessionId, "mage", "ARCANE ECHO", `REPEATED · +${arcaneEchoDamage} DAMAGE`);
        if (mageSpecialization === "arcanist") this.grantMasterTrial(sessionId, "arcanist");
      }
      if (mageOverloadBonus > 0 && targets.length > 0) {
        this.grantCallingTrial(sessionId, "overload_volatile_core", mageOverloadBonus);
        this.grantCallingTrial(sessionId, "overload_residual_charge", 1);
        const charges = this.mageOverloadCharges.get(sessionId) ?? 1;
        if (charges <= 1) {
          this.mageOverloadReady.delete(sessionId); this.mageOverloadCharges.delete(sessionId);
          this.callingState(sessionId, "mage", "mage_overload", "POWER CHARGED", { clear: true });
        } else {
          this.mageOverloadCharges.set(sessionId, charges - 1);
          this.callingState(sessionId, "mage", "mage_overload", "POWER CHARGED", { charges: charges - 1 });
        }
        this.buildPathProc(sessionId, "mage", "OVERLOAD", `POWER AMPLIFIED · +${mageOverloadBonus} DAMAGE`);
      }
      if (shadowstepActive && !shadowstepReady)
        this.buildPathProc(sessionId, "assassin", assassinSpecialization === "executioner" ? "EXECUTIONER" : "SHADOWSTEP",
          `EMPOWERED STRIKE · +${shadowstepAppliedDamage} DAMAGE`);
      if (shadowstepActive && !shadowstepReady && selectedCallingAbility(buildState, "assassin") === "assassin_vanish")
        this.grantCallingTrial(sessionId, "vanish_killing_intent", 1);
      if (shadowstepActive && !shadowstepReady && assassinSpecialization === "phantom") this.grantMasterTrial(sessionId, "phantom");
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
        ...(rootbound ? { rootbound: true, rootDurationMs } : {}),
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
    const cacheWing = (Object.keys(SILVER_DEPTHS_WING_CACHES) as SilverDepthsWing[]).find(wing => {
      const cache = SILVER_DEPTHS_WING_CACHES[wing];
      return request.x === cache.x && request.y === cache.y && request.z === cache.z;
    });
    if (this.roomKind === "silver-depths" && cacheWing && (cacheWing !== this.silverDepthsWing
      || this.silverDepthsEncounterStage < 2 || this.silverDepthsCacheOpened
      || !this.silverDepthsRuns.has(client.sessionId)))
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "protected" });
    if (block === Block.MoonstoneOre && player.silverDepthsStage < 2 && this.roomKind !== "silver-depths")
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "protected" });
    const depthsRun = this.silverDepthsRuns.get(client.sessionId);
    if (block === Block.MoonstoneOre && (!depthsRun || depthsRun.completedAt > 0 || depthsRun.moonstoneCollected >= 1)) {
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "protected" });
    }
    const reason = miningRejectionReason(player, request, block, stored.revision);
    if (reason) return this.reject(client, { requestId: request.requestId, action: "mine", reason });
    const movement = this.movementInputs.get(client.sessionId)?.request;
    if (movement && Math.hypot(movement.strafe, movement.forward) > 0.01) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "moving" });
    if (!miningLineClear(player, request, this.readWorldBlock)) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "collision" });
    const mineral = minedMineral(block);
    if (mineral && !cacheWing && (player.inventory.get(mineral)?.quantity ?? 0) >= ironCapacity(player.blacksmithUpgrades)) {
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
    const cacheWing = (Object.keys(SILVER_DEPTHS_WING_CACHES) as SilverDepthsWing[]).find(wing => {
      const cache = SILVER_DEPTHS_WING_CACHES[wing];
      return request.x === cache.x && request.y === cache.y && request.z === cache.z;
    });
    if (this.roomKind === "silver-depths" && cacheWing && (cacheWing !== this.silverDepthsWing
      || this.silverDepthsEncounterStage < 2 || this.silverDepthsCacheOpened
      || !this.silverDepthsRuns.has(client.sessionId)))
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "protected" });
    const depthsRun = this.silverDepthsRuns.get(client.sessionId);
    if (current === Block.MoonstoneOre && (!depthsRun || depthsRun.completedAt > 0 || depthsRun.moonstoneCollected >= 1)) {
      return this.reject(client, { requestId: request.requestId, action: "mine", reason: "protected" });
    }
    const rejection = miningRejectionReason(player, request, current, stored.revision);
    if (rejection) return this.reject(client, { requestId: request.requestId, action: "mine", reason: rejection });
    if (!miningLineClear(player, request, this.readWorldBlock)) return this.reject(client, { requestId: request.requestId, action: "mine", reason: "collision" });
    const mineral = minedMineral(current);
    if (mineral) {
      const carried = player.inventory.get(mineral)?.quantity ?? 0;
      if (!cacheWing && carried >= ironCapacity(player.blacksmithUpgrades)) {
        client.send("resource:gathered", { itemId: mineral, quantity: 0, total: carried } satisfies ResourceGathered);
        return;
      }
    }
    setBlock(stored.chunk, address.localX, request.y, address.localZ, Block.Air);
    stored.revision += 1;
    if (this.roomKind !== "silver-depths" || !cacheWing) this.recordWorldDelta(request.x, request.y, request.z, Block.Air);
    const changed: BlockChanged = {
      requestId: request.requestId,
      x: request.x,
      y: request.y,
      z: request.z,
      block: Block.Air,
      revision: stored.revision,
    };
    this.broadcast("block:changed", changed);
    if (this.roomKind === "silver-depths" && cacheWing) this.openSilverDepthsCache();
    if (current === Block.MoonstoneOre && request.x === Math.floor(SILVER_DEPTHS_MOONSTONE_SEAL_POSITION.x)
      && request.y === 1 && request.z >= 10 && request.z <= 15) this.openSilverDepthsMoonstoneGate(request.requestId);
    if (mineral) this.broadcast("mineral:status", this.mineralStatus());
    if (mineral) {
      let item = player.inventory.get(mineral);
      if (!item) {
        item = new InventoryItemState();
        player.inventory.set(mineral, item);
      }
      const before = item.quantity;
      item.quantity = Math.min(ironCapacity(player.blacksmithUpgrades), inventoryTotal(before,
        mineral === "moonstone" ? 1 : minedIronQuantity(player.blacksmithUpgrades) + progressionMiningBonus(player)));
      if (mineral === "moonstone") {
        const run = this.silverDepthsRuns.get(client.sessionId);
        if (run && run.completedAt === 0) {
          run.moonstoneCollected += item.quantity - before;
          player.silverDepthsRunStage = Math.max(player.silverDepthsRunStage, this.silverDepthsEncounterStage + 1);
        }
      }
      this.grantProgression(client.sessionId, mineral === "moonstone" ? 15 : 4, mineral === "moonstone" ? "Moonstone mined" : "Mineral mined");
      if (mineral === "silver_ore" && this.roomKind === "overworld" && isInMistfenMarsh(request.x, request.z))
        this.grantMistfenMastery(client.sessionId, 2);
      void this.persistPlayer(client.sessionId, player);
      client.send("resource:gathered", { itemId: mineral, quantity: item.quantity - before, total: item.quantity } satisfies ResourceGathered);
      let expeditionAdvanced = mineral === "iron_ore" && this.advanceFirstExpedition(client, "mined_iron");
      expeditionAdvanced = (mineral === "silver_ore" && this.advanceFirstExpedition(client, "mined_silver")) || expeditionAdvanced;
      expeditionAdvanced = (isBuriedVaultSeal(request.x, request.y, request.z) && this.advanceFirstExpedition(client, "breached_vault")) || expeditionAdvanced;
      expeditionAdvanced = (mineral === "moonstone" && this.advanceSilverDepthsExpedition(client, "mined_moonstone")) || expeditionAdvanced;
      if (expeditionAdvanced) this.sendObjectiveState(client, true);
    } else if (current === Block.OakLog) {
      let item = player.inventory.get("timber");
      if (!item) {
        item = new InventoryItemState();
        player.inventory.set("timber", item);
      }
      item.quantity = inventoryTotal(item.quantity, 1);
      if (this.roomKind === "overworld" && isInGreenwoodRegion(request.x, request.z)) this.grantGreenwoodMastery(client.sessionId, 2);
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
    if (usesRockVolley(mob.attackPattern)) {
      if (!mob.aimCommitted) { mob.attackStrikeX = mob.x; mob.attackStrikeY = mob.y; mob.attackStrikeZ = mob.z; }
      return;
    }
    if ((mob.isChampion || mob.isElite || mob.isMiniBoss) && mob.archetype === "cave_spitter") {
      if (mob.aimCommitted) return;
      const aim = this.mobCommittedAim.get(mobId);
      mob.attackStrikeX = mob.attackPattern === "pool" ? aim?.x ?? mob.x : mob.x;
      mob.attackStrikeY = mob.attackPattern === "pool" ? aim?.y ?? mob.y : mob.y;
      mob.attackStrikeZ = mob.attackPattern === "pool" ? aim?.z ?? mob.z : mob.z;
      return;
    }
    if (mob.isChampion && mob.attackPattern === "charge"
      || (mobId === "mistfen-behemoth" || mobId === MISTFEN_EVENT_ID || isMistfenEventFollower(mobId)) && mob.attackPattern === "bog-charge") {
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
    if (usesRockVolley(mob.attackPattern)) {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt;
      mob.attackRecoveryEndAt = releaseAt + BRUTE_VOLLEY.recoveryMs;
      return;
    }
    if ((mobId === CRYSTAL_MATRIARCH_ID || mobId === ASHGLASS_ORACLE_ID) && (mob.attackPattern === "crystal-burst" || mob.attackPattern === "teleport-burst")) {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt;
      mob.attackRecoveryEndAt = releaseAt + MATRIARCH_PHASE.crystalBurstRecoveryMs;
      return;
    }
    if ((mobId === WILDERNESS_EVENT_ID || mobId === CRYSTAL_MATRIARCH_ID || isRealmEventId(mobId) || isAreaMiniBoss(mobId)) && usesDoubleVolley(mob.attackPattern)) {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt + MATRIARCH_PHASE.volleyGapMs;
      mob.attackRecoveryEndAt = mob.attackContactEndAt + MATRIARCH_PHASE.recoveryMs;
      return;
    }
    if (mob.isChampion && mob.attackPattern === "charge"
      || (mobId === "mistfen-behemoth" || mobId === MISTFEN_EVENT_ID || isMistfenEventFollower(mobId)) && mob.attackPattern === "bog-charge") {
      mob.attackContactAt = releaseAt;
      mob.attackContactEndAt = releaseAt + CHAMPION_CHARGE.durationMs;
      mob.attackRecoveryEndAt = mob.attackContactEndAt + CHAMPION_CHARGE.recoveryMs;
      return;
    }
    if (mobId === "frontier-brute" || isAreaMiniBoss(mobId) && mob.archetype === "stone_brute" && mob.attackPattern === "smash") {
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
      if (id === "forest-guardian") {
        const cover = guardianCoverHit(start, charge.yaw, Math.max(travel, 1.5));
        if (cover) this.setGuardianCover(cover, true);
      }
      const next = moveChampionCharge(start, charge.yaw, travel, this.readWorldBlock,
        pose => this.mobPositionAllowed(pose) && this.championAllowed(id, pose) && !isInStoneBruteArena(pose.x, pose.z));
      mob.x = next.x; mob.y = next.y; mob.z = next.z; mob.yaw = charge.yaw;
      if (mob.isMiniBoss) this.damageMiniBossArenaCover(id, mob, .9);
      for (const [playerId, player] of this.state.players) {
        if (charge.hit.has(playerId) || player.health <= 0 || Math.abs(player.y - mob.y) > 1.1
          || !hasCombatLineOfSight(start, player, this.readWorldBlock)) continue;
        if (championChargeHits(start, next, player)) { charge.hit.add(playerId); this.damagePlayer(id, playerId, mob.attackDamage, now); }
        if (mob.combatState !== "strike") break;
      }
      charge.progress = progress;
      if (progress >= 1 || Math.hypot(next.x - start.x, next.z - start.z) < travel * .8) {
        this.championCharges.delete(id);
        if ((id === "mistfen-behemoth" || id === MISTFEN_EVENT_ID) && charge.hit.size === 0) {
          mob.combatState = "recover";
          mob.stateUntil = Math.max(mob.stateUntil, now + 2_500);
          mob.targetId = "";
          mob.aimCommitted = false;
          this.clearMobAttackTimeline(mob);
          for (const client of this.clients) {
            const player = this.state.players.get(client.sessionId);
            if (player?.health && Math.abs(player.y - mob.y) <= 2.5
              && Math.hypot(player.x - mob.x, player.z - mob.z) <= 28)
              client.send("leader:exposed", { mobId: id, durationMs: 2_500 } satisfies AreaLeaderExposed);
          }
        }
      }
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
        if (mob.isMiniBoss) this.damageMiniBossArenaCover(mobId, center,
          mob.attackPattern === "smash" ? 2.25 : BRUTE_SLAM.radius);
        if (mobId === "forest-guardian" && mob.attackPattern === "slam") this.placeGuardianRootLanes(mob, now);
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
        const endpoint = {
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
          releasedAt: now,
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

  private alertHitMob(mobId: string, sessionId: string, now: number, source?: { x: number; y?: number; z: number }): void {
    const player = this.state.players.get(sessionId);
    if (!player || player.health <= 0 || isInsideTownSafeZone(player)) return;
    const awareness = this.mobAwareness.get(mobId) ?? createMobAwareness();
    const mob = this.state.mobs.get(mobId);
    const visible = !!mob && hasCombatLineOfSight(mob, player, this.readWorldBlock);
    // A delayed hit reveals its launch location, not an unseen attacker's live location.
    const evidence = visible ? player : source ? { ...source, y: source.y ?? mob?.y ?? player.y }
      : awareness.lastSeen ?? mob ?? player;
    provokeMob(awareness, { id: sessionId, x: evidence.x, y: evidence.y, z: evidence.z, health: player.health }, now);
    this.mobAwareness.set(mobId, awareness);
    if (mob) { mob.alertUntil = now + 900; mob.awarenessState = visible ? "engaged" : "search"; }
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
      const dodgeCounterBonus = now <= (this.dodgeCounterUntil.get(sessionId) ?? 0) ? 1 : 0;
      if (dodgeCounterBonus > 0) this.dodgeCounterUntil.delete(sessionId);
      const traitBonusDamage = executionerDamageBonus(player.equippedTrait as TraitId, mob, { comboStep: pending.step });
      let perk: EquipmentPerkId | undefined;
      let perkStacks: number | undefined;
      let perkBonusDamage = 0;
      const huntSet = huntSetForLoadout(pending.mainHandId, player.armourId);
      const huntSetPerk = huntSet ? equipmentPerkStats(player.armourId,
        equipmentReforgeRank(player.reforgeRanksJson, player.armourId)) : null;
      let setBonus: HuntSetId | undefined;
      let setBonusDamage = 0;
      let staminaRestored = 0;
      let cooldownReducedMs = 0;
      if (pending.mainHandId === "venom_focus") {
        const venom = equipmentPerkStats("venom_focus", equipmentReforgeRank(player.reforgeRanksJson, "venom_focus"))!;
        const key = `${sessionId}:${mobId}`;
        const previous = this.venomBuildup.get(key);
        const stacks = now <= (previous?.expiresAt ?? 0) ? previous!.stacks + 1 : 1;
        if (stacks >= (venom.stacks ?? 3)) {
          perk = "venom_bloom"; perkStacks = 0; perkBonusDamage = venom.damage ?? 2;
          this.venomBuildup.delete(key);
        } else {
          perkStacks = stacks;
          this.venomBuildup.set(key, { stacks, expiresAt: now + (venom.windowMs ?? 4_000) });
        }
      }
      if (pending.mainHandId === "fang_dagger" && pending.step === 3 && (player.inventory.get("alpha_forgemark")?.quantity ?? 0) > 0) {
        perk = "alpha_finish"; perkBonusDamage += 1;
      } else if (pending.mainHandId === "acid_gland_focus" && player.actionSequence % 3 === 0
        && (player.inventory.get("venom_forgemark")?.quantity ?? 0) > 0) {
        perk = "venom_surge"; perkBonusDamage += 1;
      } else if (pending.mainHandId === "stone_core_hammer" && mob.combatState === "stagger"
        && (player.inventory.get("crusher_forgemark")?.quantity ?? 0) > 0) {
        perk = "crusher_break"; perkBonusDamage += 1;
      }
      const struckStaggered = mob.combatState === "stagger";
      if (huntSet === "fang" && pending.step === 3) {
        setBonus = "fang";
        staminaRestored = Math.min(huntSetPerk?.stamina ?? 12, player.maxStamina - player.stamina);
        player.stamina += staminaRestored;
        if (mob.health <= Math.ceil(mob.maxHealth * .3)) setBonusDamage = huntSetPerk?.damage ?? 2;
      } else if (huntSet === "venom") {
        const buildup = (this.venomSetBuildup.get(sessionId) ?? 0) + 1;
        this.venomSetBuildup.set(sessionId, buildup >= 3 ? 0 : buildup);
        if (buildup >= 3) {
          setBonus = "venom";
          cooldownReducedMs = Math.min(huntSetPerk?.cooldownMs ?? 1_500, Math.max(0, player.specialCooldownUntil - now));
          player.specialCooldownUntil = Math.max(now, player.specialCooldownUntil - cooldownReducedMs);
        }
      } else if (huntSet === "crusher" && struckStaggered) {
        setBonus = "crusher"; setBonusDamage = 1;
        this.crusherSetGuardUntil.set(sessionId, now + (huntSetPerk?.durationMs ?? 3_000));
      }
      const assassinSpecialization = this.buildSpecializationFor(player, "assassin");
      const shadowstepDamage = now <= (this.assassinShadowUntil.get(sessionId) ?? 0)
        ? (assassinSpecialization === "executioner" ? 4 : 2)
          + (this.assassinShadowBonus.get(sessionId) ?? 0)
          + this.equipmentAffixTier(player, "executioner") : 0;
      if (shadowstepDamage > 0) {
        this.assassinShadowUntil.delete(sessionId); this.assassinShadowBonus.delete(sessionId);
        const activeAbility = selectedCallingAbility(parseBuildPathState(player.huntLoadoutsJson), "assassin");
        if (activeAbility === "assassin_vanish" || activeAbility === "assassin_blade_dance")
          this.callingState(sessionId, "assassin", activeAbility, "EMPOWERED STRIKE", { clear: true });
      }
      const rangerActive = player.mainHandTag === "ranged"
        && parseBuildPathState(player.huntLoadoutsJson).selectedPathId === "ranger" && this.buildPathRankFor(player, "ranger") >= 2;
      const previousPin = rangerActive ? this.rangerPinning.get(sessionId) : undefined;
      const pinStacks = rangerActive ? previousPin?.mobId === mobId && now <= previousPin.expiresAt ? previousPin.stacks + 1 : 1 : 0;
      const rangerSpecialization = this.buildSpecializationFor(player, "ranger");
      const pinBonusDamage = pinStacks >= 3 && rangerSpecialization === "marksman"
        ? (this.buildSpecializationMastered(player, "marksman") ? 4 : 2) + this.equipmentAffixTier(player, "precise") : 0;
      const damage = damageAfterArmor(
        timing.damage + ironSwordDamageBonus(player.blacksmithUpgrades, pending.mainHandId)
          + reforgeWeaponDamageBonus(equipmentReforgeRank(player.reforgeRanksJson, pending.mainHandId))
          + progressionAttackBonus(player) + this.specialDamageBonus(sessionId, mobId, now) + perkBonusDamage + setBonusDamage
          + this.buildPathDamageBonus(player, mob, mobId, sessionId, now, "weapon") + shadowstepDamage + pinBonusDamage,
        mob.armor,
      ) + traitBonusDamage + dodgeCounterBonus;
      this.combatContributions.record(mobId, sessionId, Math.min(mob.health, damage), now);
      mob.health = Math.max(0, mob.health - damage);
      if (shadowstepDamage > 0 && assassinSpecialization === "phantom") this.grantMasterTrial(sessionId, "phantom");
      if (mob.health === 0 && shadowstepDamage > 0 && assassinSpecialization === "executioner") {
        this.grantMasterTrial(sessionId, "executioner");
        if (this.buildSpecializationMastered(player, "executioner")) player.stamina = Math.min(player.maxStamina, player.stamina + 20);
      }
      if (mob.health === 0 && pinStacks >= 3 && rangerSpecialization === "marksman") this.grantMasterTrial(sessionId, "marksman");
      if (shadowstepDamage > 0) this.buildPathProc(sessionId, "assassin", assassinSpecialization === "executioner" ? "EXECUTIONER" : "SHADOWSTEP",
        `EMPOWERED STRIKE · +${shadowstepDamage} DAMAGE`);
      if (shadowstepDamage > 0 && selectedCallingAbility(parseBuildPathState(player.huntLoadoutsJson), "assassin") === "assassin_vanish")
        this.grantCallingTrial(sessionId, "vanish_killing_intent", 1);
      this.alertHitMob(mobId, sessionId, now, source);
      mob.hitSequence += 1;
      player.momentumStacks = gainMomentum(player.momentumStacks, player.equippedTrait as TraitId);
      const staggerDuration = basicStaggerDuration(pending.mainHandId, pending.step, mob.archetype, mob.combatState, mob.isChampion);
      if (this.staggerMob(mobId, mob, now, staggerDuration)) {
        const stagger: CombatStagger = { attackerId: sessionId, mobId, durationMs: staggerDuration };
        this.broadcast("combat:stagger", stagger);
      }
      if (mob.health > 0 && rangerActive) {
        if (pinStacks >= 3) {
          const rootMs = rangerSpecialization === "trapper"
            ? (this.buildSpecializationMastered(player, "trapper") ? 2_500 : 1_800) + this.equipmentAffixTier(player, "snaring") * 200 : 1_000;
          this.rangerPinning.delete(sessionId); this.rangerSlows.delete(mobId);
          this.staggerMob(mobId, mob, now, rootMs, true);
          if (rangerSpecialization === "trapper") this.masterTrialMobTags.set(mobId,
            { playerId: sessionId, specializationId: "trapper", until: now + rootMs });
          this.buildPathProc(sessionId, "ranger", rangerSpecialization === "trapper" ? "TRAPPER" : "PINNING SHOT",
            `ROOTED · ${(rootMs / 1_000).toFixed(1)}s${pinBonusDamage ? " · +2 DAMAGE" : ""}`);
        } else {
          this.rangerPinning.set(sessionId, { mobId, stacks: pinStacks, expiresAt: now + 4_000 });
          const snaringTier = this.equipmentAffixTier(player, "snaring");
          this.rangerSlows.set(mobId, { until: now + 1_800 + snaringTier * 200,
            multiplier: Math.max(.5, (rangerSpecialization === "trapper" ? .58 : .72) - snaringTier * .04) });
          this.buildPathProc(sessionId, "ranger", "PINNING SHOT", `${pinStacks} / 3 · TARGET SLOWED`);
        }
      }
      const rootShockwave = pending.mainHandId === "rootbound_hammer" && pending.step === 3;
      if (rootShockwave) this.applyRootboundShockwave(sessionId, mobId, mob, now);
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
        dodgeCounterBonus,
        rootShockwave,
        perk,
        perkStacks,
        setBonus,
        setBonusDamage,
        staminaRestored,
        cooldownReducedMs,
      };
      this.broadcast("combat:hit", hit);
      if (setBonus === "venom") this.createVenomSetPool(sessionId, mob, now);
      if (setBonus === "crusher") {
        this.applyEquipmentAreaDamage(sessionId, mobId, mob, now, pending.mainHandId, pending.step,
          huntSetPerk?.radius ?? 2.6, huntSetPerk?.damage ?? 1, "crusher_set");
      }
      if (mob.alive) this.progressSpecialMark(sessionId, mobId, now);
      const equipmentRank = equipmentReforgeRank(player.reforgeRanksJson, pending.mainHandId);
      if (pending.mainHandId === "stone_core_hammer") {
        const quake = equipmentPerkStats("stone_core_hammer", equipmentRank)!;
        this.applyEquipmentAreaDamage(sessionId, mobId, mob, now, pending.mainHandId, pending.step,
          quake.radius!, quake.damage!, "core_quake");
      } else if (pending.mainHandId === "matriarch_edge" && pending.step === 3) {
        const arc = equipmentPerkStats("matriarch_edge", equipmentRank)!;
        this.applyEquipmentAreaDamage(sessionId, mobId, mob, now, pending.mainHandId, pending.step,
          arc.radius!, arc.damage!, "moon_arc");
      } else if (pending.mainHandId === "echo_prism") {
        const chain = equipmentPerkStats("echo_prism", equipmentRank)!;
        this.applyEquipmentAreaDamage(sessionId, mobId, mob, now, pending.mainHandId, pending.step,
          chain.radius!, chain.damage!, "echo_chain", 1);
      }
  }

  private applyEquipmentAreaDamage(sessionId: string, primaryMobId: string, origin: MobState, now: number,
    mainHandId: MainHandId, comboStep: number, radius: number, baseDamage: number, perk: EquipmentPerkId,
    limit = Number.POSITIVE_INFINITY): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const nearby = [...this.state.mobs.entries()]
      .filter(([id, mob]) => id !== primaryMobId && mob.alive && mob.health > 0 && Math.abs(mob.y - origin.y) <= 2.25
        && Math.hypot(mob.x - origin.x, mob.z - origin.z) <= radius
        && hasCombatLineOfSight(origin, mob, this.readWorldBlock))
      .sort((a, b) => Math.hypot(a[1].x - origin.x, a[1].z - origin.z) - Math.hypot(b[1].x - origin.x, b[1].z - origin.z))
      .slice(0, limit);
    for (const [mobId, mob] of nearby) {
      const damage = damageAfterArmor(baseDamage, mob.armor);
      this.combatContributions.record(mobId, sessionId, Math.min(mob.health, damage), now);
      mob.health = Math.max(0, mob.health - damage);
      this.alertHitMob(mobId, sessionId, now, { x: origin.x, z: origin.z });
      mob.hitSequence += 1;
      if (mob.health === 0) this.defeatMob(mobId, mob, sessionId, now);
      this.broadcast("combat:hit", { attackerId: sessionId, mainHandId, mobId, damage, health: mob.health,
        defeated: !mob.alive, comboStep, knockback: 0, momentumStacks: player.momentumStacks,
        secondary: true, perk } satisfies CombatHit);
    }
  }

  private applyRootboundShockwave(sessionId: string, primaryMobId: string, origin: MobState, now: number): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;
    const perk = equipmentPerkStats("rootbound_hammer", equipmentReforgeRank(player.reforgeRanksJson, "rootbound_hammer"))!;
    for (const [mobId, mob] of this.state.mobs) {
      if (mobId === primaryMobId || !mob.alive || mob.health <= 0 || Math.abs(mob.y - origin.y) > 2.25) continue;
      if (Math.hypot(mob.x - origin.x, mob.z - origin.z) > perk.radius!) continue;
      if (!hasCombatLineOfSight(origin, mob, this.readWorldBlock)) continue;
      const damage = damageAfterArmor(perk.damage!, mob.armor);
      this.combatContributions.record(mobId, sessionId, Math.min(mob.health, damage), now);
      mob.health = Math.max(0, mob.health - damage);
      this.alertHitMob(mobId, sessionId, now, { x: origin.x, z: origin.z });
      mob.hitSequence += 1;
      if (this.staggerMob(mobId, mob, now, perk.durationMs!, true)) {
        this.broadcast("combat:stagger", { attackerId: sessionId, mobId, durationMs: perk.durationMs! } satisfies CombatStagger);
      }
      if (mob.health === 0) this.defeatMob(mobId, mob, sessionId, now);
      this.broadcast("combat:hit", {
        attackerId: sessionId,
        mainHandId: "rootbound_hammer",
        mobId,
        damage,
        health: mob.health,
        defeated: !mob.alive,
        comboStep: 3,
        knockback: 0,
        momentumStacks: player.momentumStacks,
        secondary: true,
        perk: "rootfall",
      } satisfies CombatHit);
    }
  }
}
