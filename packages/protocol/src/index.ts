import { z } from "zod";
export { BRUTE_VOLLEY, bruteVolleyReady, bruteRockEndpoints, bruteRockLanes } from "./brute-volley.js";
export { SPITTER_PATTERN, CRYSTAL_BURST_OFFSETS, VENOM_RING_OFFSETS, MATRIARCH_PHASE, matriarchEnraged, matriarchPattern, crystalMatriarchPattern, matriarchSecondVolleyYaw, matriarchWarningLanes, spitterPattern, spitterShotOffsets, spitterShotEndpoints, spitterWarningLanes } from "./spitter-patterns.js";

// Bump the room identity when authoritative world generation changes. Colyseus
// Cloud can keep rooms from the previous rolling deployment alive, which would
// otherwise let a new client join a room still serving the old terrain.
export const WORLD_ROOM = "world-stable-movement-v119";
export const SILVER_DEPTHS_ROOM = "silver-depths-instance-v3";
export type RoomTransfer = { room: typeof WORLD_ROOM | typeof SILVER_DEPTHS_ROOM; instanceKey?: string; partySize?: number; returnFrom?: "silver-depths"; retry?: boolean; partyTicket?: string; worldRoomId?: string };
export interface ForestPortal { kind: string; x: number; y: number; z: number; expiresAt: number }
export const FOREST_PORTAL_LIFETIME_MS = 120_000;
export function canUseForestPortal(player: { x: number; y: number; z: number; health: number }, portal: ForestPortal, now: number): boolean {
  return player.health > 0 && (portal.expiresAt === 0 || now < portal.expiresAt)
    && Math.abs(player.y - portal.y) <= 1.5 && Math.hypot(player.x - portal.x, player.z - portal.z) <= 2;
}
export const PartyRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), targetId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("respond"), inviteId: z.string().min(1).max(160), accept: z.boolean() }),
  z.object({ action: z.literal("leave") }),
]);
export type PartyRequest = z.infer<typeof PartyRequestSchema>;
export type PartyUpdate = { partyId: string | null; members: { id: string; name: string; health: number; maxHealth: number; distance: number; leader: boolean }[];
  nearby: { id: string; name: string }[]; invite: { id: string; name: string; expiresAt: number } | null };
export type RealmEventUpdate = {
  phase: "idle" | "warning" | "active" | "cooldown";
  eventId: string | null;
  eventName: string | null;
  eventTitle: string | null;
  targetX: number;
  targetY: number;
  targetZ: number;
  warningUntil: number;
  completed: number;
  required: number;
  realmBoss: boolean;
  eliteKills?: number;
  eliteRequired?: number;
  lootHint?: string;
};
export const ChatSendSchema = z.object({ text: z.string().min(1).max(160) });
export const PlayerNameSchema = z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9 _-]+$/);
export const APPEARANCE_PALETTE = {
  skin: [
    { id: "warm", name: "Warm", color: "#db9c66" },
    { id: "light", name: "Light", color: "#efc6a2" },
    { id: "deep", name: "Deep", color: "#865438" },
  ],
  hair: [
    { id: "dark", name: "Dark", color: "#291810" },
    { id: "brown", name: "Brown", color: "#70472a" },
    { id: "silver", name: "Silver", color: "#b6c0be" },
  ],
  coat: [
    { id: "teal", name: "Teal", color: "#1f7375" },
    { id: "rust", name: "Rust", color: "#aa5a36" },
    { id: "violet", name: "Violet", color: "#654f9a" },
  ],
} as const;
export const APPEARANCE_STYLES = {
  hairStyle: [
    { id: "swept", name: "Swept" },
    { id: "spiked", name: "Spiked" },
    { id: "long", name: "Long" },
  ],
  coatStyle: [
    { id: "explorer", name: "Explorer" },
    { id: "short", name: "Short jacket" },
    { id: "long", name: "Long coat" },
  ],
} as const;
export const AppearanceSchema = z.object({
  skin: z.enum(["warm", "light", "deep"]),
  hair: z.enum(["dark", "brown", "silver"]),
  coat: z.enum(["teal", "rust", "violet"]),
  hairStyle: z.enum(["swept", "spiked", "long"]),
  coatStyle: z.enum(["explorer", "short", "long"]),
}).strict();
export type Appearance = z.infer<typeof AppearanceSchema>;
export const DEFAULT_APPEARANCE: Appearance = { skin: "warm", hair: "dark", coat: "teal", hairStyle: "swept", coatStyle: "explorer" };
export function resolveAppearance(value: unknown): Appearance {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    skin: AppearanceSchema.shape.skin.safeParse(source.skin).data ?? DEFAULT_APPEARANCE.skin,
    hair: AppearanceSchema.shape.hair.safeParse(source.hair).data ?? DEFAULT_APPEARANCE.hair,
    coat: AppearanceSchema.shape.coat.safeParse(source.coat).data ?? DEFAULT_APPEARANCE.coat,
    hairStyle: AppearanceSchema.shape.hairStyle.safeParse(source.hairStyle).data ?? DEFAULT_APPEARANCE.hairStyle,
    coatStyle: AppearanceSchema.shape.coatStyle.safeParse(source.coatStyle).data ?? DEFAULT_APPEARANCE.coatStyle,
  };
}
export type NearbyChatMessage = { senderId: string; name: string; text: string };
export const EQUIPMENT_LOOT_RANGE = 1.8;
export type LootCollectAction = "keep" | "equip" | "dismantle";
export const LootCollectRequestSchema = z.object({
  dropId: z.string().min(1).max(160),
  // `equip` remains accepted for clients crossing a rolling deployment.
  equip: z.boolean().optional(),
  action: z.enum(["keep", "equip", "dismantle"]).optional(),
}).refine(value => value.action !== undefined || value.equip !== undefined);
export type LootCollectResult = {
  ok: boolean;
  dropId: string;
  message: string;
  action?: LootCollectAction;
  itemId?: ItemId;
  goldGranted?: number;
  materialGranted?: ItemId;
  materialQuantity?: number;
};
export const HEALING_POTION = { price: 5, heal: 2, capacity: 3, cooldownMs: 5000 } as const;
export type PotionUpdate = { phase: "bought" | "healed" | "error"; message: string; quantity: number; gold: number; health: number; maxHealth: number; cooldownUntil: number; healed: number };
export const MINERAL_REGROWTH_MS = 120_000;
export interface MineralDepositStatus { id: string; available: number; total: number; readyAt: number | null }
export const WORLD_BOOTSTRAP_CHUNK_RADIUS = 2;
export const WORLD_STREAM_CHUNK_RADIUS = 2;

