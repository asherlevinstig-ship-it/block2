import { Client, Room } from "@colyseus/core";
import {
  AttackRequestSchema,
  playerMeleeStrike,
  mobMeleeStrike,
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
  type WorldObjectiveCompleted,
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
import { dodgeDirection, isInsideImpact, maintainRangedDistance, pursueTarget, selectAggroTarget } from "./combat-rules.js";
import { GUARD_MINIMUM_STAMINA, GUARD_STAMINA_DRAIN_PER_SECOND, PARRY_STAGGER_MS, isAttackInGuardArc, resolveDefense } from "./defense-rules.js";
import { MOB_ARCHETYPES, damageAfterArmor, defeatReward, mobArchetype, type MobArchetypeId } from "./mob-archetypes.js";
import { MOB_TOWN_MINIMUM_RADIUS, dangerBandAt, isInsideTownSafeZone, keepMobOutsideTown, radiusFromSafeCenter, scaledMobStats } from "./radial-difficulty.js";
import { executionerDamageBonus, gainMomentum, guardStaminaCost, momentumAfterDefense, movementSpeedWithMomentum, parryStaminaRestore, staminaRecoveryWithMomentum } from "./trait-rules.js";
import { compatiblePowerOrFallback, fracturedBlockResult, isGroundPowerTargetInRange, isPowerCompatible, isSeismicAftershockTarget, mobilityAdvanceDistance, powerDirection, powerEvadeDirection, seismicCleaveProfile, selectBurstPowerTargets, selectGroundPowerTargets, selectLinePowerTargets, selectMobilityPowerTarget, widenedLineFractureColumns } from "./power-rules.js";
import { huntersMarkDamageBonus, huntersMarkPowerPayoff, isBrambleSnareTargetInRange, isInsideBrambleSnare, progressHuntersMark, selectHuntersMarkTarget, type ActiveSpecialMark } from "./special-rules.js";
import { inventoryTotal, isLootInPickupRange, lootForArchetype, LOOT_DESPAWN_MS } from "./loot-rules.js";
import { canEquipMainHand } from "./equipment-rules.js";
import { PLAYER_SAVE_HASH, applyPlayerSave, parsePlayerSave, serializePlayerSave } from "./player-save.js";
import { canStartTavernQuiz, doubledPayout, drawQuizQuestion, mustSettleQuiz, type QuizRound } from "./tavern-quiz.js";
import { canTradeAtBlacksmith, forgeBlacksmithUpgrade, ironCapacity, ironOreSale, ironSwordDamageBonus, minedIronQuantity, minedMineral, ownedBlacksmithUpgrades, ownsBlacksmithUpgrade } from "./blacksmith.js";
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
import { activeObjective, createObjectiveProgress, creditObjectiveDefeat, nextObjectiveTarget, type WorldObjectiveProgress } from "./world-objectives.js";
import { advanceMobGravity, createMobNavigationState, moveMobSafely, navigateMob, walkableMobSpawn, type MobNavigationState } from "./mob-navigation.js";
import { ENEMY_AIM_COMMIT_MS, STAGGER_IMMUNITY_MS, basicStaggerDuration, bodyPoint, flightPoint, hasCombatLineOfSight, projectileImpact, meleeSweepImpact } from "./combat-impact.js";

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
  private readonly pendingMobMelee = new Map<string, { targetId: string; yaw: number; impactAt: number; lastSweepAt?: number }>();
  private readonly pendingPowers = new Map<string, PendingPower>();
  private readonly specialMarks = new Map<string, ActiveSpecialMark>();
  private readonly brambleSnares = new Map<string, ActiveBrambleSnare>();
  private readonly lastMobAttackAt = new Map<string, number>();
  private readonly lastDodgeAt = new Map<string, number>();
  private readonly pendingMobProjectiles = new Map<string, PendingMobProjectile>();
  private readonly pendingWeaponProjectiles = new Map<string, PendingWeaponProjectile>();
  private readonly mobCommittedAim = new Map<string, { x: number; y: number; z: number; yaw: number }>();
  private readonly mobStaggerImmuneUntil = new Map<string, number>();
  private readonly mobHazards = new Map<string, ActiveMobHazard>();
  private readonly mobHomes = new Map<string, { x: number; y: number; z: number }>();
  private readonly mobVerticalVelocities = new Map<string, number>();
  private readonly mobNavigation = new Map<string, MobNavigationState>();
  private readonly profileTokens = new Map<string, string>();
  private readonly profileSaveFingerprints = new Map<string, string>();
  private readonly profileSaveQueues = new Map<string, Promise<void>>();
  private readonly quizRounds = new Map<string, QuizRound>();
  private readonly objectiveProgress = new Map<string, WorldObjectiveProgress>();
  private readonly worldDeltasByChunk = new Map<string, Map<string, WorldBlockDelta>>();
  private readonly pendingWorldDeltaWrites = new Map<string, BlockId>();
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
      for (const delta of storedDeltas) this.indexWorldDelta(delta);
    } catch (error) {
      console.warn("Persistent terrain could not be loaded; using the generated world for this room.", error);
    }
    this.setState(new WorldState());
    this.registerMob("moss-crawler", "moss_crawler", MOB_ARCHETYPES.moss_crawler.spawn);
    this.registerMob("greenwood-briar", "briar_crawler", MOB_ARCHETYPES.briar_crawler.spawn);
    this.registerMob("greenwood-briar-north", "briar_crawler", { x: 43.5, y: 8, z: 23.5 });
    this.registerMob("stone-brute", "stone_brute", MOB_ARCHETYPES.stone_brute.spawn);
    this.registerMob("cave-spitter", "cave_spitter", MOB_ARCHETYPES.cave_spitter.spawn);
    this.registerMob("wild-crawler", "moss_crawler", { x: 39.5, y: 8, z: 18.5 });
    this.registerMob("frontier-crawler", "moss_crawler", { x: 40.5, y: 8, z: 35.5 });
    this.registerMob("frontier-brute", "stone_brute", { x: 43.5, y: 8, z: 41.5 });
    this.registerMob("frontier-spitter", "cave_spitter", { x: 43.5, y: 8, z: -4.5 });
    this.onMessage("world:ready", client => client.send("world:bootstrap", this.bootstrapPayload()));
    this.onMessage("world:chunks", (client, payload) => this.handleChunkRegionRequest(client, payload));
    this.onMessage("objective:sync", client => this.sendObjectiveState(client));
    this.onMessage("ping", (client, payload: unknown) => {
      if (typeof payload === "object" && payload && "id" in payload && typeof payload.id === "string") {
        client.send("pong", { id: payload.id });
      }
    });
    this.onMessage("move", (client, payload) => this.handleMove(client, payload));
    this.onMessage("mine", (client, payload) => this.handleMine(client, payload));
    this.onMessage("attack", (client, payload) => this.handleAttack(client, payload));
    this.onMessage("dodge", (client, payload) => this.handleDodge(client, payload));
    this.onMessage("defense", (client, payload) => this.handleDefense(client, payload));
    this.onMessage("power", (client, payload) => this.handlePower(client, payload));
    this.onMessage("power:cancel", (client, payload) => this.handlePowerCancel(client, payload));
    this.onMessage("power:equip", (client, payload) => this.handlePowerEquip(client, payload));
    this.onMessage("power:seismic-mastery", (client, payload) => this.handleSeismicMasteryEquip(client, payload));
    this.onMessage("special", (client, payload) => this.handleSpecial(client, payload));
    this.onMessage("special:equip", (client, payload) => this.handleSpecialEquip(client, payload));
    this.onMessage("main-hand:equip", (client, payload) => this.handleMainHandEquip(client, payload));
    this.onMessage("trait:equip", (client, payload) => this.handleTraitEquip(client, payload));
    this.onMessage("quiz:sync", client => this.sendQuizState(client));
    this.onMessage("quiz:start", (client, payload) => this.handleQuizStart(client, payload));
    this.onMessage("quiz:answer", (client, payload) => this.handleQuizAnswer(client, payload));
    this.onMessage("quiz:decision", (client, payload) => this.handleQuizDecision(client, payload));
    this.onMessage("blacksmith:sync", client => this.sendBlacksmithState(client));
    this.onMessage("blacksmith:sell", client => this.handleBlacksmithSell(client));
    this.onMessage("blacksmith:forge", (client, payload) => this.handleBlacksmithForge(client, payload));
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

  private sendBlacksmithState(client: Client, message = `Iron ore sells for ${IRON_ORE_GOLD_PRICE} gold each. Keep materials to forge equipment below.`, phase: BlacksmithUpdate["phase"] = "idle", sold = 0, goldGranted = 0, purchasedUpgradeId?: BlacksmithUpgradeId): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    client.send("blacksmith:update", {
      phase,
      ironOre: player.inventory.get("iron_ore")?.quantity ?? 0,
      ironCapacity: ironCapacity(player.blacksmithUpgrades),
      gold: player.coins,
      ownedUpgrades: ownedBlacksmithUpgrades(player.blacksmithUpgrades),
      sold,
      goldGranted,
      purchasedUpgradeId,
      message,
    } satisfies BlacksmithUpdate);
  }

  private handleBlacksmithSell(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (!canTradeAtBlacksmith(player)) return this.sendBlacksmithState(client, "Stand beside the blacksmith stall to trade.", "error");
    const ore = player.inventory.get("iron_ore");
    if (!ore?.quantity) return this.sendBlacksmithState(client, "You have no iron ore to sell. Mine iron ore underground first.", "error");
    const { sold, goldGranted } = ironOreSale(ore.quantity, player.coins);
    if (sold === 0) return this.sendBlacksmithState(client, "Your gold purse is full.", "error");
    ore.quantity -= sold;
    player.coins += goldGranted;
    void this.persistPlayer(client.sessionId, player);
    this.sendBlacksmithState(client, `Sold ${sold} iron ore for ${goldGranted} gold.`, "traded", sold, goldGranted);
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
    this.sendBlacksmithState(client, `${BLACKSMITH_UPGRADES[upgradeId].name} forged and equipped. ${BLACKSMITH_UPGRADES[upgradeId].description}.`, "purchased", 0, 0, upgradeId);
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
    const delta = { x, y, z, block } satisfies WorldBlockDelta;
    const field = worldDeltaField(x, y, z);
    this.indexWorldDelta(delta);
    this.pendingWorldDeltaWrites.set(field, block);
    this.lastWorldDeltaRetryAt = Date.now();
    void this.flushWorldDeltaWrites();
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

  private bootstrapPayload(): WorldBootstrap {
    const chunks: ChunkSnapshot[] = [];
    for (let chunkZ = -WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkZ <= WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkZ += 1) {
      for (let chunkX = -WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkX <= WORLD_BOOTSTRAP_CHUNK_RADIUS; chunkX += 1) {
        chunks.push(this.snapshot(chunkX, chunkZ));
      }
    }
    return {
      seed: this.worldSeed,
      chunkSize: CHUNK_SIZE,
      chunkHeight: CHUNK_HEIGHT,
      spawn: this.spawnPoint(),
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
    const home = walkableMobSpawn({ ...spawn, ...outside }, this.readWorldBlock, this.mobPositionAllowed);
    this.mobHomes.set(mobId, home);
    this.mobNavigation.set(mobId, createMobNavigationState());
    this.state.mobs.set(mobId, this.createMob(archetypeId, home));
  }

  private readonly mobPositionAllowed = (position: { x: number; z: number }): boolean =>
    radiusFromSafeCenter(position) >= MOB_TOWN_MINIMUM_RADIUS - 0.001;

  private moveNavigatingMob(mobId: string, mob: MobState, desired: { x: number; z: number },
    goal: { x: number; y: number; z: number }, now: number): void {
    const navigation = this.mobNavigation.get(mobId) ?? createMobNavigationState();
    this.mobNavigation.set(mobId, navigation);
    const next = navigateMob(mob, desired, goal, navigation, now, this.readWorldBlock, this.mobPositionAllowed);
    const dx = next.x - mob.x;
    const dz = next.z - mob.z;
    if (Math.hypot(dx, dz) > 0.0001) mob.yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    mob.x = next.x;
    mob.y = next.y;
    mob.z = next.z;
  }

  private displaceMob(mobId: string, mob: MobState, delta: { x: number; z: number }): void {
    const next = moveMobSafely(mob, delta, this.readWorldBlock, this.mobPositionAllowed);
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
    mob.combatState = "stagger";
    mob.stateUntil = now + duration;
    mob.targetId = "";
    mob.aimCommitted = false;
    mob.staggerSequence += 1;
    this.mobCommittedAim.delete(mobId);
    this.mobStaggerImmuneUntil.set(mobId, mob.stateUntil + STAGGER_IMMUNITY_MS);
    this.pendingMobMelee.delete(mobId);
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
    const definition = mobArchetype(mob.archetype);
    this.spawnLootDrops(mobId, mob, now);
    mob.alive = false;
    this.pendingMobMelee.delete(mobId);
    mob.respawnAt = now + definition.respawnMs;
    mob.combatState = "idle";
    mob.stateUntil = 0;
    mob.targetId = "";
    mob.aimCommitted = false;
    this.mobCommittedAim.delete(mobId);
    this.clearMarksForMob(mobId);
    this.progressWorldObjectives(mobId, mob, attackerId);
    const player = this.state.players.get(attackerId);
    if (!player) return;
    const reward = defeatReward(player.health, player.maxHealth, player.stamina, player.maxStamina, definition, mob.rewardMultiplier);
    player.health = reward.health;
    player.stamina = reward.stamina;
    const coinsBefore = player.coins;
    player.coins = Math.min(1_000_000, player.coins + 2);
    void this.persistPlayer(attackerId, player);
    this.broadcast("combat:reward", {
      playerId: attackerId,
      mobId,
      coinsGranted: player.coins - coinsBefore,
      healthRestored: reward.healthRestored,
      staminaRestored: reward.staminaRestored,
      health: player.health,
      stamina: Math.round(player.stamina),
    } satisfies CombatReward);
  }

  private sendObjectiveState(client: Client): void {
    const progress = this.objectiveProgress.get(client.sessionId);
    if (!progress) return;
    const objective = activeObjective(progress);
    const targetMobId = nextObjectiveTarget(progress);
    const target = this.state.mobs.get(targetMobId);
    const home = this.mobHomes.get(targetMobId);
    client.send("objective:update", {
      objectiveId: objective.id,
      title: objective.title,
      detail: objective.detail,
      tier: objective.tier,
      targetMobId,
      targetMobIds: [...objective.targetMobIds],
      completedMobIds: [...progress.completedMobIds],
      targetX: target?.x ?? home?.x ?? 8.5,
      targetY: target?.y ?? home?.y ?? 8,
      targetZ: target?.z ?? home?.z ?? 8.5,
    } satisfies WorldObjectiveUpdate);
  }

  private progressWorldObjectives(mobId: string, mob: MobState, attackerId: string): void {
    const participationRadius = 22;
    for (const [playerId, player] of this.state.players) {
      const distance = Math.hypot(player.x - mob.x, player.z - mob.z);
      if (playerId !== attackerId && distance > participationRadius) continue;
      const progress = this.objectiveProgress.get(playerId);
      if (!progress) continue;
      const completedBefore = progress.completedMobIds.size;
      const result = creditObjectiveDefeat(progress, mobId);
      const client = this.clients.find(candidate => candidate.sessionId === playerId);
      if (!result.completed) {
        if (progress.completedMobIds.size !== completedBefore && client) this.sendObjectiveState(client);
        continue;
      }
      const coinsBefore = player.coins;
      player.coins = Math.min(1_000_000, player.coins + result.completed.coins);
      client?.send("objective:completed", {
        objectiveId: result.completed.id,
        title: result.completed.title,
        rewardLabel: result.completed.rewardLabel,
        coinsGranted: player.coins - coinsBefore,
      } satisfies WorldObjectiveCompleted);
      if (client) this.sendObjectiveState(client);
      void this.persistPlayer(playerId, player);
    }
  }

  private spawnLootDrops(mobId: string, mob: MobState, now: number): void {
    const drops = lootForArchetype(mob.archetype as MobArchetypeId);
    for (const [index, entry] of drops.entries()) {
      const angle = (index / Math.max(1, drops.length)) * Math.PI * 2 + this.lootDropSequence * 0.7;
      const drop = new LootDropState();
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
      for (const [playerId, player] of this.state.players) {
        if (!isLootInPickupRange(player, drop)) continue;
        const itemId = drop.itemId as ItemId;
        let inventoryItem = player.inventory.get(itemId);
        const total = inventoryTotal(inventoryItem?.quantity, drop.quantity);
        if (!inventoryItem) {
          inventoryItem = new InventoryItemState();
          player.inventory.set(itemId, inventoryItem);
        }
        inventoryItem.quantity = total;
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

  private damagePlayer(mobId: string, playerId: string, damage: number, now: number, blockable = true): boolean {
    const player = this.state.players.get(playerId);
    if (!player || now < player.invulnerableUntil || isInsideTownSafeZone(player)) return false;
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
    const spawn = this.spawnPoint();
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.health = player.maxHealth;
    player.stamina = player.maxStamina;
    player.momentumStacks = 0;
    player.invulnerableUntil = now + 1500;
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
      mob.stateUntil = now + definition.recoverMs;
      mob.targetId = "";
    }
    return true;
  }

  private resolveMobProjectiles(now: number): void {
    for (const [projectileId, projectile] of this.pendingMobProjectiles) {
      const progress = Math.max(0, Math.min(1, (now - projectile.startedAt) / (projectile.impactAt - projectile.startedAt)));
      const next = flightPoint(projectile.start, projectile.end, progress);
      const targets = [...this.state.players.entries()]
        .filter(([, player]) => player.health > 0 && !isInsideTownSafeZone(player))
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
      const puddle = target ? { x: impact.x, y: target.y, z: impact.z }
        : { x: projectile.end.x, y: projectile.end.y - 0.08, z: projectile.end.z };
      const hazardId = `acid:${projectileId}`;
      const expiresAt = now + definition.hazardDurationMs;
      this.mobHazards.set(hazardId, {
        hazardId,
        mobId: projectile.mobId,
        ...puddle,
        radius: definition.hazardRadius,
        damage: projectile.damage,
        expiresAt,
        nextDamageAt: now + 700,
        lastDamageAt: new Map(),
      });
      this.broadcast("combat:mob-hazard", {
        hazardId,
        mobId: projectile.mobId,
        ...puddle,
        radius: definition.hazardRadius,
        expiresAt,
      } satisfies MobHazardPlaced);
      if (target && collision?.targetId) {
        this.damagePlayer(projectile.mobId, collision.targetId, projectile.damage, now);
      }
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
    const now = Date.now();
    if (this.pendingWorldDeltaWrites.size > 0 && now - this.lastWorldDeltaRetryAt >= 5_000) {
      this.lastWorldDeltaRetryAt = now;
      void this.flushWorldDeltaWrites();
    }
    this.resolvePendingPowers(now);
    this.resolvePendingAttacks(now);
    this.resolveMobMelee(now);
    this.resolveWeaponProjectiles(now);
    this.resolveBrambleSnares(now);
    this.resolveMobProjectiles(now);
    this.resolveMobHazards(now);
    for (const [mobId, mob] of this.state.mobs) {
      const definition = mobArchetype(mob.archetype);
      const home = this.mobHomes.get(mobId) ?? definition.spawn;
      if (!mob.alive && now >= mob.respawnAt) {
        const stats = scaledMobStats(definition, dangerBandAt(home));
        const spawn = walkableMobSpawn(home, this.readWorldBlock, this.mobPositionAllowed);
        mob.x = spawn.x;
        mob.y = spawn.y;
        mob.z = spawn.z;
        this.mobVerticalVelocities.set(mobId, 0);
        this.mobNavigation.set(mobId, createMobNavigationState());
        this.mobStaggerImmuneUntil.delete(mobId);
        this.mobCommittedAim.delete(mobId);
        mob.aimCommitted = false;
        mob.health = stats.maxHealth;
        mob.maxHealth = stats.maxHealth;
        mob.armor = stats.armor;
        mob.attackDamage = stats.damage;
        mob.speedMultiplier = stats.speedMultiplier;
        mob.rewardMultiplier = stats.rewardMultiplier;
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
      if (mob.combatState === "stagger" || mob.combatState === "recover") {
        if (now < mob.stateUntil) continue;
        mob.combatState = "idle";
        mob.stateUntil = 0;
      }
      if (mob.combatState === "windup") {
        const targetPlayer = this.state.players.get(mob.targetId);
        if (targetPlayer && now < mob.stateUntil - ENEMY_AIM_COMMIT_MS) {
          mob.yaw = Math.atan2(targetPlayer.x - mob.x, targetPlayer.z - mob.z) * 180 / Math.PI;
          this.mobCommittedAim.set(mobId, { x: targetPlayer.x, y: targetPlayer.y, z: targetPlayer.z, yaw: mob.yaw });
        }
        if (now >= mob.stateUntil - ENEMY_AIM_COMMIT_MS) mob.aimCommitted = true;
        if (now < mob.stateUntil) continue;
        const aim = this.mobCommittedAim.get(mobId) ?? { x: mob.x + Math.sin(mob.yaw * Math.PI / 180) * definition.stopDistance,
          y: mob.y, z: mob.z + Math.cos(mob.yaw * Math.PI / 180) * definition.stopDistance, yaw: mob.yaw };
        this.mobCommittedAim.delete(mobId);
        mob.aimCommitted = false;
        mob.combatState = "recover";
        mob.stateUntil = now + definition.recoverMs;
        mob.actionSequence += 1;
        this.lastMobAttackAt.set(mobId, now);
        if (!targetPlayer) continue;
        if (definition.attackKind === "projectile") {
          const projectileId = `${mobId}:${++this.mobProjectileSequence}`;
          const start = { x: mob.x, y: mob.y + 1.05, z: mob.z };
          const end = { x: aim.x, y: aim.y + 0.08, z: aim.z };
          const projectile: PendingMobProjectile = {
            projectileId,
            mobId,
            archetype: mob.archetype,
            damage: mob.attackDamage,
            start, end, position: start, startedAt: now,
            impactAt: now + definition.projectileTravelMs,
          };
          this.pendingMobProjectiles.set(projectileId, projectile);
          this.broadcast("combat:mob-projectile", {
            projectileId,
            mobId,
            x: mob.x,
            y: mob.y,
            z: mob.z,
            targetX: aim.x,
            targetY: aim.y,
            targetZ: aim.z,
            travelMs: definition.projectileTravelMs,
          } satisfies MobProjectileReleased);
          mob.targetId = "";
          continue;
        }
        const deltaX = aim.x - mob.x;
        const deltaZ = aim.z - mob.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance > 0.001) {
          const lungeDistance = Math.min(definition.lungeDistance, Math.max(0, distance - definition.stopDistance * 0.6));
          this.displaceMob(mobId, mob, {
            x: Math.sin(aim.yaw * Math.PI / 180) * lungeDistance, z: Math.cos(aim.yaw * Math.PI / 180) * lungeDistance,
          });
        }
        this.pendingMobMelee.set(mobId, { targetId: mob.targetId, yaw: aim.yaw,
          impactAt: now + (mob.archetype === "stone_brute" ? 280 : 150) });
        continue;
      }
      const players = [...this.state.players.entries()].map(([id, player]) => ({
        id,
        x: player.x,
        y: player.y,
        z: player.z,
        health: player.health,
      })).filter(player => !isInsideTownSafeZone(player) && radiusFromSafeCenter(player) >= MOB_TOWN_MINIMUM_RADIUS);
      const target = selectAggroTarget(mob, players, definition.aggroRange);
      if (!target) {
        const homeward = pursueTarget(mob, home, deltaTime, Math.min(0.9, definition.speed * mob.speedMultiplier), 0.05);
        this.moveNavigatingMob(mobId, mob, homeward, home, now);
        continue;
      }
      const pursuit = definition.attackKind === "projectile"
        ? maintainRangedDistance(mob, target, deltaTime, definition.speed * mob.speedMultiplier, definition.minimumAttackRange, definition.stopDistance)
        : pursueTarget(mob, target, deltaTime, definition.speed * mob.speedMultiplier, definition.stopDistance);
      const retreating = definition.attackKind === "projectile"
        && Math.hypot(target.x - mob.x, target.z - mob.z) < definition.minimumAttackRange;
      const goal = retreating
        ? { x: mob.x + (mob.x - target.x), y: mob.y, z: mob.z + (mob.z - target.z) }
        : target;
      this.moveNavigatingMob(mobId, mob, pursuit, goal, now);
      // A ranged mob may walk backwards, but still aims its attacks at the player.
      if (definition.attackKind === "projectile" || pursuit.inAttackRange) mob.yaw = pursuit.yaw;
      const lastAttackAt = this.lastMobAttackAt.get(mobId) ?? 0;
      const actualDistance = Math.hypot(target.x - mob.x, target.z - mob.z);
      const inAttackRange = definition.attackKind === "projectile"
        ? actualDistance >= definition.minimumAttackRange - 0.05 && actualDistance <= definition.stopDistance + 0.05
        : actualDistance <= definition.stopDistance + 0.05;
      if (!inAttackRange || Math.abs(target.y - mob.y) > 1.75 || now - lastAttackAt < definition.cooldownMs
        || !hasCombatLineOfSight(mob, target, this.readWorldBlock)) continue;
      mob.combatState = "windup";
      mob.stateUntil = now + definition.windupMs;
      mob.targetId = target.id;
      mob.aimCommitted = false;
      mob.yaw = Math.atan2(target.x - mob.x, target.z - mob.z) * 180 / Math.PI;
      this.mobCommittedAim.set(mobId, { x: target.x, y: target.y, z: target.z, yaw: mob.yaw });
    }
    for (const [sessionId, player] of this.state.players) {
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
      const speed = movementSpeedWithMomentum(player.defending ? 2.1 : 4.2, player.momentumStacks, player.equippedTrait as TraitId);
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
        mob.health = Math.max(0, mob.health - damage);
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

  private resolveMobMelee(now: number): void {
    for (const [mobId, pending] of this.pendingMobMelee) {
      const mob = this.state.mobs.get(mobId);
      const player = this.state.players.get(pending.targetId);
      if (!mob?.alive || mob.combatState !== "recover" || !player) { this.pendingMobMelee.delete(mobId); continue; }
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

  private applyWeaponHit(sessionId: string, pending: PendingAttack, mobId: string, now: number,
    source?: { x: number; z: number }): void {
      const player = this.state.players.get(sessionId);
      const mob = this.state.mobs.get(mobId);
      const timing = WEAPON_ATTACK_DEFINITIONS[pending.mainHandId].attacks[pending.step - 1]
        ?? WEAPON_ATTACK_DEFINITIONS[pending.mainHandId].attacks[0];
      if (!player || !mob || !mob.alive || !timing) return;
      const traitBonusDamage = executionerDamageBonus(player.equippedTrait as TraitId, mob, { comboStep: pending.step });
      const damage = damageAfterArmor(
        timing.damage + ironSwordDamageBonus(player.blacksmithUpgrades) + this.specialDamageBonus(sessionId, mobId, now),
        mob.armor,
      ) + traitBonusDamage;
      mob.health = Math.max(0, mob.health - damage);
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
