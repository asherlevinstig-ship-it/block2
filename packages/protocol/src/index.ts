import { z } from "zod";

// Bump the room identity when authoritative world generation changes. Colyseus
// Cloud can keep rooms from the previous rolling deployment alive, which would
// otherwise let a new client join a room still serving the old terrain.
export const WORLD_ROOM = "world-combat-impact-v17";
export const WORLD_BOOTSTRAP_CHUNK_RADIUS = 2;
export const WORLD_STREAM_CHUNK_RADIUS = 2;

export const PlayerProfileTokenSchema = z.string().regex(/^guest_[a-f0-9]{32}$/);
export type PlayerProfileToken = z.infer<typeof PlayerProfileTokenSchema>;

export const TAVERN_QUIZ_STARTING_COINS = 20;
export const TAVERN_QUIZ_MAX_STAKE = 10;
export const TAVERN_QUIZ_MAX_PAYOUT = 1024;
export const IRON_ORE_GOLD_PRICE = 3;
export const BLACKSMITH_UPGRADES = {
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", price: 12, ironOre: 6, description: "Auto-equipped tool · extract 2 iron ore from every iron block" },
  iron_sword: { id: "iron_sword", name: "Iron Sword", price: 45, ironOre: 0, description: "+1 damage with every main-hand attack" },
  miners_pack: { id: "miners_pack", name: "Miner's Pack", price: 25, ironOre: 0, description: "Carry up to 30 iron ore instead of 12" },
} as const;
export type BlacksmithUpgradeId = keyof typeof BLACKSMITH_UPGRADES;
export const BlacksmithForgeSchema = z.object({ upgradeId: z.enum(["reinforced_pickaxe", "iron_sword", "miners_pack"]) });
export type BlacksmithUpdate = {
  phase: "idle" | "traded" | "purchased" | "error";
  ironOre: number;
  ironCapacity: number;
  gold: number;
  ownedUpgrades: BlacksmithUpgradeId[];
  purchasedUpgradeId?: BlacksmithUpgradeId;
  sold?: number;
  goldGranted?: number;
  message: string;
};
export type ResourceGathered = { itemId: "iron_ore" | "timber"; quantity: number; total: number };
export const TavernQuizStartSchema = z.object({ stake: z.number().int().min(1).max(TAVERN_QUIZ_MAX_STAKE) });
export const TavernQuizAnswerSchema = z.object({ questionId: z.string().min(1).max(40), choice: z.number().int().min(0).max(3) });
export const TavernQuizDecisionSchema = z.object({ decision: z.enum(["double", "quit"]) });
export type TavernQuizUpdate = {
  phase: "idle" | "question" | "decision" | "won" | "lost" | "error";
  coins: number;
  stake?: number;
  payout?: number;
  question?: { id: string; prompt: string; choices: string[] };
  message?: string;
};

export const ITEM_DEFINITIONS = {
  iron_ore: { id: "iron_ore", name: "Iron Ore", description: "Mined iron ore that can be sold to the town blacksmith" },
  timber: { id: "timber", name: "Greenwood Timber", description: "Fresh timber harvested from Greenwood oak trees" },
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", description: "Forged mining tool that extracts two iron ore per block" },
  moss_fibre: { id: "moss_fibre", name: "Moss Fibre", description: "Soft living fibre gathered from Moss Crawlers" },
  crawler_fang: { id: "crawler_fang", name: "Crawler Fang", description: "A sharp fang shed by a defeated crawler" },
  stone_core: { id: "stone_core", name: "Stone Core", description: "A dense animated core from a Stone Brute" },
  acid_gland: { id: "acid_gland", name: "Acid Gland", description: "A volatile gland taken from a Cave Spitter" },
  fang_dagger: { id: "fang_dagger", name: "Crawler Fang Dagger", description: "A fast three-hit melee weapon" },
  stone_core_hammer: { id: "stone_core_hammer", name: "Stone Core Hammer", description: "A slow crushing weapon with heavy knockback" },
  acid_gland_focus: { id: "acid_gland_focus", name: "Acid Gland Focus", description: "A ranged focus that fires corrosive bolts" },
} as const;

export type ItemId = keyof typeof ITEM_DEFINITIONS;