export const PlayerProfileTokenSchema = z.string().regex(/^guest_[a-f0-9]{32}$/);
export type PlayerProfileToken = z.infer<typeof PlayerProfileTokenSchema>;

export const MAX_CHARACTER_LEVEL = 20;
export const MAX_CHARACTER_STAT_POINTS = 5;
export const CHARACTER_STATS = {
  power: { name: "Power", detail: "+1 weapon and Power damage every 2 points" },
  vitality: { name: "Vitality", detail: "+1 maximum health" },
  agility: { name: "Agility", detail: "+2% movement speed" },
  mining: { name: "Mining", detail: "+1 mineral yield every 2 points" },
} as const;
export type CharacterStatId = keyof typeof CHARACTER_STATS;
export const ProgressionChooseSchema = z.object({ stat: z.enum(["power", "vitality", "agility", "mining"]) });
export function experienceToNextLevel(level: number): number {
  const safe = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.floor(level)));
  return safe >= MAX_CHARACTER_LEVEL ? 0 : 25 + safe * 15;
}
export function characterPowerBonus(points: number): number { return Math.floor(Math.max(0, points) / 2); }
export function characterSpeedMultiplier(points: number): number { return 1 + Math.max(0, points) * .02; }
export function characterMiningBonus(points: number): number { return Math.floor(Math.max(0, points) / 2); }
export const WORLD_LEVEL_RANGES = [
  { min: 1, max: 20, label: "SAFE" },
  { min: 1, max: 4, label: "LV 1–4" },
  { min: 4, max: 8, label: "LV 4–8" },
  { min: 8, max: 12, label: "LV 8–12" },
] as const;
export type EnemyThreat = "trivial" | "even" | "dangerous" | "deadly";
export function worldLevelRange(tier: number): typeof WORLD_LEVEL_RANGES[number] {
  return WORLD_LEVEL_RANGES[Math.max(0, Math.min(3, Math.floor(tier)))]!;
}
export function enemyLevelForTier(tier: number, champion = false, boss = false): number {
  const base = [1, 2, 5, 9][Math.max(0, Math.min(3, Math.floor(tier)))]!;
  return Math.min(MAX_CHARACTER_LEVEL, base + (champion ? 2 : 0) + (boss ? 2 : 0));
}
export function enemyThreat(playerLevel: number, enemyLevel: number): EnemyThreat {
  const gap = Math.floor(enemyLevel) - Math.floor(playerLevel);
  return gap >= 5 ? "deadly" : gap >= 2 ? "dangerous" : gap <= -4 ? "trivial" : "even";
}
export function experienceLevelMultiplier(playerLevel: number, enemyLevel: number): number {
  const gap = Math.floor(enemyLevel) - Math.floor(playerLevel);
  return gap >= 5 ? 1.75 : gap >= 2 ? 1.4 : gap <= -6 ? .1 : gap <= -4 ? .25 : gap <= -2 ? .5 : 1;
}
export const CHARACTER_MILESTONES = [
  { level: 3, id: "second_power", name: "Second Power Slot", detail: "Equip a second Power and cast it with T" },
  { level: 5, id: "advanced_smithing", name: "Advanced Smithing", detail: "Forged weapons and iron armour become available" },
  { level: 7, id: "silver_depths", name: "The Silver Depths", detail: "Accept the second expedition from the blacksmith" },
  { level: 10, id: "frontier_contracts", name: "Frontier Contracts", detail: "Track elite Frontier encounters and bosses" },
] as const;
export type CharacterMilestoneId = typeof CHARACTER_MILESTONES[number]["id"];
export function milestoneUnlocked(level: number, id: CharacterMilestoneId): boolean {
  return level >= CHARACTER_MILESTONES.find(milestone => milestone.id === id)!.level;
}
export function blacksmithRequiredLevel(id: BlacksmithStockId): number {
  return id === "leather_armour" ? 1 : 5;
}
export type ProgressionUpdate = {
  reason: "sync" | "experience" | "level_up" | "choice";
  source?: string;
  experienceGranted?: number;
  level: number;
  experience: number;
  experienceRequired: number;
  unspentStatPoints: number;
  powerPoints: number;
  vitalityPoints: number;
  agilityPoints: number;
  miningPoints: number;
};

export const TAVERN_QUIZ_STARTING_COINS = 20;
export const TAVERN_QUIZ_MAX_STAKE = 10;
export const TAVERN_QUIZ_MAX_PAYOUT = 1024;
export const IRON_ORE_GOLD_PRICE = 3;
export const SILVER_ORE_GOLD_PRICE = 8;
export const BLACKSMITH_UPGRADES = {
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", price: 12, ironOre: 0, description: "Auto-equipped tool · extract 2 minerals from every ore block" },
  iron_sword: { id: "iron_sword", name: "Iron Sword", price: 45, ironOre: 0, description: "Upgrades and equips your longsword · +1 sword damage" },
  miners_pack: { id: "miners_pack", name: "Miner's Pack", price: 25, ironOre: 0, description: "Carry up to 30 of each mineral instead of 12" },
  moonstone_edge: { id: "moonstone_edge", name: "Moonstone Edge", price: 0, ironOre: 0, description: "Expedition reward · permanently adds +1 damage to every weapon" },
} as const;
export type BlacksmithUpgradeId = keyof typeof BLACKSMITH_UPGRADES;
export const BlacksmithForgeSchema = z.object({ upgradeId: z.enum(["reinforced_pickaxe", "iron_sword", "miners_pack", "moonstone_edge"]) });
export const SILVER_DEPTHS_REWARDS = {
  moonstone_pickaxe: { id: "moonstone_pickaxe", name: "Moonstone Pickaxe", cost: 2, description: "Extract one additional mineral from every ore block" },
  crystal_lantern: { id: "crystal_lantern", name: "Crystal Lantern", cost: 2, description: "Greatly improves visibility throughout the Silver Depths" },
  matriarch_guard: { id: "matriarch_guard", name: "Matriarch Guard", cost: 3, description: "Reduces projectile and hazard damage by 1" },
  depths_compass: { id: "depths_compass", name: "Depths Compass", cost: 1, description: "Reveals the complete dungeon route and breadcrumb trail" },
  edge_tempering: { id: "edge_tempering", name: "Edge Tempering", cost: 4, description: "Permanently adds +1 damage to every weapon" },
} as const;
export type SilverDepthsRewardId = keyof typeof SILVER_DEPTHS_REWARDS;
export const SilverDepthsRewardBuySchema = z.object({ rewardId: z.enum(["moonstone_pickaxe", "crystal_lantern", "matriarch_guard", "depths_compass", "edge_tempering"]) });
export const BLACKSMITH_WEAPONS = { forged_sword: { price: 45 }, forged_bow: { price: 50 }, forged_focus: { price: 55 } } as const;
export type BlacksmithWeaponId = keyof typeof BLACKSMITH_WEAPONS;
export const ARMOUR_DEFINITIONS = {
  none: { name: "No armour", reduction: 0, speed: 1, projectileReduction: 0, hazardReduction: 0 },
  leather_armour: { name: "Leather Armour", reduction: 1, speed: 1, projectileReduction: 0, hazardReduction: 0 },
  iron_armour: { name: "Iron Armour", reduction: 2, speed: .92, projectileReduction: 0, hazardReduction: 0 },
  rootguard_armour: { name: "Rootguard Armour", reduction: 1, speed: .98, projectileReduction: 2, hazardReduction: 2 },
  bastion_plate: { name: "Bastion Plate", reduction: 2, speed: .94, projectileReduction: 0, hazardReduction: 1 },
} as const;
export type ArmourId = keyof typeof ARMOUR_DEFINITIONS;
export function armourForItem(id: string): Exclude<ArmourId, "none"> | null {
  return id === "leather_armour" || id === "iron_armour" || id === "rootguard_armour" || id === "bastion_plate" ? id : null;
}
export function utilityForItem(id: string): "miners_lantern" | "moonstone" | null { return id === "miners_lantern" || id === "moonstone" ? id : null; }
export function isEquipmentItem(id: string): boolean { return equipmentForItem(id) !== null || armourForItem(id) !== null || utilityForItem(id) !== null; }
export const ArmourEquipSchema = z.object({ armourId: z.enum(["none", "leather_armour", "iron_armour", "rootguard_armour", "bastion_plate"]) });
export const BLACKSMITH_STOCK = { ...BLACKSMITH_WEAPONS, leather_armour: { price: 30 }, iron_armour: { price: 70 } } as const;
export type BlacksmithStockId = keyof typeof BLACKSMITH_STOCK;
export const BlacksmithBuySchema = z.object({ itemId: z.enum(["forged_sword", "forged_bow", "forged_focus", "leather_armour", "iron_armour"]) });
export const BLACKSMITH_DISMANTLE = {
  forged_sword: { gold: 14 }, forged_bow: { gold: 16 }, forged_focus: { gold: 18 },
  leather_armour: { gold: 8 }, iron_armour: { gold: 20 },
  fang_dagger: { gold: 3, materialId: "crawler_fang", materialQuantity: 1 },
  stone_core_hammer: { gold: 6, materialId: "stone_core", materialQuantity: 1 },
  rootbound_hammer: { gold: 16, materialId: "timber", materialQuantity: 2 },
  matriarch_edge: { gold: 22, materialId: "moonstone", materialQuantity: 1 },
  acid_gland_focus: { gold: 6, materialId: "acid_gland", materialQuantity: 1 },
  venom_focus: { gold: 16, materialId: "acid_gland", materialQuantity: 2 },
  echo_prism: { gold: 18, materialId: "silver_ore", materialQuantity: 1 },
  rootguard_armour: { gold: 14, materialId: "moss_fibre", materialQuantity: 2 },
  bastion_plate: { gold: 18, materialId: "stone_core", materialQuantity: 1 },
} as const satisfies Partial<Record<ItemId, { gold: number; materialId?: ItemId; materialQuantity?: number }>>;
export type BlacksmithDismantleItemId = keyof typeof BLACKSMITH_DISMANTLE;
export const BlacksmithDismantleSchema = z.object({ itemId: z.enum(Object.keys(BLACKSMITH_DISMANTLE) as [BlacksmithDismantleItemId, ...BlacksmithDismantleItemId[]]) });
export const BLACKSMITH_REFORGE = {
  forged_sword: { materialId: "iron_ore", costs: [{ gold: 18, material: 3 }, { gold: 36, material: 6 }, { gold: 70, material: 10 }] },
  forged_bow: { materialId: "iron_ore", costs: [{ gold: 20, material: 3 }, { gold: 40, material: 6 }, { gold: 75, material: 10 }] },
  forged_focus: { materialId: "silver_ore", costs: [{ gold: 22, material: 2 }, { gold: 44, material: 4 }, { gold: 80, material: 7 }] },
  fang_dagger: { materialId: "crawler_fang", costs: [{ gold: 10, material: 2 }, { gold: 24, material: 4 }, { gold: 48, material: 7 }] },
  stone_core_hammer: { materialId: "stone_core", costs: [{ gold: 14, material: 2 }, { gold: 30, material: 4 }, { gold: 60, material: 7 }] },
  rootbound_hammer: { materialId: "timber", costs: [{ gold: 22, material: 3 }, { gold: 46, material: 6 }, { gold: 90, material: 10 }] },
  matriarch_edge: { materialId: "moonstone", costs: [{ gold: 30, material: 1 }, { gold: 65, material: 2 }, { gold: 120, material: 3 }] },
  acid_gland_focus: { materialId: "acid_gland", costs: [{ gold: 12, material: 2 }, { gold: 28, material: 4 }, { gold: 55, material: 7 }] },
  venom_focus: { materialId: "acid_gland", costs: [{ gold: 24, material: 3 }, { gold: 50, material: 6 }, { gold: 95, material: 10 }] },
  echo_prism: { materialId: "silver_ore", costs: [{ gold: 24, material: 3 }, { gold: 50, material: 6 }, { gold: 95, material: 10 }] },
  leather_armour: { materialId: "moss_fibre", costs: [{ gold: 10, material: 2 }, { gold: 24, material: 4 }, { gold: 48, material: 7 }] },
  iron_armour: { materialId: "iron_ore", costs: [{ gold: 18, material: 3 }, { gold: 38, material: 6 }, { gold: 75, material: 10 }] },
  rootguard_armour: { materialId: "moss_fibre", costs: [{ gold: 20, material: 3 }, { gold: 42, material: 6 }, { gold: 85, material: 10 }] },
  bastion_plate: { materialId: "stone_core", costs: [{ gold: 24, material: 3 }, { gold: 50, material: 6 }, { gold: 95, material: 10 }] },
} as const satisfies Partial<Record<ItemId, { materialId: ItemId; costs: readonly { gold: number; material: number }[] }>>;
export type BlacksmithReforgeItemId = keyof typeof BLACKSMITH_REFORGE;
export type EquipmentReforgeRanks = Partial<Record<BlacksmithReforgeItemId, number>>;
export const BlacksmithReforgeSchema = z.object({ itemId: z.enum(Object.keys(BLACKSMITH_REFORGE) as [BlacksmithReforgeItemId, ...BlacksmithReforgeItemId[]]) });
export function reforgeWeaponDamageBonus(rank: number): number { return Math.max(0, Math.min(3, Math.floor(rank))); }
export function reforgeArmourReduction(rank: number): number { return Math.max(0, Math.min(2, Math.ceil(Math.max(0, Math.min(3, Math.floor(rank))) / 2))); }
export function armourStats(id: string) { return ARMOUR_DEFINITIONS[Object.hasOwn(ARMOUR_DEFINITIONS, id) ? id as ArmourId : "none"]; }
export type IncomingDamageKind = "melee" | "projectile" | "hazard";
export function armouredDamage(damage: number, id: string, kind: IncomingDamageKind = "melee", reforgeRank = 0): number {
  if (damage <= 0) return 0;
  const armour = armourStats(id);
  const situational = kind === "projectile" ? armour.projectileReduction : kind === "hazard" ? armour.hazardReduction : 0;
  return Math.max(1, damage - armour.reduction - situational - reforgeArmourReduction(reforgeRank));
}
export type BlacksmithUpdate = {
  phase: "idle" | "traded" | "purchased" | "dismantled" | "reforged" | "error";
  ironOre: number;
  silverOre?: number;
  moonstone?: number;
  ironCapacity: number;
  gold: number;
  characterLevel: number;
  ownedUpgrades: BlacksmithUpgradeId[];
  ownedDepthsRewards?: SilverDepthsRewardId[];
  purchasedUpgradeId?: BlacksmithUpgradeId;
  purchasedDepthsRewardId?: SilverDepthsRewardId;
  weapons?: Partial<Record<BlacksmithStockId, number>>;
  dismantleItems?: Partial<Record<BlacksmithDismantleItemId, number>>;
  dismantledItemId?: BlacksmithDismantleItemId;
  reforgeRanks?: EquipmentReforgeRanks;
  reforgeMaterials?: Partial<Record<ItemId, number>>;
  reforgedItemId?: BlacksmithReforgeItemId;
  materialGranted?: ItemId;
  materialQuantity?: number;
  sold?: number;
  goldGranted?: number;
  message: string;
};
export type DungeonRunUpdate = {
  runId: string;
  phase: "started" | "completed";
  dungeon?: "forest" | "silver-depths" | "ember-vault";
  partySize: number;
  durationMs?: number;
  cooldownUntil?: number;
  reward?: string;
  rank?: "GOLD" | "SILVER" | "BRONZE";
  bestTimeMs?: number;
  newBest?: boolean;
  stats?: { enemiesDefeated: number; damageTaken: number; moonstoneCollected: number; moonstoneAwarded?: number; moonstoneTotal?: number; emberCoresAwarded?: number; emberCoresTotal?: number; signatureItemObtained: boolean };
};
export const SilverDepthsRouteRequestSchema = z.object({ wing: z.enum(["iron", "silver"]) });
export type SilverDepthsWing = z.infer<typeof SilverDepthsRouteRequestSchema>["wing"];
export type DungeonRewardClaimed = {
  runId: string;
  goldGranted: number;
  totalGold: number;
  items: { itemId: ItemId; quantity: number; total: number }[];
  message: string;
};
export const DungeonLobbyRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ready") }),
  z.object({ action: z.literal("start") }),
]);
export type DungeonLobbyUpdate = {
  runId: string;
  phase: "lobby" | "active";
  leader: boolean;
  members: { id: string; name: string; entered: boolean; ready: boolean }[];
  scalePlayers: number;
  message: string;
};
export type SilverDepthsLobbyUpdate = {
  phase: "assembling" | "closed";
  leaderId: string;
  members: { id: string; name: string; ready: boolean }[];
  expiresAt: number;
  message: string;
};
export const DungeonBoardRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("open") }),
]);
export type DungeonBoardUpdate = {
  available: boolean;
  active: boolean;
  leader: boolean;
  partySize: number;
  stage: 0 | 1 | 2 | 3;
  cooldownUntil: number;
  bestTimeMs: number;
  portalExpiresAt: number;
  message: string;
};
export type ResourceGathered = { itemId: "iron_ore" | "silver_ore" | "moonstone" | "timber"; quantity: number; total: number };
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
  leather_armour: { id: "leather_armour", name: "Leather Armour", description: "Reduce damage by 1 (minimum hit 1) · full movement speed" },
  iron_armour: { id: "iron_armour", name: "Iron Armour", description: "Reduce damage by 2 (minimum hit 1) · 8% slower movement" },
  rootguard_armour: { id: "rootguard_armour", name: "Rootguard Armour", description: "Reduce damage by 1 · extra protection from projectiles and hazards · 2% slower" },
  bastion_plate: { id: "bastion_plate", name: "Bastion Plate", description: "Iron Bastion relic · reduce damage by 2 · extra protection from hazards · 6% slower" },
  forged_sword: { id: "forged_sword", name: "Forged Sword", description: "Iron blade · 2 / 2 / 3 combo damage · equip from your pack" },
  forged_bow: { id: "forged_bow", name: "Forged Bow", description: "Steel-braced bow · 2 arrow damage · equip from your pack" },
  forged_focus: { id: "forged_focus", name: "Forged Focus", description: "Smith-made focus · 2 bolt damage · equip from your pack" },
  healing_potion: { id: "healing_potion", name: "Healing Potion", description: "Restore 2 HP · H to drink · carry up to 3" },
  iron_ore: { id: "iron_ore", name: "Iron Ore", description: "Mined iron ore that can be sold to the town blacksmith" },
  silver_ore: { id: "silver_ore", name: "Silver Ore", description: "Wilderness mineral · sell to the blacksmith for 8 gold each" },
  moonstone: { id: "moonstone", name: "Moonstone", description: "Silver Depths reward mineral used for permanent attunements" },
  ember_core: { id: "ember_core", name: "Ember Core", description: "Forge Colossus currency · earned from ranked Ember Vault clears" },
  timber: { id: "timber", name: "Greenwood Timber", description: "Fresh timber harvested from Greenwood oak trees" },
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", description: "Forged mining tool that extracts two minerals per ore block" },
  miners_lantern: { id: "miners_lantern", name: "Miner's Lantern", description: "Vault relic · auto-equipped · brighter, wider underground light" },
  moss_fibre: { id: "moss_fibre", name: "Moss Fibre", description: "Soft living fibre gathered from Moss Crawlers" },
  crawler_fang: { id: "crawler_fang", name: "Crawler Fang", description: "A sharp fang shed by a defeated crawler" },
  stone_core: { id: "stone_core", name: "Stone Core", description: "A dense animated core from a Stone Brute" },
  acid_gland: { id: "acid_gland", name: "Acid Gland", description: "A volatile gland taken from a Cave Spitter" },
  fang_dagger: { id: "fang_dagger", name: "Crawler Fang Dagger", description: "A fast three-hit melee weapon" },
  stone_core_hammer: { id: "stone_core_hammer", name: "Stone Core Hammer", description: "Slow overhead smash · heavy knockback · can stagger enemy windups" },
  rootbound_hammer: { id: "rootbound_hammer", name: "Rootbound Hammer", description: "Guardian relic · heavy three-hit combo · finisher releases a binding root shockwave" },
  matriarch_edge: { id: "matriarch_edge", name: "Matriarch's Edge", description: "Crystal Matriarch relic · swift moonstone combo with a powerful finisher" },
  acid_gland_focus: { id: "acid_gland_focus", name: "Acid Gland Focus", description: "A ranged focus that fires corrosive bolts" },
  venom_focus: { id: "venom_focus", name: "Venom Focus", description: "Matriarch focus: corrosive bolts and a three-shot Venom Fan special" },
  echo_prism: { id: "echo_prism", name: "Echo Prism", description: "Silver Echo relic · quick 2-damage crystal bolts with longer reach" },
} as const;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
export const ITEM_RARITIES = {
  common: { label: "Common", order: 0 },
  uncommon: { label: "Uncommon", order: 1 },
  rare: { label: "Rare", order: 2 },
  epic: { label: "Epic", order: 3 },
  legendary: { label: "Legendary", order: 4 },
} as const;
export type ItemRarity = keyof typeof ITEM_RARITIES;
export const EQUIPMENT_RARITY = {
  leather_armour: "common",
  iron_armour: "uncommon",
  rootguard_armour: "epic",
  bastion_plate: "epic",
  forged_sword: "uncommon",
  forged_bow: "uncommon",
  forged_focus: "uncommon",
  fang_dagger: "uncommon",
  stone_core_hammer: "rare",
  rootbound_hammer: "epic",
  matriarch_edge: "legendary",
  acid_gland_focus: "uncommon",
  venom_focus: "legendary",
  echo_prism: "epic",
} as const satisfies Partial<Record<ItemId, ItemRarity>>;
export function itemRarity(itemId: string): ItemRarity {
  return Object.hasOwn(EQUIPMENT_RARITY, itemId) ? EQUIPMENT_RARITY[itemId as keyof typeof EQUIPMENT_RARITY] : "common";
}