export const TRAIT_DEFINITIONS = {
  momentum: {
    id: "momentum",
    name: "Momentum",
    description: "Hits build movement speed and stamina recovery",
    maxStacks: 3,
    movementSpeedBonusPerStack: 0.04,
    staminaRecoveryPerStack: 2,
  },
  bulwark: {
    id: "bulwark",
    name: "Bulwark",
    description: "Guard costs less stamina; parries restore stamina",
    guardCostMultiplier: 0.65,
    parryStaminaRestore: 18,
  },
  executioner: {
    id: "executioner",
    name: "Executioner",
    description: "Finishers and Powers punish vulnerable enemies",
    healthThreshold: 0.35,
    bonusDamage: 1,
  },
} as const;

export type TraitId = keyof typeof TRAIT_DEFINITIONS;
export const MOMENTUM_TRAIT = TRAIT_DEFINITIONS.momentum;

export const COMBO_CHAIN_WINDOW_MS = 520;
export const COMBAT_ATTACKS = [
  { step: 1, durationMs: 380, impactMs: 135, damage: 1, knockback: 0.22 },
  { step: 2, durationMs: 410, impactMs: 155, damage: 1, knockback: 0.38 },
  { step: 3, durationMs: 560, impactMs: 210, damage: 2, knockback: 0.82 },
] as const;

export type MainHandTag = "melee" | "ranged" | "focus" | "tool";

export interface MainHandDefinition {
  id: string;
  name: string;
  tag: MainHandTag;
  attackName: string;
  requiredItemId?: ItemId;
}

export const MAIN_HAND_DEFINITIONS = {
  longsword: { id: "longsword", name: "Longsword", tag: "melee", attackName: "Sword Combo" },
  bow: { id: "bow", name: "Hunting Bow", tag: "ranged", attackName: "Bow Shot" },
  magic_focus: { id: "magic_focus", name: "Magic Focus", tag: "focus", attackName: "Arcane Bolt" },
  fang_dagger: { id: "fang_dagger", name: "Crawler Fang Dagger", tag: "melee", attackName: "Fang Flurry", requiredItemId: "fang_dagger" },
  stone_core_hammer: { id: "stone_core_hammer", name: "Stone Core Hammer", tag: "melee", attackName: "Core Smash", requiredItemId: "stone_core_hammer" },
  acid_gland_focus: { id: "acid_gland_focus", name: "Acid Gland Focus", tag: "focus", attackName: "Corrosive Bolt", requiredItemId: "acid_gland_focus" },
} as const satisfies Record<string, MainHandDefinition>;

export type MainHandId = keyof typeof MAIN_HAND_DEFINITIONS;

export interface WeaponAttackStep {
  step: 1 | 2 | 3;
  durationMs: number;
  impactMs: number;
  damage: number;
  knockback: number;
}

export interface WeaponAttackDefinition {
  combo: boolean;
  comboWindowMs: number;
  range: number;
  minimumFacingDot: number;
  projectileTravelMs: number;
  attacks: readonly WeaponAttackStep[];
}

export const WEAPON_ATTACK_DEFINITIONS = {
  longsword: {
    combo: true,
    comboWindowMs: COMBO_CHAIN_WINDOW_MS,
    range: 2.6,
    minimumFacingDot: 0.35,
    projectileTravelMs: 0,
    attacks: COMBAT_ATTACKS,
  },
  bow: {
    combo: false,
    comboWindowMs: 0,
    range: 9,
    minimumFacingDot: 0.92,
    projectileTravelMs: 190,
    attacks: [{ step: 1, durationMs: 640, impactMs: 330, damage: 1, knockback: 0.18 }],
  },
  magic_focus: {
    combo: false,
    comboWindowMs: 0,
    range: 7,
    minimumFacingDot: 0.58,
    projectileTravelMs: 230,
    attacks: [{ step: 1, durationMs: 470, impactMs: 190, damage: 1, knockback: 0.28 }],
  },
  fang_dagger: {
    combo: true,
    comboWindowMs: 420,
    range: 2.2,
    minimumFacingDot: 0.42,
    projectileTravelMs: 0,
    attacks: [
      { step: 1, durationMs: 260, impactMs: 90, damage: 1, knockback: 0.1 },
      { step: 2, durationMs: 280, impactMs: 105, damage: 1, knockback: 0.16 },
      { step: 3, durationMs: 390, impactMs: 145, damage: 2, knockback: 0.42 },
    ],
  },
  stone_core_hammer: {
    combo: false,
    comboWindowMs: 0,
    range: 2.75,
    minimumFacingDot: 0.28,
    projectileTravelMs: 0,
    attacks: [{ step: 1, durationMs: 820, impactMs: 430, damage: 3, knockback: 1.35 }],
  },
  acid_gland_focus: {
    combo: false,
    comboWindowMs: 0,
    range: 7.5,
    minimumFacingDot: 0.58,
    projectileTravelMs: 220,
    attacks: [{ step: 1, durationMs: 560, impactMs: 235, damage: 2, knockback: 0.22 }],
  },
} as const satisfies Record<MainHandId, WeaponAttackDefinition>;