export type EquipmentPerkId = "core_quake" | "rootfall" | "moon_arc" | "living_guard" | "bastion_ward" | "venom_bloom" | "echo_chain";
export const EQUIPMENT_PERK_ITEMS = {
  stone_core_hammer: "core_quake",
  rootbound_hammer: "rootfall",
  matriarch_edge: "moon_arc",
  rootguard_armour: "living_guard",
  bastion_plate: "bastion_ward",
  venom_focus: "venom_bloom",
  echo_prism: "echo_chain",
} as const satisfies Partial<Record<ItemId, EquipmentPerkId>>;
export function equipmentPerkStats(itemId: string, rank = 0): { id: EquipmentPerkId; name: string; detail: string; damage?: number; radius?: number; durationMs?: number; stamina?: number; cooldownMs?: number; stacks?: number; windowMs?: number } | null {
  const safeRank = Math.max(0, Math.min(3, Math.floor(rank)));
  switch (EQUIPMENT_PERK_ITEMS[itemId as keyof typeof EQUIPMENT_PERK_ITEMS]) {
    case "core_quake": {
      const radius = 1.7 + safeRank * .15, damage = 1 + Math.floor(safeRank / 2);
      return { id: "core_quake", name: "Core Quake", damage, radius, detail: `Overhead hits pulse for ${damage} damage within ${radius.toFixed(2)}m` };
    }
    case "rootfall": {
      const radius = 2.35 + safeRank * .15, damage = 1 + Math.floor(safeRank / 2), rootMs = 650 + safeRank * 75;
      return { id: "rootfall", name: "Rootfall", damage, radius, durationMs: rootMs, detail: `Combo finishers deal ${damage} damage within ${radius.toFixed(2)}m and root for ${(rootMs / 1000).toFixed(2)}s` };
    }
    case "moon_arc": {
      const radius = 2.7 + safeRank * .15, damage = 2 + Math.floor(safeRank / 2);
      return { id: "moon_arc", name: "Moon Arc", damage, radius, detail: `Third combo hits arc for ${damage} damage within ${radius.toFixed(2)}m` };
    }
    case "living_guard": {
      const stamina = 8 + safeRank * 2;
      return { id: "living_guard", name: "Living Guard", stamina, detail: `Successful guards restore ${stamina} stamina` };
    }
    case "bastion_ward": {
      const cooldownMs = 14_000 - safeRank * 1_000;
      return { id: "bastion_ward", name: "Bastion Ward", cooldownMs, detail: `Negates one unguarded hit of 3+ damage every ${cooldownMs / 1000}s` };
    }
    case "venom_bloom": {
      const damage = 2 + safeRank;
      return { id: "venom_bloom", name: "Venom Bloom", damage, stacks: 3, windowMs: 4_000, detail: `Three hits within 4s burst for ${damage} bonus damage` };
    }
    case "echo_chain": {
      const radius = 3.5 + safeRank * .25, damage = 1 + Math.ceil(safeRank / 2);
      return { id: "echo_chain", name: "Echo Chain", damage, radius, detail: `Bolts ricochet once for ${damage} damage within ${radius.toFixed(2)}m` };
    }
    default: return null;
  }
}
export const TradeRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), targetId: z.string().min(1).max(80) }),
  z.object({ action: z.literal("accept"), tradeId: z.string().max(160) }),
  z.object({ action: z.literal("cancel"), tradeId: z.string().max(160) }),
  z.object({ action: z.literal("offer"), tradeId: z.string().max(160), revision: z.number().int().nonnegative(), gold: z.number().int().min(0).max(1000000),
    items: z.array(z.object({ itemId: z.enum(Object.keys(ITEM_DEFINITIONS) as [ItemId, ...ItemId[]]), quantity: z.number().int().min(1).max(65535) })).max(8) }),
  z.object({ action: z.literal("confirm"), tradeId: z.string().max(160), revision: z.number().int().nonnegative() }),
]);
export type TradeRequest = z.infer<typeof TradeRequestSchema>;
export type TradeOffer = { gold: number; items: { itemId: ItemId; quantity: number }[] };
export type TradeUpdate = { id: string; phase: "invite" | "offer"; incoming: boolean; partner: string; revision: number;
  mine: TradeOffer; theirs: TradeOffer; mineConfirmed: boolean; theirsConfirmed: boolean; expiresAt: number;
  inventory: { itemId: ItemId; quantity: number }[]; gold: number } | null;

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
  forged_sword: { id: "forged_sword", name: "Forged Sword", tag: "melee", attackName: "Sword Combo", requiredItemId: "forged_sword" },
  forged_bow: { id: "forged_bow", name: "Forged Bow", tag: "ranged", attackName: "Bow Shot", requiredItemId: "forged_bow" },
  forged_focus: { id: "forged_focus", name: "Forged Focus", tag: "focus", attackName: "Arcane Bolt", requiredItemId: "forged_focus" },
  longsword: { id: "longsword", name: "Longsword", tag: "melee", attackName: "Sword Combo" },
  bow: { id: "bow", name: "Hunting Bow", tag: "ranged", attackName: "Bow Shot" },
  magic_focus: { id: "magic_focus", name: "Magic Focus", tag: "focus", attackName: "Arcane Bolt" },
  fang_dagger: { id: "fang_dagger", name: "Crawler Fang Dagger", tag: "melee", attackName: "Fang Flurry", requiredItemId: "fang_dagger" },
  stone_core_hammer: { id: "stone_core_hammer", name: "Stone Core Hammer", tag: "melee", attackName: "Core Smash", requiredItemId: "stone_core_hammer" },
  rootbound_hammer: { id: "rootbound_hammer", name: "Rootbound Hammer", tag: "melee", attackName: "Rootfall Smash", requiredItemId: "rootbound_hammer" },
  matriarch_edge: { id: "matriarch_edge", name: "Matriarch's Edge", tag: "melee", attackName: "Moonstone Combo", requiredItemId: "matriarch_edge" },
  acid_gland_focus: { id: "acid_gland_focus", name: "Acid Gland Focus", tag: "focus", attackName: "Corrosive Bolt", requiredItemId: "acid_gland_focus" },
  venom_focus: { id: "venom_focus", name: "Venom Focus", tag: "focus", attackName: "Venom Bolt", requiredItemId: "venom_focus" },
  echo_prism: { id: "echo_prism", name: "Echo Prism", tag: "focus", attackName: "Crystal Bolt", requiredItemId: "echo_prism" },
} as const satisfies Record<string, MainHandDefinition>;