export interface PowerDefinition {
  id: string;
  name: string;
  core: "burst" | "line" | "ground" | "mobility";
  castType: "tap" | "aim-release" | "ground-release";
  compatibility: readonly ("universal" | MainHandTag)[];
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  cooldownMs: number;
  range: number;
  width: number;
  damage: number;
  knockback: number;
  staggerMs: number;
  forwardStep: number;
  fracturesTerrain: boolean;
}

export const POWER_DEFINITIONS = {
  shockwave: {
    id: "shockwave",
    name: "Shockwave",
    core: "burst",
    castType: "tap",
    compatibility: ["universal"],
    windupMs: 280,
    activeMs: 120,
    recoveryMs: 420,
    cooldownMs: 5200,
    range: 3.2,
    width: 0,
    damage: 1,
    knockback: 1.7,
    staggerMs: 620,
    forwardStep: 0,
    fracturesTerrain: false,
  },
  seismic_cleave: {
    id: "seismic_cleave",
    name: "Seismic Cleave",
    core: "line",
    castType: "aim-release",
    compatibility: ["melee"],
    windupMs: 450,
    activeMs: 160,
    recoveryMs: 550,
    cooldownMs: 7000,
    range: 5.2,
    width: 1.45,
    damage: 2,
    knockback: 1.15,
    staggerMs: 900,
    forwardStep: 0.65,
    fracturesTerrain: true,
  },
  eruption: {
    id: "eruption",
    name: "Eruption",
    core: "ground",
    castType: "ground-release",
    compatibility: ["universal"],
    windupMs: 900,
    activeMs: 180,
    recoveryMs: 520,
    cooldownMs: 8000,
    range: 6.5,
    width: 2.25,
    damage: 2,
    knockback: 0.65,
    staggerMs: 950,
    forwardStep: 0,
    fracturesTerrain: false,
  },
  lunge_strike: {
    id: "lunge_strike",
    name: "Lunge Strike",
    core: "mobility",
    castType: "aim-release",
    compatibility: ["melee"],
    windupMs: 260,
    activeMs: 160,
    recoveryMs: 460,
    cooldownMs: 6500,
    range: 3.8,
    width: 1.25,
    damage: 2,
    knockback: 1.05,
    staggerMs: 760,
    forwardStep: 3.1,
    fracturesTerrain: false,
  },
} as const satisfies Record<string, PowerDefinition>;

export type PowerId = keyof typeof POWER_DEFINITIONS;

export type SeismicMasteryId = "advancing_fault" | "tectonic_stand";

export const SEISMIC_CLEAVE_UPGRADES = {
  faultReachBonus: 1.4,
  aftershockStartRatio: 0.68,
  aftershockStaggerBonusMs: 700,
  masteries: {
    advancing_fault: {
      id: "advancing_fault",
      name: "Advancing Fault",
      description: "Drive forward through a focused rupture.",
      width: 1.2,
      forwardStep: 1.45,
      fractureWidth: 1,
    },
    tectonic_stand: {
      id: "tectonic_stand",
      name: "Tectonic Stand",
      description: "Hold position and tear open a much wider fault.",
      width: 2.65,
      forwardStep: 0,
      fractureWidth: 3,
    },
  },
} as const;

export const HUNTERS_MARK = {
  id: "hunters_mark",
  name: "Hunter's Mark",
  core: "mark",
  castType: "tap",
  range: 8,
  minimumFacingDot: 0.25,
  durationMs: 10000,
  cooldownMs: 10000,
  bonusDamage: 1,
  initialStacks: 1,
  maxStacks: 3,
  exposedPowerBonusDamage: 2,
  exposedStaggerBonusMs: 900,
} as const;

export const BRAMBLE_SNARE = {
  id: "bramble_snare",
  name: "Bramble Snare",
  core: "trap",
  castType: "ground-release",
  cooldownMs: 12000,
  range: 6,
  radius: 1.35,
  lifetimeMs: 8000,
  rootMs: 2000,
} as const;

export const SPECIAL_DEFINITIONS = {
  hunters_mark: HUNTERS_MARK,
  bramble_snare: BRAMBLE_SNARE,
} as const;

export type SpecialId = keyof typeof SPECIAL_DEFINITIONS;

export const MoveRequestSchema = z.object({
  sequence: z.number().int().positive(),
  strafe: z.number().finite().min(-1).max(1),
  forward: z.number().finite().min(-1).max(1),
  yaw: z.number().finite().default(0),
  stopX: z.number().finite().optional(),
  stopY: z.number().finite().optional(),
  stopZ: z.number().finite().optional(),
});

export const ChunkRegionRequestSchema = z.object({
  chunkX: z.number().int().min(-10_000).max(10_000),
  chunkZ: z.number().int().min(-10_000).max(10_000),
  knownChunks: z.array(z.object({
    chunkX: z.number().int().min(-10_000).max(10_000),
    chunkZ: z.number().int().min(-10_000).max(10_000),
    revision: z.number().int().nonnegative(),
  })).max(121).default([]),
});

export const MineBlockRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  expectedRevision: z.number().int().nonnegative(),
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
});

export const AttackRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  yaw: z.number().finite(),
});

export const DodgeRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  strafe: z.number().finite().min(-1).max(1),
  forward: z.number().finite().min(-1).max(1),
  yaw: z.number().finite(),
});

export const DefenseRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  active: z.boolean(),
  yaw: z.number().finite(),
});

export const PowerRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  powerId: z.string().min(1).max(64),
  yaw: z.number().finite(),
  target: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }).optional(),
});

export const PowerCancelRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
});

export const PowerEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  powerId: z.enum(["shockwave", "seismic_cleave", "eruption", "lunge_strike"]),
});

export const SeismicMasteryEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  masteryId: z.enum(["advancing_fault", "tectonic_stand"]),
});

export const SpecialRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  specialId: z.enum(["hunters_mark", "bramble_snare"]),
  yaw: z.number().finite(),
  target: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  }).optional(),
});

export const SpecialEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  specialId: z.enum(["hunters_mark", "bramble_snare"]),
});

export const MainHandEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  mainHandId: z.enum(["longsword", "bow", "magic_focus", "fang_dagger", "stone_core_hammer", "acid_gland_focus"]),
});

export const TraitEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  traitId: z.enum(["momentum", "bulwark", "executioner"]),
});

export type MoveRequest = z.infer<typeof MoveRequestSchema>;
export type ChunkRegionRequest = z.infer<typeof ChunkRegionRequestSchema>;
export type MineBlockRequest = z.infer<typeof MineBlockRequestSchema>;
export type AttackRequest = z.infer<typeof AttackRequestSchema>;
export type DodgeRequest = z.infer<typeof DodgeRequestSchema>;
export type DefenseRequest = z.infer<typeof DefenseRequestSchema>;
export type PowerRequest = z.infer<typeof PowerRequestSchema>;
export type PowerCancelRequest = z.infer<typeof PowerCancelRequestSchema>;
export type PowerEquipRequest = z.infer<typeof PowerEquipRequestSchema>;
export type SeismicMasteryEquipRequest = z.infer<typeof SeismicMasteryEquipRequestSchema>;
export type SpecialRequest = z.infer<typeof SpecialRequestSchema>;
export type SpecialEquipRequest = z.infer<typeof SpecialEquipRequestSchema>;
export type MainHandEquipRequest = z.infer<typeof MainHandEquipRequestSchema>;
export type TraitEquipRequest = z.infer<typeof TraitEquipRequestSchema>;

export interface ChunkSnapshot {
  chunkX: number;
  chunkZ: number;
  revision: number;
  blocks: number[];
}

export interface WorldBootstrap {
  seed: string;
  chunkSize: number;
  chunkHeight: number;
  spawn: { x: number; y: number; z: number };
  chunks: ChunkSnapshot[];
}