export type MainHandId = keyof typeof MAIN_HAND_DEFINITIONS;
export function equipmentForItem(itemId: string): MainHandId | null {
  return (Object.keys(MAIN_HAND_DEFINITIONS) as MainHandId[])
    .find(id => "requiredItemId" in MAIN_HAND_DEFINITIONS[id] && (MAIN_HAND_DEFINITIONS[id] as MainHandDefinition).requiredItemId === itemId) ?? null;
}

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
  forged_sword: { combo: true, comboWindowMs: COMBO_CHAIN_WINDOW_MS, range: 2.1, minimumFacingDot: .35, projectileTravelMs: 0,
    attacks: COMBAT_ATTACKS.map(step => ({ ...step, damage: step.damage + 1 })) },
  forged_bow: { combo: false, comboWindowMs: 0, range: 9, minimumFacingDot: .92, projectileTravelMs: 160,
    attacks: [{ step: 1, durationMs: 540, impactMs: 220, damage: 2, knockback: .18 }] },
  forged_focus: { combo: false, comboWindowMs: 0, range: 7, minimumFacingDot: .58, projectileTravelMs: 230,
    attacks: [{ step: 1, durationMs: 470, impactMs: 190, damage: 2, knockback: .28 }] },
  longsword: {
    combo: true,
    comboWindowMs: COMBO_CHAIN_WINDOW_MS,
    range: 2.1,
    minimumFacingDot: 0.35,
    projectileTravelMs: 0,
    attacks: COMBAT_ATTACKS,
  },
  bow: {
    combo: false,
    comboWindowMs: 0,
    range: 9,
    minimumFacingDot: 0.92,
    projectileTravelMs: 160,
    attacks: [{ step: 1, durationMs: 540, impactMs: 220, damage: 1, knockback: 0.18 }],
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
    range: 1.65,
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
    range: 2.1,
    minimumFacingDot: 0.28,
    projectileTravelMs: 0,
    attacks: [{ step: 1, durationMs: 820, impactMs: 430, damage: 3, knockback: 1.35 }],
  },
  rootbound_hammer: {
    combo: true,
    comboWindowMs: 620,
    range: 2.25,
    minimumFacingDot: 0.24,
    projectileTravelMs: 0,
    attacks: [
      { step: 1, durationMs: 520, impactMs: 250, damage: 2, knockback: 0.42 },
      { step: 2, durationMs: 570, impactMs: 285, damage: 2, knockback: 0.62 },
      { step: 3, durationMs: 820, impactMs: 430, damage: 4, knockback: 1.25 },
    ],
  },
  matriarch_edge: { combo: true, comboWindowMs: 500, range: 2.2, minimumFacingDot: .3, projectileTravelMs: 0,
    attacks: [
      { step: 1, durationMs: 340, impactMs: 120, damage: 3, knockback: .28 },
      { step: 2, durationMs: 370, impactMs: 140, damage: 3, knockback: .42 },
      { step: 3, durationMs: 510, impactMs: 195, damage: 5, knockback: .95 },
    ] },
  acid_gland_focus: {
    combo: false,
    comboWindowMs: 0,
    range: 7.5,
    minimumFacingDot: 0.58,
    projectileTravelMs: 360,
    attacks: [{ step: 1, durationMs: 620, impactMs: 280, damage: 2, knockback: 0.22 }],
  },
  venom_focus: { combo: false, comboWindowMs: 0, range: 7.5, minimumFacingDot: .58, projectileTravelMs: 300,
    attacks: [{ step: 1, durationMs: 560, impactMs: 235, damage: 2, knockback: .22 }] },
  echo_prism: { combo: false, comboWindowMs: 0, range: 7.5, minimumFacingDot: .58, projectileTravelMs: 250,
    attacks: [{ step: 1, durationMs: 430, impactMs: 175, damage: 2, knockback: .24 }] },
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
  venom_fan: { id: "venom_fan", name: "Venom Fan", core: "volley", castType: "tap", cooldownMs: 8000, range: 6, travelMs: 450, offsets: [-18, 0, 18] },
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
  slot: z.enum(["primary", "secondary"]).optional(),
});