export type WorldObjectiveUpdate = {
  objectiveId: string;
  title: string;
  detail: string;
  tier: number;
  targetMobId: string;
  targetMobIds: string[];
  completedMobIds: string[];
  targetX: number;
  targetY: number;
  targetZ: number;
};

export type WorldObjectiveCompleted = {
  objectiveId: string;
  title: string;
  rewardLabel: string;
  coinsGranted: number;
};

export interface ChunkRegion {
  chunks: ChunkSnapshot[];
}

export interface BlockChanged {
  requestId: string;
  x: number;
  y: number;
  z: number;
  block: number;
  revision: number;
}

export interface CombatHit {
  attackerId: string;
  mainHandId: MainHandId;
  mobId: string;
  damage: number;
  health: number;
  defeated: boolean;
  comboStep: number;
  knockback: number;
  momentumStacks: number;
  traitBonusDamage?: number;
}

export interface CombatMiss {
  attackerId: string;
  mainHandId: MainHandId;
  comboStep: number;
}

export interface WeaponAttackReleased {
  projectileId: string;
  attackerId: string;
  mainHandId: MainHandId;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  travelMs: number;
}

export interface ProjectileResolved {
  projectileId: string;
  reason: "hit" | "terrain" | "miss";
  x: number;
  y: number;
  z: number;
}

export interface MobProjectileReleased {
  projectileId: string;
  mobId: string;
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  travelMs: number;
}

export interface MobHazardPlaced {
  hazardId: string;
  mobId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  expiresAt: number;
}

export interface PlayerHit {
  mobId: string;
  playerId: string;
  damage: number;
  health: number;
  defeated: boolean;
  guarded?: boolean;
  parried?: boolean;
  momentumStacks?: number;
}

export interface DefenseResolved {
  playerId: string;
  mobId: string;
  guarded: boolean;
  parried: boolean;
  damage: number;
  stamina: number;
  momentumStacks: number;
}

export interface CombatReward {
  playerId: string;
  mobId: string;
  coinsGranted: number;
  healthRestored: number;
  staminaRestored: number;
  health: number;
  stamina: number;
}

export interface LootPickedUp {
  playerId: string;
  dropId: string;
  itemId: ItemId;
  quantity: number;
  total: number;
}

export interface CombatStagger {
  attackerId: string;
  mobId: string;
  durationMs: number;
}

export interface PowerCast {
  casterId: string;
  powerId: PowerId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  startedAt: number;
  windupMs: number;
  range?: number;
  width?: number;
  seismicMastery?: SeismicMasteryId;
  target?: { x: number; y: number; z: number };
}

export interface PowerFracture {
  x: number;
  y: number;
  z: number;
}

export interface PowerResolved {
  casterId: string;
  powerId: PowerId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hitCount: number;
  damage: number;
  defeatedMobIds: string[];
  fractures: PowerFracture[];
  range?: number;
  width?: number;
  aftershockHitCount?: number;
  traitBonusHitCount?: number;
  seismicMastery?: SeismicMasteryId;
}

export interface PowerCancelled {
  casterId: string;
  powerId: PowerId;
  reason: "dodge" | "cancel";
}

export interface SpecialApplied {
  casterId: string;
  mobId: string;
  expiresAt: number;
  cooldownUntil: number;
  bonusDamage: number;
  stacks: number;
  maxStacks: number;
}

export interface SpecialProgressed {
  casterId: string;
  mobId: string;
  expiresAt: number;
  stacks: number;
  maxStacks: number;
  exposed: boolean;
}

export interface SpecialConsumed {
  casterId: string;
  mobId: string;
  powerId: PowerId;
  bonusDamage: number;
  staggerMs: number;
}

export interface BrambleSnarePlaced {
  casterId: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  expiresAt: number;
  cooldownUntil: number;
}

export interface BrambleSnareTriggered {
  casterId: string;
  mobId: string;
  x: number;
  y: number;
  z: number;
  rootMs: number;
}

export interface ActionRejected {
  requestId?: string;
  action: "move" | "mine" | "attack" | "dodge" | "defense" | "power" | "special" | "loadout";
  reason: "payload" | "range" | "protected" | "missing" | "collision" | "stale" | "rate" | "stamina" | "cooldown" | "compatibility";
}