export const SeismicMasteryEquipRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  masteryId: z.enum(["advancing_fault", "tectonic_stand"]),
});

export const SpecialRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  specialId: z.enum(["hunters_mark", "bramble_snare", "venom_fan"]),
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
  mainHandId: z.enum(["longsword", "bow", "magic_focus", "fang_dagger", "stone_core_hammer", "rootbound_hammer", "matriarch_edge", "acid_gland_focus", "venom_focus", "echo_prism", "forged_sword", "forged_bow", "forged_focus"]),
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
  kind?: "encounter" | "portal" | "loot" | "hub" | "explore";
  showMarker?: boolean;
  objectiveId: string;
  title: string;
  detail: string;
  lootHint?: string;
  tier: number;
  recommendedLevel?: string;
  targetMobId: string;
  targetMobIds: string[];
  completedMobIds: string[];
  progressLabel?: string;
  targetX: number;
  targetY: number;
  targetZ: number;
};

export type SilverDepthsWingRewardStatus = {
  wing: "iron" | "silver";
  oreItemId: "iron_ore" | "silver_ore";
  oreQuantity: number;
  gearItemId: "bastion_plate" | "echo_prism";
  oreCollected: boolean;
  gearCollected: boolean;
  partyGearClaimed: number;
  partyGearTotal: number;
};

export type SilverDepthsCacheStatus = {
  wing: "iron" | "silver";
  x: number;
  z: number;
  itemId: "stone_core" | "acid_gland";
  quantity: number;
  opened: boolean;
  phase: "sealed" | "warning" | "fighting" | "cleared";
  guardsRemaining: number;
};

export type SilverDepthsCheckpointStatus = {
  phase: "waiting" | "open";
  readyCount: number;
  partyTotal: number;
  selfReady: boolean;
  rewardsCollected: boolean;
};

export type SilverDepthsPartyStatus = {
  phase: "active" | "wiped" | "cleared";
  stage: number;
  activeCount: number;
  partySize: number;
  members: { id: string; name: string; state: "fighting" | "reconnecting" | "fallen" | "left" }[];
};
export type SilverDepthsGateStatus = {
  seal: boolean;
  iron: boolean;
  silver: boolean;
  gallery: boolean;
  boss: boolean;
};
export const SilverDepthsPingRequestSchema = z.object({
  x: z.number().finite().min(60).max(140),
  z: z.number().finite().min(-20).max(39),
}).strict();
export type SilverDepthsPing = {
  senderId: string;
  senderName: string;
  x: number;
  z: number;
  durationMs: number;
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
  /** Rootbound finisher origin; clients render one shockwave from this hit. */
  rootShockwave?: boolean;
  /** Secondary enemy struck by the Rootbound finisher's area shockwave. */
  secondary?: boolean;
  /** Fixed equipment identity responsible for bonus damage or area impact. */
  perk?: EquipmentPerkId;
  /** Current buildup for stacking perks such as Venom Bloom. */
  perkStacks?: number;
}

export const ROOTBOUND_FINISHER = { radius: 2.35, damage: 1, rootMs: 650 } as const;

export interface CombatMiss {
  attackerId: string;
  mainHandId: MainHandId;
  comboStep: number;
}

export interface WeaponAttackReleased {
  /** Authoritative release time, used to catch up delayed presentation without replaying the flight. */
  releasedAt?: number;
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
  kind?: "rock" | "acid" | "crystal";
  releasedAt?: number;
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
  kind?: "acid" | "root";
  x: number;
  y: number;
  z: number;
  radius: number;
  expiresAt: number;
}

export interface DepthsRouteHazard {
  hazardId: string;
  kind: "falling-rock" | "crystal-pulse";
  x: number;
  y: number;
  z: number;
  radius: number;
  impactAt: number;
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
  absorbed?: boolean;
}

export interface DefenseResolved {
  playerId: string;
  mobId: string;
  guarded: boolean;
  parried: boolean;
  damage: number;
  stamina: number;
  momentumStacks: number;
  perkStaminaRestored?: number;
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
  rootbound?: boolean;
  rootDurationMs?: number;
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
  reason: "payload" | "range" | "protected" | "missing" | "collision" | "stale" | "rate" | "stamina" | "cooldown" | "compatibility" | "moving";
}

export * from "./melee-strikes.js";
