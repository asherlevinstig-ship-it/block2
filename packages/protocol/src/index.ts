import { z } from "zod";
export { BRUTE_VOLLEY, bruteVolleyReady, bruteRockEndpoints, bruteRockLanes } from "./brute-volley.js";
export { SPITTER_PATTERN, CRYSTAL_BURST_OFFSETS, VENOM_RING_OFFSETS, MATRIARCH_PHASE, matriarchEnraged, matriarchPattern, crystalMatriarchPattern, matriarchSecondVolleyYaw, matriarchWarningLanes, spitterPattern, spitterShotOffsets, spitterShotEndpoints, spitterWarningLanes } from "./spitter-patterns.js";
export { DODGE_STAMINA_COST, DODGE_CHAIN_COST_STEP, DODGE_MAX_STAMINA_COST, DODGE_CHAIN_WINDOW_MS, DODGE_EXHAUSTION_MS, PERFECT_DODGE_COUNTER_MS, PERFECT_DODGE_STAMINA_RESTORE, dodgeChainStaminaCost, nextDodgeChain, type DodgePressureUpdate } from "./dodge-pressure.js";

// Bump the room identity when authoritative world generation changes. Colyseus
// Cloud can keep rooms from the previous rolling deployment alive, which would
// otherwise let a new client join a room still serving the old terrain.
export const WORLD_ROOM = "world-warden-gate-v159";
export const SILVER_DEPTHS_ROOM = "silver-depths-instance-v3";
export const PRACTICE_ROOM = "calling-practice-v1";
export type RoomTransfer = { room: typeof WORLD_ROOM | typeof SILVER_DEPTHS_ROOM | typeof PRACTICE_ROOM; instanceKey?: string; partySize?: number; returnFrom?: "silver-depths" | "practice"; retry?: boolean; partyTicket?: string; worldRoomId?: string };
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
  eventDetail?: string | null;
  eventVariant?: "crawler-migration" | "root-nest" | "alpha-ambush"
    | "mireback-stampede" | "toxic-bloom" | "bog-hunt" | null;
  trackingRadius?: number;
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
export const QUICK_CHAT_PHRASES = {
  hello: "Hello!",
  help: "Help me!",
  follow: "Follow me!",
  heal: "I need healing!",
  attack: "Attack this target!",
  retreat: "Retreat!",
  ready: "I'm ready!",
  thanks: "Thanks!",
} as const;
export type QuickChatId = keyof typeof QUICK_CHAT_PHRASES;
export const ChatSendSchema = z.object({ phraseId: z.enum(["hello", "help", "follow", "heal", "attack", "retreat", "ready", "thanks"]) }).strict();
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
export type LootCollectAction = "keep" | "equip" | "dismantle" | "swap";
export const LootCollectRequestSchema = z.object({
  dropId: z.string().min(1).max(160),
  // `equip` remains accepted for clients crossing a rolling deployment.
  equip: z.boolean().optional(),
  action: z.enum(["keep", "equip", "dismantle", "swap"]).optional(),
  swapItemId: z.string().optional(),
}).refine(value => value.action !== undefined || value.equip !== undefined)
  .refine(value => value.action !== "swap" || Boolean(value.swapItemId));
export type LootCollectResult = {
  ok: boolean;
  dropId: string;
  message: string;
  action?: LootCollectAction;
  itemId?: ItemId;
  goldGranted?: number;
  materialGranted?: ItemId;
  materialQuantity?: number;
  swappedItemId?: ItemId;
  swappedItemTotal?: number;
  remainingItems?: LootBagItem[];
};
export const HEALING_POTION = { price: 5, heal: 2, capacity: 3, cooldownMs: 5000 } as const;
export type PotionUpdate = { phase: "bought" | "healed" | "error"; message: string; quantity: number; gold: number; health: number; maxHealth: number; cooldownUntil: number; healed: number };
export const MINERAL_REGROWTH_MS = 120_000;
export interface MineralDepositStatus { id: string; available: number; total: number; readyAt: number | null }
export const WORLD_BOOTSTRAP_CHUNK_RADIUS = 3;
export const WORLD_STREAM_CHUNK_RADIUS = 3;

export type ServerPerformanceUpdate = {
  tickP50Ms: number;
  tickP95Ms: number;
  tickMaxMs: number;
  overBudgetPercent: number;
  activeMobs: number;
  sleepingMobs: number;
  sampleCount: number;
  tickBudgetMs: number;
};

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
  { level: 2, id: "first_power", name: "Calling Power", detail: "Your Calling's first ability unlocks; cast with G" },
  { level: 4, id: "first_special", name: "Calling Special", detail: "Your Calling's special ability unlocks; cast with F" },
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

export const BUILD_PATHS = {
  tank: { name: "Tank", role: "Hold the line", passive: "Path ranks reduce incoming damage while guarding.", adept: "FORTRESS GUARD · Guarding protects nearby allies." },
  mage: { name: "Mage", role: "Shape raw power", passive: "Path ranks shorten Power cooldowns.", adept: "ARCANE ECHO · Every third Power repeats at half strength." },
  assassin: { name: "Assassin", role: "Exploit vulnerability", passive: "Path ranks add damage against marked or weakened enemies.", adept: "SHADOWSTEP · A perfect dodge conceals you and empowers your next strike." },
  thief: { name: "Thief", role: "Escape with the prize", passive: "Path ranks improve perfect-dodge recovery and kill gold.", adept: "SMOKE DECOY · An exhausted dodge breaks nearby enemy pursuit." },
  ranger: { name: "Ranger", role: "Control the distance", passive: "Path ranks add damage to bow attacks.", adept: "PINNING SHOT · Consecutive bow hits slow, then root their target." },
  healer: { name: "Healer", role: "Keep allies standing", passive: "Path ranks strengthen your nearby-ally heal.", adept: "FIELD MEND · Heal an injured ally on G; useful healing earns boss credit." },
} as const;
export type BuildPathId = keyof typeof BUILD_PATHS;
export const CALLING_ABILITIES = {
  tank: { name: "Bulwark", cooldownMs: 18_000, description: "Brace for 5 seconds, reducing every incoming hit by 1." },
  mage: { name: "Arcane Surge", cooldownMs: 16_000, description: "Pulse nearby enemies and restore stamina." },
  assassin: { name: "Stealth", cooldownMs: 14_000, description: "Break pursuit, conceal yourself, and empower your next strike." },
  thief: { name: "Smoke Bomb", cooldownMs: 18_000, description: "Divert nearby enemies, conceal yourself, and restore 20 stamina." },
  ranger: { name: "Volley Focus", cooldownMs: 12_000, description: "Empower your next 3 ranged hits with +1 damage." },
  healer: { name: "Field Mend", cooldownMs: 15_000, description: "Restore 2 HP to a nearby injured ally (or yourself if alone)." },
} as const satisfies Record<BuildPathId, { name: string; cooldownMs: number; description: string }>;
export const CALLING_ABILITY_OPTIONS = [
  { id: "tank_bulwark", pathId: "tank", name: "Bulwark", category: "Core", unlockRank: 0, cooldownMs: 18_000, description: "Brace and reduce every incoming hit." },
  { id: "tank_challenge", pathId: "tank", name: "Challenge", category: "Utility", unlockRank: 2, cooldownMs: 20_000, description: "Provoke nearby enemies and recover stamina." },
  { id: "tank_earthbreaker", pathId: "tank", name: "Earthbreaker", category: "Aggressive", unlockRank: 3, cooldownMs: 22_000, description: "Damage and stagger all nearby enemies." },
  { id: "mage_arcane_surge", pathId: "mage", name: "Arcane Surge", category: "Core", unlockRank: 0, cooldownMs: 16_000, description: "Pulse nearby enemies and restore stamina." },
  { id: "mage_mana_shield", pathId: "mage", name: "Mana Shield", category: "Utility", unlockRank: 2, cooldownMs: 18_000, description: "Absorb attacks, charging a retaliatory pulse when the barrier shatters." },
  { id: "mage_overload", pathId: "mage", name: "Overload", category: "Aggressive", unlockRank: 3, cooldownMs: 20_000, description: "Aim at an enemy and destabilize the ground beneath it before an arcane detonation." },
  { id: "assassin_vanish", pathId: "assassin", name: "Stealth", category: "Core", unlockRank: 0, cooldownMs: 14_000, description: "Break pursuit and empower your next strike." },
  { id: "assassin_death_mark", pathId: "assassin", name: "Death Mark", category: "Utility", unlockRank: 2, cooldownMs: 16_000, description: "Fully mark the nearest enemy for execution." },
  { id: "assassin_blade_dance", pathId: "assassin", name: "Blade Dance", category: "Aggressive", unlockRank: 3, cooldownMs: 19_000, description: "Unleash rapid aimed cuts across nearby enemies." },
  { id: "thief_smoke_bomb", pathId: "thief", name: "Smoke Bomb", category: "Core", unlockRank: 0, cooldownMs: 18_000, description: "Divert nearby enemies, conceal, and recover stamina." },
  { id: "thief_decoy", pathId: "thief", name: "Decoy", category: "Utility", unlockRank: 2, cooldownMs: 20_000, description: "Divert and stagger enemies in a wide area." },
  { id: "thief_escape_artist", pathId: "thief", name: "Escape Artist", category: "Aggressive", unlockRank: 3, cooldownMs: 16_000, description: "Reset dodge exhaustion and briefly evade all damage." },
  { id: "ranger_volley_focus", pathId: "ranger", name: "Volley Focus", category: "Core", unlockRank: 0, cooldownMs: 12_000, description: "Your next three bow attacks split toward nearby enemies." },
  { id: "ranger_disengage", pathId: "ranger", name: "Disengage", category: "Utility", unlockRank: 2, cooldownMs: 15_000, description: "Leap backward and empower your next two shots." },
  { id: "ranger_deadeye", pathId: "ranger", name: "Deadeye", category: "Aggressive", unlockRank: 3, cooldownMs: 18_000, description: "Fire one precise shot at the enemy under your aim. Long shots deal more damage." },
  { id: "healer_field_mend", pathId: "healer", name: "Field Mend", category: "Core", unlockRank: 0, cooldownMs: 15_000, description: "Heal the most injured nearby ally; self-heal if no ally needs help." },
  { id: "healer_renewal", pathId: "healer", name: "Renewal", category: "Utility", unlockRank: 2, cooldownMs: 24_000, description: "Create a healing sanctuary that restores allies who hold their ground inside it." },
  { id: "healer_resurrection", pathId: "healer", name: "Resurrection", category: "Master", unlockRank: 4, cooldownMs: 90_000, description: "Channel for 2.5s beside a fallen party member to revive them with low health. Moving or taking damage interrupts the cast." },
] as const;
export type CallingAbilityId = typeof CALLING_ABILITY_OPTIONS[number]["id"];
export function callingStarterAbility(pathId: BuildPathId, slot: "power" | "special") {
  return CALLING_ABILITY_OPTIONS.find(option => option.pathId === pathId && option.category === (slot === "power" ? "Core" : "Utility"))!;
}
export const CALLING_ABILITY_AUGMENTS = [
  { id: "bulwark_guardian_wall", abilityId: "tank_bulwark", name: "Guardian Wall", unlockRank: 2, description: "+2s duration." },
  { id: "bulwark_iron_skin", abilityId: "tank_bulwark", name: "Iron Skin", unlockRank: 2, description: "Reduce each hit by 2 instead of 1." },
  { id: "challenge_mass_provocation", abilityId: "tank_challenge", name: "Mass Provocation", unlockRank: 3, description: "Greater radius and +1.5s brace." },
  { id: "challenge_rallying_cry", abilityId: "tank_challenge", name: "Rallying Cry", unlockRank: 3, description: "Recover 30 additional stamina." },
  { id: "earthbreaker_faultline", abilityId: "tank_earthbreaker", name: "Faultline", unlockRank: 4, description: "Greatly increases impact radius." },
  { id: "earthbreaker_crushing_force", abilityId: "tank_earthbreaker", name: "Crushing Force", unlockRank: 4, description: "+2 damage to every target." },
  { id: "surge_deep_reserves", abilityId: "mage_arcane_surge", name: "Deep Reserves", unlockRank: 2, description: "Restore 25 additional stamina." },
  { id: "surge_temporal_flux", abilityId: "mage_arcane_surge", name: "Temporal Flux", unlockRank: 2, description: "Also advances Special recovery by 4s." },
  { id: "shield_prismatic_layers", abilityId: "mage_mana_shield", name: "Prismatic Layers", unlockRank: 3, description: "+2 barrier charges." },
  { id: "shield_reinforced_rune", abilityId: "mage_mana_shield", name: "Reinforced Rune", unlockRank: 3, description: "Each charge prevents 2 damage." },
  { id: "overload_volatile_core", abilityId: "mage_overload", name: "Volatile Core", unlockRank: 4, description: "+2 detonation damage and +1m blast radius." },
  { id: "overload_residual_charge", abilityId: "mage_overload", name: "Residual Charge", unlockRank: 4, description: "The blast leaves a delayed damaging aftershock." },
  { id: "vanish_deep_cloak", abilityId: "assassin_vanish", name: "Deep Cloak", unlockRank: 2, description: "+2s concealment." },
  { id: "vanish_killing_intent", abilityId: "assassin_vanish", name: "Killing Intent", unlockRank: 2, description: "+2 empowered-strike damage." },
  { id: "mark_lingering_sentence", abilityId: "assassin_death_mark", name: "Lingering Sentence", unlockRank: 3, description: "+5s mark duration." },
  { id: "mark_open_wound", abilityId: "assassin_death_mark", name: "Open Wound", unlockRank: 3, description: "Marking immediately deals 2 damage." },
  { id: "dance_long_step", abilityId: "assassin_blade_dance", name: "Long Step", unlockRank: 4, description: "+2m targeting reach." },
  { id: "dance_blade_storm", abilityId: "assassin_blade_dance", name: "Blade Storm", unlockRank: 4, description: "+2 rapid cuts." },
  { id: "smoke_dense_cloud", abilityId: "thief_smoke_bomb", name: "Dense Cloud", unlockRank: 2, description: "+2s concealment." },
  { id: "smoke_second_wind", abilityId: "thief_smoke_bomb", name: "Second Wind", unlockRank: 2, description: "Restore 20 additional stamina." },
  { id: "decoy_wide_stage", abilityId: "thief_decoy", name: "Wide Stage", unlockRank: 3, description: "Greater diversion radius." },
  { id: "decoy_flash_charge", abilityId: "thief_decoy", name: "Flash Charge", unlockRank: 3, description: "+0.8s stagger." },
  { id: "escape_extended_window", abilityId: "thief_escape_artist", name: "Extended Window", unlockRank: 4, description: "+0.5s evasion." },
  { id: "escape_clean_getaway", abilityId: "thief_escape_artist", name: "Clean Getaway", unlockRank: 4, description: "Recover 1 health." },
  { id: "volley_deep_quiver", abilityId: "ranger_volley_focus", name: "Deep Quiver", unlockRank: 2, description: "+2 split volleys." },
  { id: "volley_heavy_arrows", abilityId: "ranger_volley_focus", name: "Heavy Arrows", unlockRank: 2, description: "+1 damage to every arrow in the volley." },
  { id: "disengage_long_leap", abilityId: "ranger_disengage", name: "Long Leap", unlockRank: 3, description: "Leap 2m farther." },
  { id: "disengage_evasive_roll", abilityId: "ranger_disengage", name: "Evasive Roll", unlockRank: 3, description: "+0.45s invulnerability." },
  { id: "deadeye_eagle_eye", abilityId: "ranger_deadeye", name: "Eagle Eye", unlockRank: 4, description: "+4m range and a wider precision aim." },
  { id: "deadeye_execution_rounds", abilityId: "ranger_deadeye", name: "Execution Rounds", unlockRank: 4, description: "+2 damage to the precision shot." },
] as const satisfies readonly { id: string; abilityId: CallingAbilityId; name: string; unlockRank: number; description: string }[];
export type CallingAugmentId = typeof CALLING_ABILITY_AUGMENTS[number]["id"];
export const CALLING_AUGMENT_TRIALS = {
  bulwark_guardian_wall: { description: "Brace through 8 threatened encounters.", target: 8 },
  bulwark_iron_skin: { description: "Prevent 24 damage with Bulwark.", target: 24 },
  challenge_mass_provocation: { description: "Challenge 20 nearby enemies.", target: 20 },
  challenge_rallying_cry: { description: "Recover 150 stamina with Challenge.", target: 150 },
  earthbreaker_faultline: { description: "Strike 20 enemies with Earthbreaker.", target: 20 },
  earthbreaker_crushing_force: { description: "Deal 40 Earthbreaker damage.", target: 40 },
  surge_deep_reserves: { description: "Recover 180 stamina with Arcane Surge.", target: 180 },
  surge_temporal_flux: { description: "Surge while Special is recovering 8 times.", target: 8 },
  shield_prismatic_layers: { description: "Consume 20 Mana Shield charges.", target: 20 },
  shield_reinforced_rune: { description: "Prevent 25 damage with Mana Shield.", target: 25 },
  overload_volatile_core: { description: "Deal 30 bonus damage through Overload.", target: 30 },
  overload_residual_charge: { description: "Hit 10 enemies with Overload aftershocks.", target: 10 },
  vanish_deep_cloak: { description: "Break pursuit from 15 enemies with Stealth.", target: 15 },
  vanish_killing_intent: { description: "Land 12 Stealth-empowered strikes.", target: 12 },
  mark_lingering_sentence: { description: "Expose 12 enemies with Death Mark.", target: 12 },
  mark_open_wound: { description: "Defeat 8 exposed enemies.", target: 8 },
  dance_long_step: { description: "Blade Dance near enemies 10 times.", target: 10 },
  dance_blade_storm: { description: "Catch 20 enemies inside Blade Dance.", target: 20 },
  smoke_dense_cloud: { description: "Divert 20 enemies with Smoke Bomb.", target: 20 },
  smoke_second_wind: { description: "Recover 160 stamina with Smoke Bomb.", target: 160 },
  decoy_wide_stage: { description: "Divert 25 enemies with Decoy.", target: 25 },
  decoy_flash_charge: { description: "Stagger 25 enemies with Decoy.", target: 25 },
  escape_extended_window: { description: "Escape while low on stamina 8 times.", target: 8 },
  escape_clean_getaway: { description: "Escape while wounded 10 times.", target: 10 },
  volley_deep_quiver: { description: "Land 25 Volley Focus shots.", target: 25 },
  volley_heavy_arrows: { description: "Deal 25 Volley Focus bonus damage.", target: 25 },
  disengage_long_leap: { description: "Disengage from nearby enemies 10 times.", target: 10 },
  disengage_evasive_roll: { description: "Land 15 empowered Disengage shots.", target: 15 },
  deadeye_eagle_eye: { description: "Land 15 Deadeye shots.", target: 15 },
  deadeye_execution_rounds: { description: "Deal 45 Deadeye bonus damage.", target: 45 },
} as const satisfies Record<CallingAugmentId, { description: string; target: number }>;
export const CallingAbilityEquipRequestSchema = z.object({
  abilityId: z.enum(["tank_bulwark", "tank_challenge", "tank_earthbreaker", "mage_arcane_surge", "mage_mana_shield", "mage_overload",
    "assassin_vanish", "assassin_death_mark", "assassin_blade_dance", "thief_smoke_bomb", "thief_decoy", "thief_escape_artist",
    "ranger_volley_focus", "ranger_disengage", "ranger_deadeye", "healer_field_mend", "healer_renewal", "healer_resurrection"]),
}).strict();
export const CallingAugmentEquipRequestSchema = z.object({
  augmentId: z.enum(CALLING_ABILITY_AUGMENTS.map(option => option.id) as [CallingAugmentId, ...CallingAugmentId[]]),
}).strict();
export const CallingAbilityRequestSchema = z.object({ requestId: z.string().min(1).max(80), yaw: z.number().finite().optional(), slot: z.enum(["power", "special"]).optional(), training: z.boolean().optional() }).strict();
export type CallingAbilityUpdate = {
  requestId: string;
  pathId: BuildPathId;
  abilityId: CallingAbilityId;
  slot?: "power" | "special";
  ability: string;
  detail: string;
  cooldownUntil: number;
  durationMs?: number;
  training?: boolean;
};
export type CallingAbilityEffect = {
  casterId: string;
  pathId: BuildPathId;
  abilityId: CallingAbilityId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  durationMs?: number;
  targetId?: string;
  augmentId?: CallingAugmentId;
};
export type CallingStateUpdate = {
  playerId: string;
  pathId: BuildPathId;
  abilityId: CallingAbilityId;
  phase: "active" | "clear";
  label: string;
  activeUntil?: number;
  charges?: number;
  targetId?: string;
};
export const BUILD_PATH_SPECIALIZATIONS = {
  tank: [
    { id: "guardian", name: "Guardian", role: "Extend Fortress Guard", effect: "Protect allies within 5m and prevent 2 damage.", trial: "Prevent 30 damage to allies.", trialTarget: 30, capstone: "AEGIS · Fortress Guard reaches 6m and prevents 3 damage." },
    { id: "juggernaut", name: "Juggernaut", role: "Break attackers", effect: "Every guarded hit staggers its attacker.", trial: "Stagger 20 attackers through guarding.", trialTarget: 20, capstone: "UNMOVABLE · Guard staggers last twice as long." },
  ],
  mage: [
    { id: "arcanist", name: "Arcanist", role: "Amplify the echo", effect: "Arcane Echo repeats at 75% strength.", trial: "Trigger 15 Arcane Echoes.", trialTarget: 15, capstone: "RESONANCE · Arcane Echo repeats at full strength." },
    { id: "elementalist", name: "Elementalist", role: "Bind with power", effect: "Power hits slow surviving enemies for 2 seconds.", trial: "Defeat 20 Power-slowed enemies.", trialTarget: 20, capstone: "DEEP FREEZE · Power slows are stronger and last 3 seconds." },
  ],
  assassin: [
    { id: "executioner", name: "Executioner", role: "Commit to the kill", effect: "Shadowstep's empowered strike deals +4 damage.", trial: "Land 15 empowered killing blows.", trialTarget: 15, capstone: "DEATHBLOW · Empowered killing blows restore 20 stamina." },
    { id: "phantom", name: "Phantom", role: "Disappear again", effect: "Shadowstep concealment lasts longer and hastens your Calling Power.", trial: "Strike from Shadowstep 20 times.", trialTarget: 20, capstone: "STEALTH · Shadowstep fully refreshes Calling Power." },
  ],
  thief: [
    { id: "trickster", name: "Trickster", role: "Control the pursuit", effect: "Smoke Decoy reaches farther and conceals you longer.", trial: "Divert 40 pursuing enemies.", trialTarget: 40, capstone: "GRAND ILLUSION · Smoke Decoy also staggers diverted enemies." },
    { id: "plunderer", name: "Plunderer", role: "Profit from danger", effect: "Elite and mini-boss victories grant 3 additional gold.", trial: "Earn 100 Plunderer bonus gold.", trialTarget: 100, capstone: "KING'S RANSOM · Elite and mini-boss bonus gold increases to 5." },
  ],
  ranger: [
    { id: "marksman", name: "Marksman", role: "Finish the sequence", effect: "The third Pinning Shot deals +2 damage.", trial: "Land 20 third-shot killing blows.", trialTarget: 20, capstone: "DEADEYE · Third Pinning Shots deal +4 damage." },
    { id: "trapper", name: "Trapper", role: "Hold the battlefield", effect: "Pinning slow is stronger and its root lasts 1.8 seconds.", trial: "Defeat 20 rooted enemies.", trialTarget: 20, capstone: "IRON SNARE · Roots last 2.5 seconds." },
  ],
  healer: [
    { id: "lifebinder", name: "Lifebinder", role: "Restore more health", effect: "Field Mend restores 1 additional HP.", trial: "Restore 30 HP to injured allies.", trialTarget: 30, capstone: "DEEP RESTORATION · Field Mend restores 1 more HP." },
    { id: "field_medic", name: "Field Medic", role: "Restore stamina too", effect: "Field Mend also restores 10 stamina.", trial: "Restore 100 ally stamina with Field Mend.", trialTarget: 100, capstone: "SECOND WIND · Field Mend restores 20 stamina." },
  ],
} as const;
export type BuildPathSpecializationId = typeof BUILD_PATH_SPECIALIZATIONS[BuildPathId][number]["id"];
export const BUILD_PATH_RANKS = [
  { rank: 0, name: "Untrained", xp: 0 },
  { rank: 1, name: "Initiate", xp: 10 },
  { rank: 2, name: "Adept", xp: 30 },
  { rank: 3, name: "Veteran", xp: 70 },
  { rank: 4, name: "Master", xp: 140 },
] as const;
export const BuildPathRequestSchema = z.object({ action: z.enum(["sync", "choose", "specialize"]), pathId: z.enum(["tank", "mage", "assassin", "thief", "ranger", "healer"]).optional(), specializationId: z.enum(["guardian", "juggernaut", "arcanist", "elementalist", "executioner", "phantom", "trickster", "plunderer", "marksman", "trapper", "lifebinder", "field_medic"]).optional() }).strict();
export type BuildPathAffinity = { pathId: BuildPathId; score: number; reasons: string[] };
export type BuildPathUpdate = { selectedPathId: BuildPathId | null; rank: number; xp: number; nextRankXp: number | null;
  selectedCallingAbilityId: CallingAbilityId | null;
  selectedCallingAugmentId: CallingAugmentId | null;
  callingAugmentProgress: Partial<Record<CallingAugmentId, number>>;
  masteredCallingAugments: CallingAugmentId[];
  selectedSpecializationId: BuildPathSpecializationId | null; candidates: BuildPathAffinity[]; canChoose: boolean;
  canSpecialize: boolean; masterTrial: { name: string; description: string; progress: number; target: number; complete: boolean; capstone: string } | null;
  inTown: boolean; message: string };
export type BuildPathProc = { pathId: BuildPathId; ability: string; detail: string; durationMs?: number };
export type RegionalArmourProc = { armourId: "forager_wrap" | "fenwalker_mantle" };

export const EQUIPMENT_AFFIXES = {
  fortified: { name: "Fortified", pathId: "tank", effect: "Reduces incoming damage." },
  retaliating: { name: "Retaliating", pathId: "tank", effect: "Guarding improves counter pressure." },
  protector: { name: "Protector", pathId: "tank", effect: "Strengthens ally protection." },
  echoing: { name: "Echoing", pathId: "mage", effect: "Strengthens Arcane Echo." },
  volatile: { name: "Volatile", pathId: "mage", effect: "Adds Power damage." },
  elemental: { name: "Elemental", pathId: "mage", effect: "Strengthens Power slows." },
  lethal: { name: "Lethal", pathId: "assassin", effect: "Adds damage against weakened enemies." },
  veiled: { name: "Veiled", pathId: "assassin", effect: "Extends Shadowstep concealment." },
  executioner: { name: "Executioner", pathId: "assassin", effect: "Strengthens empowered strikes." },
  elusive: { name: "Elusive", pathId: "thief", effect: "Improves perfect-dodge stamina recovery." },
  prosperous: { name: "Prosperous", pathId: "thief", effect: "Adds victory gold." },
  deceptive: { name: "Deceptive", pathId: "thief", effect: "Extends Smoke Decoy concealment." },
  piercing: { name: "Piercing", pathId: "ranger", effect: "Adds ranged damage." },
  snaring: { name: "Snaring", pathId: "ranger", effect: "Strengthens Pinning Shot control." },
  precise: { name: "Precise", pathId: "ranger", effect: "Strengthens every third Pinning Shot." },
  mending: { name: "Mending", pathId: "healer", effect: "Field Mend restores additional health." },
  consecrated: { name: "Consecrated", pathId: "healer", effect: "Renewal creates a wider, longer-lasting sanctuary." },
  soulbound: { name: "Soulbound", pathId: "healer", effect: "Resurrection channels faster and returns allies stronger." },
} as const;
export type EquipmentAffixId = keyof typeof EQUIPMENT_AFFIXES;
export type EquipmentAffixRoll = { affixId: EquipmentAffixId; tier: 1 | 2 | 3 };
export type EquipmentAffixOffers = Partial<Record<ItemId, EquipmentAffixId[]>>;
export type EquipmentAffixProc = { affixId: EquipmentAffixId; tier: number; label: string;
  x: number; y: number; z: number };
export function equipmentAffixEffect(affixId: EquipmentAffixId, tier: number): string {
  const value = Math.max(1, Math.min(4, Math.floor(tier)));
  switch (affixId) {
    case "fortified": return `Reduces incoming damage by ${value >= 3 ? 2 : 1}.`;
    case "retaliating": return `Guard counters stagger attackers ${value * 120}ms longer.`;
    case "protector": return `Ally guard radius +${(value * .3).toFixed(1)}m${value >= 2 ? " and prevents +1 damage" : ""}.`;
    case "echoing": return `Arcane Echo repeats at +${value * 8}% strength.`;
    case "volatile": return `Calling Power deals +${value} damage.`;
    case "elemental": return `Power slows last +${value * .25}s and are ${value * 5}% stronger.`;
    case "lethal": return `Deal +${value} damage to marked or weakened enemies.`;
    case "veiled": return `Shadowstep concealment lasts +${(value * .25).toFixed(2)}s.`;
    case "executioner": return `Empowered strikes deal +${value} damage.`;
    case "elusive": return `Perfect dodges restore +${value * 2} stamina.`;
    case "prosperous": return `Leader and elite victories grant +${value} gold.`;
    case "deceptive": return `Smoke Decoy concealment lasts +${(value * .2).toFixed(1)}s.`;
    case "piercing": return `Ranged attacks deal +${Math.ceil(value / 2)} damage.`;
    case "snaring": return `Pinning Shot control lasts +${(value * .2).toFixed(1)}s and is ${value * 4}% stronger.`;
    case "precise": return `Every third Pinning Shot deals +${value} damage.`;
    case "mending": return `Field Mend restores +${Math.ceil(value / 2)} health.`;
    case "consecrated": return `Renewal sanctuary gains +${(value * .35).toFixed(2)}m radius and +${(value * .5).toFixed(1)}s duration.`;
    case "soulbound": return `Resurrection channels ${(value * .15).toFixed(2)}s faster, revives with +${value * 5}% health and stamina, and grants +${(value * .25).toFixed(2)}s protection.`;
  }
}
export const EQUIPMENT_HUNT_REGIONS = {
  greenwood: { name: "Greenwood", x: 42.5, y: 8, z: 19.5, tier: 1, paths: ["assassin", "ranger", "healer"] },
  mistfen: { name: "Mistfen Marsh", x: -99.5, y: 8, z: -42.5, tier: 2, paths: ["mage", "thief", "healer"] },
  frontier: { name: "Stone Frontier", x: 68.5, y: 8, z: 34.5, tier: 3, paths: ["tank", "ranger"] },
  ashen: { name: "Ashen Reach", x: 165.5, y: 8, z: 68.5, tier: 3, paths: ["mage", "assassin"] },
  quarry: { name: "Redstone Pit", x: 8.5, y: 8, z: 171.5, tier: 3, paths: ["tank", "thief"] },
} as const satisfies Record<string, { name: string; x: number; y: number; z: number; tier: number; paths: readonly BuildPathId[] }>;
export type EquipmentHuntRegionId = keyof typeof EQUIPMENT_HUNT_REGIONS;
export type EquipmentHuntTarget = { affixId: EquipmentAffixId; regionId: EquipmentHuntRegionId; regionName: string;
  x: number; y: number; z: number; chancePercent: number };
export const EquipmentAffixHuntSchema = z.object({ affixId: z.enum(Object.keys(EQUIPMENT_AFFIXES) as [EquipmentAffixId, ...EquipmentAffixId[]]).nullable() }).strict();
export type EquipmentAffixUpdate = { affixes: Partial<Record<ItemId, EquipmentAffixRoll>>; offers?: EquipmentAffixOffers;
  dust?: number; targetAffixId?: EquipmentAffixId | null; huntTarget?: EquipmentHuntTarget | null; message: string };
export const EQUIPMENT_AFFIX_RESONANCE = {
  tank: { name: "Ironwall", effect: "Both equipped Tank affixes gain +1 effective tier." },
  mage: { name: "Spellweave", effect: "Both equipped Mage affixes gain +1 effective tier." },
  assassin: { name: "Nightfall", effect: "Both equipped Assassin affixes gain +1 effective tier." },
  thief: { name: "Ghosthand", effect: "Both equipped Thief affixes gain +1 effective tier." },
  ranger: { name: "Hawkeye", effect: "Both equipped Ranger affixes gain +1 effective tier." },
  healer: { name: "Sanctuary", effect: "Matching Healer affixes gain +1 effective tier." },
} as const satisfies Record<BuildPathId, { name: string; effect: string }>;

/** A weapon and armour resonate when their attunements support the same classless Calling. */
export function equipmentAffixResonanceForLoadout(mainHandItemId: string | null, armourItemId: string | null,
  affixes: Partial<Record<ItemId, EquipmentAffixRoll>>): BuildPathId | null {
  if (!mainHandItemId || !armourItemId || !Object.hasOwn(ITEM_DEFINITIONS, mainHandItemId)
    || !Object.hasOwn(ITEM_DEFINITIONS, armourItemId)) return null;
  const weapon = affixes[mainHandItemId as ItemId], armour = affixes[armourItemId as ItemId];
  if (!weapon || !armour) return null;
  const weaponPath = EQUIPMENT_AFFIXES[weapon.affixId].pathId;
  return EQUIPMENT_AFFIXES[armour.affixId].pathId === weaponPath ? weaponPath : null;
}

export const TAVERN_QUIZ_STARTING_COINS = 20;
export const TAVERN_QUIZ_MAX_STAKE = 10;
export const TAVERN_QUIZ_MAX_PAYOUT = 1024;
export const IRON_ORE_GOLD_PRICE = 3;
export const SILVER_ORE_GOLD_PRICE = 8;
export const EMBER_ORE_GOLD_PRICE = 10;
export const BLACKSMITH_UPGRADES = {
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", price: 12, ironOre: 0, description: "Auto-equipped tool · extract 2 minerals from every ore block" },
  iron_sword: { id: "iron_sword", name: "Iron Sword", price: 45, ironOre: 0, description: "Upgrades and equips your longsword · +1 sword damage" },
  miners_pack: { id: "miners_pack", name: "Miner's Pack", price: 25, ironOre: 0, description: "Carry up to 30 of each mineral instead of 12" },
  moonstone_edge: { id: "moonstone_edge", name: "Moonstone Edge", price: 0, ironOre: 0, description: "Expedition reward · permanently adds +1 damage to every weapon" },
  explorer_pack: { id: "explorer_pack", name: "Explorer's Pack", price: 75, ironOre: 8, silverOre: 0, description: "Expand your backpack from 12 to 16 slots" },
  adventurer_pack: { id: "adventurer_pack", name: "Adventurer's Pack", price: 160, ironOre: 12, silverOre: 8, description: "Expand your backpack from 16 to 20 slots" },
} as const;
export type BlacksmithUpgradeId = keyof typeof BLACKSMITH_UPGRADES;
export const BlacksmithForgeSchema = z.object({ upgradeId: z.enum(["reinforced_pickaxe", "iron_sword", "miners_pack", "moonstone_edge", "explorer_pack", "adventurer_pack"]) });
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
  wanderer_robes: { name: "Wanderer's Robes", reduction: 0, speed: 1.03, projectileReduction: 0, hazardReduction: 0 },
  leather_armour: { name: "Leather Armour", reduction: 1, speed: 1, projectileReduction: 0, hazardReduction: 0 },
  forager_wrap: { name: "Forager Wrap", reduction: 1, speed: 1.03, projectileReduction: 0, hazardReduction: 0 },
  fenwalker_mantle: { name: "Fenwalker Mantle", reduction: 1, speed: 1.01, projectileReduction: 1, hazardReduction: 1 },
  quarry_hauberk: { name: "Quarry Hauberk", reduction: 2, speed: .9, projectileReduction: 1, hazardReduction: 0 },
  ridgeguard_mantle: { name: "Ridgeguard Mantle", reduction: 1, speed: .98, projectileReduction: 1, hazardReduction: 0 },
  iron_armour: { name: "Iron Armour", reduction: 2, speed: .92, projectileReduction: 0, hazardReduction: 0 },
  rootguard_armour: { name: "Rootguard Armour", reduction: 1, speed: .98, projectileReduction: 2, hazardReduction: 2 },
  bastion_plate: { name: "Bastion Plate", reduction: 2, speed: .94, projectileReduction: 0, hazardReduction: 1 },
  fangstalker_wrap: { name: "Fangstalker Wrap", reduction: 1, speed: 1.06, projectileReduction: 0, hazardReduction: 0 },
  venomweave_mantle: { name: "Venomweave Mantle", reduction: 1, speed: .99, projectileReduction: 2, hazardReduction: 2 },
  mirebreaker_mantle: { name: "Mirebreaker Mantle", reduction: 2, speed: 1.02, projectileReduction: 2, hazardReduction: 3 },
  rootstalker_wrap: { name: "Rootstalker Wrap", reduction: 1, speed: 1.07, projectileReduction: 1, hazardReduction: 2 },
  northwatch_cloak: { name: "Northwatch Cloak", reduction: 1, speed: 1.04, projectileReduction: 1, hazardReduction: 0 },
  worldsplitter_plate: { name: "Worldsplitter Plate", reduction: 3, speed: .9, projectileReduction: 1, hazardReduction: 2 },
  ashguard_mantle: { name: "Ashguard Mantle", reduction: 2, speed: 1.02, projectileReduction: 2, hazardReduction: 3 },
} as const;
export type ArmourId = keyof typeof ARMOUR_DEFINITIONS;
export function armourForItem(id: string): Exclude<ArmourId, "none"> | null {
  return id === "wanderer_robes" || id === "leather_armour" || id === "forager_wrap" || id === "fenwalker_mantle" || id === "quarry_hauberk" || id === "ridgeguard_mantle" || id === "iron_armour" || id === "rootguard_armour" || id === "bastion_plate"
    || id === "fangstalker_wrap" || id === "venomweave_mantle" || id === "mirebreaker_mantle" || id === "rootstalker_wrap" || id === "northwatch_cloak" || id === "worldsplitter_plate" || id === "ashguard_mantle" ? id : null;
}
export function utilityForItem(id: string): "miners_lantern" | "moonstone" | null { return id === "miners_lantern" || id === "moonstone" ? id : null; }
export function isEquipmentItem(id: string): boolean { return equipmentForItem(id) !== null || armourForItem(id) !== null || utilityForItem(id) !== null; }
export const ArmourEquipSchema = z.object({ armourId: z.enum(["none", "wanderer_robes", "leather_armour", "forager_wrap", "fenwalker_mantle", "quarry_hauberk", "ridgeguard_mantle", "iron_armour", "rootguard_armour", "bastion_plate", "fangstalker_wrap", "venomweave_mantle", "mirebreaker_mantle", "rootstalker_wrap", "northwatch_cloak", "worldsplitter_plate", "ashguard_mantle"]) });
export const BLACKSMITH_STOCK = { ...BLACKSMITH_WEAPONS, leather_armour: { price: 30 }, iron_armour: { price: 70 } } as const;
export type BlacksmithStockId = keyof typeof BLACKSMITH_STOCK;
export const BlacksmithBuySchema = z.object({ itemId: z.enum(["forged_sword", "forged_bow", "forged_focus", "leather_armour", "iron_armour"]) });
export const BLACKSMITH_DISMANTLE = {
  forged_sword: { gold: 14 }, forged_bow: { gold: 16 }, forged_focus: { gold: 18 },
  leather_armour: { gold: 8 }, forager_wrap: { gold: 5, materialId: "moss_fibre", materialQuantity: 1 },
  fenwalker_mantle: { gold: 6, materialId: "acid_gland", materialQuantity: 1 }, iron_armour: { gold: 20 },
  quarry_hauberk: { gold: 10, materialId: "iron_ore", materialQuantity: 1 },
  ridgeguard_mantle: { gold: 8, materialId: "ridge_hide", materialQuantity: 1 },
  fang_dagger: { gold: 3, materialId: "crawler_fang", materialQuantity: 1 },
  stone_core_hammer: { gold: 6, materialId: "stone_core", materialQuantity: 1 },
  rootbound_hammer: { gold: 16, materialId: "timber", materialQuantity: 2 },
  matriarch_edge: { gold: 22, materialId: "moonstone", materialQuantity: 1 },
  acid_gland_focus: { gold: 6, materialId: "acid_gland", materialQuantity: 1 },
  venom_focus: { gold: 16, materialId: "acid_gland", materialQuantity: 2 },
  echo_prism: { gold: 18, materialId: "silver_ore", materialQuantity: 1 },
  rootguard_armour: { gold: 14, materialId: "moss_fibre", materialQuantity: 2 },
  bastion_plate: { gold: 18, materialId: "stone_core", materialQuantity: 1 },
  fangstalker_wrap: { gold: 12, materialId: "crawler_fang", materialQuantity: 2 },
  venomweave_mantle: { gold: 14, materialId: "acid_gland", materialQuantity: 2 },
  mirebreaker_mantle: { gold: 26, materialId: "acid_gland", materialQuantity: 3 },
  rootstalker_wrap: { gold: 24, materialId: "moss_fibre", materialQuantity: 3 },
  northwatch_cloak: { gold: 15, materialId: "ridge_hide", materialQuantity: 2 },
  worldsplitter_plate: { gold: 18, materialId: "stone_core", materialQuantity: 2 },
  cinderfang_blade: { gold: 28, materialId: "ember_ore", materialQuantity: 2 },
  ashguard_mantle: { gold: 28, materialId: "ember_ore", materialQuantity: 2 },
  emberheart_focus: { gold: 28, materialId: "ember_ore", materialQuantity: 2 },
} as const satisfies Partial<Record<ItemId, { gold: number; materialId?: ItemId; materialQuantity?: number }>>;
export type BlacksmithDismantleItemId = keyof typeof BLACKSMITH_DISMANTLE;
export const BlacksmithDismantleSchema = z.object({ itemId: z.enum(Object.keys(BLACKSMITH_DISMANTLE) as [BlacksmithDismantleItemId, ...BlacksmithDismantleItemId[]]) });
export const BlacksmithHaulSchema = z.object({ action: z.enum(["salvage_duplicates", "store_materials"]) }).strict();
export type BlacksmithHaulAction = z.infer<typeof BlacksmithHaulSchema>["action"];
export const REGIONAL_FORGE_RECIPES = {
  greenwood: {
    name: "Greenwood Rootstalker Forge", rankName: "Rootslayer", itemId: "rootstalker_wrap", marks: 5, gold: 80,
    materials: [{ itemId: "moss_fibre", quantity: 12 }, { itemId: "timber", quantity: 8 }, { itemId: "crawler_fang", quantity: 6 }],
  },
  mistfen: {
    name: "Mistfen Mirebreaker Forge", rankName: "Mirebreaker", itemId: "mirebreaker_mantle", marks: 5, gold: 90,
    materials: [{ itemId: "acid_gland", quantity: 12 }, { itemId: "silver_ore", quantity: 8 }, { itemId: "moss_fibre", quantity: 4 }],
  },
} as const;
export type RegionalForgeId = keyof typeof REGIONAL_FORGE_RECIPES;
export type RegionalMarkCounts = Record<RegionalForgeId, number>;
export const RegionalForgeSchema = z.object({ region: z.enum(["greenwood", "mistfen"]) }).strict();
export const ASHEN_FORGE_RECIPES = {
  cinderfang: { blueprint: "cinderfang", itemId: "cinderfang_blade", name: "Cinderfang Blade", gold: 85,
    materials: [{ itemId: "ember_ore", quantity: 8 }, { itemId: "stone_core", quantity: 4 }] },
  ashguard: { blueprint: "ashguard", itemId: "ashguard_mantle", name: "Ashguard Mantle", gold: 85,
    materials: [{ itemId: "ember_ore", quantity: 7 }, { itemId: "iron_ore", quantity: 6 }] },
  emberheart: { blueprint: "emberheart", itemId: "emberheart_focus", name: "Emberheart Focus", gold: 85,
    materials: [{ itemId: "ember_ore", quantity: 8 }, { itemId: "silver_ore", quantity: 4 }] },
} as const;
export type AshenBlueprintId = keyof typeof ASHEN_FORGE_RECIPES;
export const AshenForgeSchema = z.object({ blueprint: z.enum(["cinderfang", "ashguard", "emberheart"]) }).strict();
export const ASHEN_MASTERY_MAX = 60;
export const ASHEN_MASTERY_BRANCHES = {
  cinderfang: {
    wildfire: { name: "Wildfire Edge", detail: "Cinder Ignite splashes fire into nearby enemies." },
    execution: { name: "Execution Flame", detail: "Cinder Ignite deals +2 damage to enemies below 35% health." },
  },
  ashguard: {
    phoenix: { name: "Phoenix Ward", detail: "Perfect dodges extend the ward to 4s and restore 15 stamina." },
    shelter: { name: "Sheltering Embers", detail: "Perfect dodges also ward nearby party members." },
  },
  emberheart: {
    inferno: { name: "Inferno Heart", detail: "Your Emberheart field grants +2 damage instead of +1." },
    hearth: { name: "Hearthfire", detail: "Emberheart fields are 1.5m wider and last 2s longer." },
  },
} as const;
export type AshenMasteryBranchId = keyof typeof ASHEN_MASTERY_BRANCHES.cinderfang
  | keyof typeof ASHEN_MASTERY_BRANCHES.ashguard | keyof typeof ASHEN_MASTERY_BRANCHES.emberheart;
export type AshenMasteryProgress = Partial<Record<AshenBlueprintId, { xp: number; branch?: AshenMasteryBranchId }>>;
export const AshenMasteryChooseSchema = z.object({
  blueprint: z.enum(["cinderfang", "ashguard", "emberheart"]),
  branch: z.enum(["wildfire", "execution", "phoenix", "shelter", "inferno", "hearth"]),
}).strict();
/** Short, optional exploration-to-gear bridge before mastery-gated legendary forging. */
export const FIELD_FORGE_RECIPES = {
  greenwood: { itemId: "forager_wrap", gold: 12,
    materials: [{ itemId: "moss_fibre", quantity: 2 }, { itemId: "timber", quantity: 1 }] },
  mistfen: { itemId: "fenwalker_mantle", gold: 16,
    materials: [{ itemId: "crawler_fang", quantity: 1 }, { itemId: "acid_gland", quantity: 1 }] },
  quarry: { itemId: "quarry_hauberk", gold: 28,
    materials: [{ itemId: "iron_ore", quantity: 2 }, { itemId: "stone_core", quantity: 1 }] },
  northwatch: { itemId: "ridgeguard_mantle", gold: 24,
    materials: [{ itemId: "ridge_hide", quantity: 2 }, { itemId: "iron_ore", quantity: 2 }] },
} as const satisfies Record<"greenwood" | "mistfen" | "quarry" | "northwatch", { itemId: ItemId; gold: number; materials: readonly { itemId: ItemId; quantity: number }[] }>;
export type FieldForgeId = keyof typeof FIELD_FORGE_RECIPES;
export const FieldForgeSchema = z.object({ region: z.enum(["greenwood", "mistfen", "quarry", "northwatch"]) }).strict();
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
  fangstalker_wrap: { materialId: "crawler_fang", costs: [{ gold: 16, material: 3 }, { gold: 34, material: 6 }, { gold: 68, material: 10 }] },
  venomweave_mantle: { materialId: "acid_gland", costs: [{ gold: 18, material: 3 }, { gold: 38, material: 6 }, { gold: 74, material: 10 }] },
  mirebreaker_mantle: { materialId: "acid_gland", costs: [{ gold: 28, material: 4 }, { gold: 58, material: 7 }, { gold: 110, material: 12 }] },
  rootstalker_wrap: { materialId: "moss_fibre", costs: [{ gold: 26, material: 4 }, { gold: 54, material: 7 }, { gold: 105, material: 12 }] },
  northwatch_cloak: { materialId: "ridge_hide", costs: [{ gold: 18, material: 2 }, { gold: 38, material: 4 }, { gold: 75, material: 7 }] },
  worldsplitter_plate: { materialId: "stone_core", costs: [{ gold: 24, material: 3 }, { gold: 52, material: 6 }, { gold: 98, material: 10 }] },
  cinderfang_blade: { materialId: "ember_ore", costs: [{ gold: 28, material: 3 }, { gold: 58, material: 6 }, { gold: 110, material: 10 }] },
  ashguard_mantle: { materialId: "ember_ore", costs: [{ gold: 28, material: 3 }, { gold: 58, material: 6 }, { gold: 110, material: 10 }] },
  emberheart_focus: { materialId: "ember_ore", costs: [{ gold: 28, material: 3 }, { gold: 58, material: 6 }, { gold: 110, material: 10 }] },
} as const satisfies Partial<Record<ItemId, { materialId: ItemId; costs: readonly { gold: number; material: number }[] }>>;
export type BlacksmithReforgeItemId = keyof typeof BLACKSMITH_REFORGE;
export type EquipmentReforgeRanks = Partial<Record<BlacksmithReforgeItemId, number>>;
export const BlacksmithReforgeSchema = z.object({ itemId: z.enum(Object.keys(BLACKSMITH_REFORGE) as [BlacksmithReforgeItemId, ...BlacksmithReforgeItemId[]]) });
export const AttunementForgeSchema = z.object({
  action: z.enum(["reroll", "focus", "upgrade", "choose"]),
  itemId: z.enum(Object.keys(BLACKSMITH_REFORGE) as [BlacksmithReforgeItemId, ...BlacksmithReforgeItemId[]]),
  affixId: z.enum(Object.keys(EQUIPMENT_AFFIXES) as [EquipmentAffixId, ...EquipmentAffixId[]]).optional(),
}).strict();
export type AttunementForgeAction = z.infer<typeof AttunementForgeSchema>;
export const ATTUNEMENT_DUST_YIELD = { 1: 1, 2: 3, 3: 6 } as const;
export const ATTUNEMENT_REROLL_COST = { 1: 3, 2: 6, 3: 10 } as const;
export const ATTUNEMENT_FOCUS_COST = { 1: 9, 2: 18, 3: 30 } as const;
export const ATTUNEMENT_UPGRADE_COST = { 1: 6, 2: 12 } as const;
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
  phase: "idle" | "traded" | "purchased" | "dismantled" | "reforged" | "attuned" | "awakened" | "exchanged" | "regional-forged" | "haul" | "error";
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
  attunementDust?: number;
  attunementAffixes?: Partial<Record<ItemId, EquipmentAffixRoll>>;
  attunementOffers?: EquipmentAffixOffers;
  selectedBuildPathId?: BuildPathId | null;
  equippedMainHandItemId?: ItemId | null;
  equippedArmourItemId?: ItemId | null;
  leaderRelics?: Partial<Record<AreaLeaderRelicId, number>>;
  leaderMarks?: Partial<Record<LeaderForgemarkId, number>>;
  regionalMarks?: RegionalMarkCounts;
  regionalMasteryRanks?: RegionalMarkCounts;
  ashenBlueprints?: AshenBlueprintId[];
  ashenMastery?: AshenMasteryProgress;
  materialGranted?: ItemId;
  materialQuantity?: number;
  sold?: number;
  goldGranted?: number;
  haulDuplicateItems?: number;
  haulDuplicateGold?: number;
  haulMaterialItems?: number;
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
  wanderer_robes: { id: "wanderer_robes", name: "Wanderer's Robes", description: "Light starter robes · move 3% faster · equip from your pack" },
  leather_armour: { id: "leather_armour", name: "Leather Armour", description: "Reduce damage by 1 (minimum hit 1) · full movement speed" },
  forager_wrap: { id: "forager_wrap", name: "Forager Wrap", description: "Greenwood field armour · reduce damage by 1 · move 3% faster · recover stamina faster in Greenwood" },
  fenwalker_mantle: { id: "fenwalker_mantle", name: "Fenwalker Mantle", description: "Mistfen field armour · reduce damage by 1 · 1% faster · extra projectile protection · wards off alternating marsh-pool pulses" },
  quarry_hauberk: { id: "quarry_hauberk", name: "Quarry Hauberk", description: "Southern Quarry field armour · reduce damage by 2 · extra protection from rock volleys and other projectiles · 10% slower" },
  ridgeguard_mantle: { id: "ridgeguard_mantle", name: "Ridgeguard Mantle", description: "Northwatch field armour · reduce damage by 1 · extra projectile protection · deflects one Shard Sentry shot every 8s in Northwatch · 2% slower" },
  iron_armour: { id: "iron_armour", name: "Iron Armour", description: "Reduce damage by 2 (minimum hit 1) · 8% slower movement" },
  rootguard_armour: { id: "rootguard_armour", name: "Rootguard Armour", description: "Reduce damage by 1 · extra protection from projectiles and hazards · 2% slower" },
  bastion_plate: { id: "bastion_plate", name: "Bastion Plate", description: "Iron Bastion relic · reduce damage by 2 · extra protection from hazards · 6% slower" },
  fangstalker_wrap: { id: "fangstalker_wrap", name: "Fangstalker Wrap", description: "Rare Fang Hunt armour · reduce damage by 1 · 6% faster movement for close combo pressure" },
  venomweave_mantle: { id: "venomweave_mantle", name: "Venomweave Mantle", description: "Rare Venom Hunt armour · reduce damage by 1 · strong projectile and hazard protection" },
  mirebreaker_mantle: { id: "mirebreaker_mantle", name: "Mirebreaker Mantle", description: "Legendary Mistfen armour · swift movement · exceptional protection from venom pools and projectiles" },
  rootstalker_wrap: { id: "rootstalker_wrap", name: "Rootstalker Wrap", description: "Legendary Greenwood armour · rapid movement and stamina recovery · strong protection from root pressure" },
  northwatch_cloak: { id: "northwatch_cloak", name: "Northwatch Cloak", description: "Watchbreaker reward · reduce damage by 1 · 4% faster movement · extra projectile protection · deflects one Shard Sentry shot every 8s in Northwatch · reforge with Ridge Hide" },
  worldsplitter_plate: { id: "worldsplitter_plate", name: "Worldsplitter Plate", description: "Rare Crusher Hunt armour · reduce damage by 3 · heavy projectile and hazard protection · 10% slower" },
  cinderfang_blade: { id: "cinderfang_blade", name: "Cinderfang Blade", description: "Ashen regional blade · strikes against staggered enemies ignite for bonus damage" },
  ashguard_mantle: { id: "ashguard_mantle", name: "Ashguard Mantle", description: "Ashen regional armour · a perfect dodge grants brief fire, hazard and projectile protection" },
  emberheart_focus: { id: "emberheart_focus", name: "Emberheart Focus", description: "Ashen regional focus · Calling abilities empower nearby allies inside an ember field" },
  forged_sword: { id: "forged_sword", name: "Forged Sword", description: "Iron blade · 2 / 2 / 3 combo damage · equip from your pack" },
  forged_bow: { id: "forged_bow", name: "Forged Bow", description: "Steel-braced bow · 2 arrow damage · equip from your pack" },
  forged_focus: { id: "forged_focus", name: "Forged Focus", description: "Smith-made focus · 2 bolt damage · equip from your pack" },
  healing_potion: { id: "healing_potion", name: "Healing Potion", description: "Restore 2 HP · H to drink · carry up to 3" },
  iron_ore: { id: "iron_ore", name: "Iron Ore", description: "Mined iron ore that can be sold to the town blacksmith" },
  silver_ore: { id: "silver_ore", name: "Silver Ore", description: "Wilderness mineral · sell to the blacksmith for 8 gold each" },
  ember_ore: { id: "ember_ore", name: "Ember Ore", description: "Ashen Reach mineral · sell to the blacksmith for 10 gold each" },
  moonstone: { id: "moonstone", name: "Moonstone", description: "Silver Depths reward mineral used for permanent attunements" },
  ember_core: { id: "ember_core", name: "Ember Core", description: "Forge Colossus currency · earned from ranked Ember Vault clears" },
  timber: { id: "timber", name: "Greenwood Timber", description: "Fresh oak timber · combine with Moss Fibre for a Forager Wrap at the blacksmith" },
  reinforced_pickaxe: { id: "reinforced_pickaxe", name: "Reinforced Pickaxe", description: "Forged mining tool that extracts two minerals per ore block" },
  miners_lantern: { id: "miners_lantern", name: "Miner's Lantern", description: "Vault relic · auto-equipped · brighter, wider underground light" },
  moss_fibre: { id: "moss_fibre", name: "Moss Fibre", description: "Soft living fibre · forge a Forager Wrap with Greenwood Timber" },
  crawler_fang: { id: "crawler_fang", name: "Crawler Fang", description: "A sharp fang · combine with an Acid Gland for a Fenwalker Mantle" },
  ridge_hide: { id: "ridge_hide", name: "Ridge Hide", description: "Northwatch Stalker hide · forge a Ridgeguard Mantle or reforge the Watchbreaker's cloak" },
  stone_core: { id: "stone_core", name: "Stone Core", description: "A dense animated core · forge a Quarry Hauberk or heavier gear at the blacksmith" },
  acid_gland: { id: "acid_gland", name: "Acid Gland", description: "A volatile spitter gland · forge a Fenwalker Mantle with a Crawler Fang" },
  mossback_fang_relic: { id: "mossback_fang_relic", name: "Mossback Alpha Fang", description: "Unique trophy claimed from the Mossback Alpha" },
  westroad_fang_relic: { id: "westroad_fang_relic", name: "Westroad Alpha Fang", description: "Unique trophy claimed from the Westroad Alpha" },
  northroad_fang_relic: { id: "northroad_fang_relic", name: "Northroad Alpha Fang", description: "Unique trophy claimed from the Northroad Alpha" },
  broodmother_heart: { id: "broodmother_heart", name: "Broodmother Heart", description: "Unique living trophy claimed from the Greenwood Broodmother" },
  silverfang_venom_sac: { id: "silverfang_venom_sac", name: "Silverfang Venom Sac", description: "Unique trophy claimed from the Silverfang Spitter" },
  gloomfang_venom_sac: { id: "gloomfang_venom_sac", name: "Gloomfang Venom Sac", description: "Unique trophy claimed from the Gloomfang Spitter" },
  stonehide_core_relic: { id: "stonehide_core_relic", name: "Stonehide Heart-Core", description: "Unique trophy claimed from the Stonehide Crusher" },
  ruinbreaker_keystone: { id: "ruinbreaker_keystone", name: "Ruinbreaker Keystone", description: "Unique trophy claimed from the Ruinbreaker" },
  warleader_crest: { id: "warleader_crest", name: "Frontier Warleader Crest", description: "Unique trophy claimed from the Frontier Warleader" },
  ashglass_lens: { id: "ashglass_lens", name: "Ashglass Sentry Lens", description: "Unique trophy claimed from the Ashglass High Sentry" },
  westroad_pack_totem: { id: "westroad_pack_totem", name: "Westroad Pack Totem", description: "Unique trophy claimed from the roaming Westroad Packleader" },
  northroad_pack_totem: { id: "northroad_pack_totem", name: "Northroad Pack Totem", description: "Unique trophy claimed from the roaming Northroad Packleader" },
  gloam_alpha_gland: { id: "gloam_alpha_gland", name: "Gloam Alpha Gland", description: "Unique trophy claimed from the roaming Gloam Spitter Alpha" },
  sunscar_alpha_gland: { id: "sunscar_alpha_gland", name: "Sunscar Alpha Gland", description: "Unique trophy claimed from the roaming Sunscar Spitter Alpha" },
  ironburrow_crown: { id: "ironburrow_crown", name: "Ironburrow Crown", description: "Unique underground trophy claimed from the Ironburrow Alpha" },
  broodspitter_focus_shard: { id: "broodspitter_focus_shard", name: "Broodspitter Focus Shard", description: "Unique underground trophy claimed from the Silver Chamber Broodspitter" },
  stone_warden_lantern: { id: "stone_warden_lantern", name: "Stone Warden Lantern", description: "Unique vault trophy claimed from the Stone Warden" },
  frontier_champion_crest: { id: "frontier_champion_crest", name: "Frontier Champion Crest", description: "Unique trophy claimed from the Frontier Stone Champion" },
  mireback_crown: { id: "mireback_crown", name: "Mireback Crown", description: "Unique venom-soaked trophy claimed from the Mireback Behemoth" },
  quarrymaster_sigil: { id: "quarrymaster_sigil", name: "Quarrymaster Sigil", description: "Unique redstone trophy claimed from the Redstone Quarrymaster" },
  watchbreaker_crest: { id: "watchbreaker_crest", name: "Watchbreaker Crest", description: "Unique highland trophy claimed from the Northwatch Watchbreaker · awaken a Crusher Forgemark at the leader forge" },
  alpha_forgemark: { id: "alpha_forgemark", name: "Alpha Forgemark", description: "Leader collection badge · awakens Fang Dagger finishers with +1 damage" },
  venom_forgemark: { id: "venom_forgemark", name: "Venom Forgemark", description: "Leader collection badge · every third Acid Focus hit surges for +1 damage" },
  crusher_forgemark: { id: "crusher_forgemark", name: "Crusher Forgemark", description: "Leader collection badge · Stone Hammer attacks deal +1 damage to staggered enemies" },
  fang_dagger: { id: "fang_dagger", name: "Crawler Fang Dagger", description: "A fast three-hit melee weapon" },
  stone_core_hammer: { id: "stone_core_hammer", name: "Stone Core Hammer", description: "Slow overhead smash · heavy knockback · can stagger enemy windups" },
  rootbound_hammer: { id: "rootbound_hammer", name: "Rootbound Hammer", description: "Guardian relic · heavy three-hit combo · finisher releases a binding root shockwave" },
  matriarch_edge: { id: "matriarch_edge", name: "Matriarch's Edge", description: "Crystal Matriarch relic · swift moonstone combo with a powerful finisher" },
  acid_gland_focus: { id: "acid_gland_focus", name: "Acid Gland Focus", description: "A ranged focus that fires corrosive bolts" },
  venom_focus: { id: "venom_focus", name: "Venom Focus", description: "Matriarch focus: corrosive bolts and a three-shot Venom Fan special" },
  echo_prism: { id: "echo_prism", name: "Echo Prism", description: "Silver Echo relic · quick 2-damage crystal bolts with longer reach" },
} as const;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
export const REGIONAL_LEADER_COLLECTIONS = {
  greenwood: { name: "Greenwood Leader Set", leaderName: "Greenwood Broodmother", badgeName: "Rootbound Crest",
    items: [{ itemId: "forged_bow" }, { itemId: "fang_dagger" }, { itemId: "forager_wrap" }, { itemId: "rootstalker_wrap", minRematchTier: 3 }] },
  mistfen: { name: "Mistfen Leader Set", leaderName: "Mireback Behemoth", badgeName: "Mireborn Crest",
    items: [{ itemId: "forged_focus" }, { itemId: "acid_gland_focus" }, { itemId: "fenwalker_mantle" }, { itemId: "mirebreaker_mantle", minRematchTier: 3 }] },
  quarry: { name: "Quarry Leader Set", leaderName: "Redstone Quarrymaster", badgeName: "Quarry Crest",
    items: [{ itemId: "stone_core_hammer" }, { itemId: "forged_sword" }, { itemId: "quarry_hauberk" }, { itemId: "bastion_plate", minRematchTier: 3 }] },
  northwatch: { name: "Northwatch Leader Set", leaderName: "Northwatch Watchbreaker", badgeName: "Watchbreaker Crest",
    items: [{ itemId: "forged_bow" }, { itemId: "fang_dagger" }, { itemId: "ridgeguard_mantle" }, { itemId: "northwatch_cloak", minRematchTier: 2 }] },
  frontier: { name: "Frontier Leader Set", leaderName: "Frontier Warleader", badgeName: "Warleader Crest",
    items: [{ itemId: "stone_core_hammer" }, { itemId: "forged_sword" }, { itemId: "iron_armour" }, { itemId: "worldsplitter_plate", minRematchTier: 3 }] },
  ashen: { name: "Ashen Leader Set", leaderName: "Ashglass High Sentry", badgeName: "Ashglass Crest",
    items: [{ itemId: "cinderfang_blade" }, { itemId: "ashguard_mantle" }, { itemId: "emberheart_focus" }, { itemId: "worldsplitter_plate", minRematchTier: 3 }] },
} as const satisfies Record<string, { name: string; leaderName: string; badgeName: string;
  items: readonly { itemId: ItemId; minRematchTier?: number }[] }>;
export type RegionalLeaderCollectionId = keyof typeof REGIONAL_LEADER_COLLECTIONS;
export const HUNT_EQUIPMENT_SETS = {
  fang: { name: "Fangstalker", weaponId: "fang_dagger", armourId: "fangstalker_wrap",
    bonus: "Finishers restore 12 stamina and deal +2 damage to enemies below 30% health" },
  venom: { name: "Venomweave", weaponId: "acid_gland_focus", armourId: "venomweave_mantle",
    bonus: "Every third bolt creates a 3 second poison pool and reduces Special cooldown by 1.5s" },
  crusher: { name: "Worldsplitter", weaponId: "stone_core_hammer", armourId: "worldsplitter_plate",
    bonus: "Hits on staggered enemies release a shockwave and grant +1 armour for 3 seconds" },
} as const satisfies Record<string, { name: string; weaponId: ItemId; armourId: ItemId; bonus: string }>;
export type HuntSetId = keyof typeof HUNT_EQUIPMENT_SETS;
export function huntSetForLoadout(mainHandId: string, armourId: string): HuntSetId | null {
  for (const [setId, set] of Object.entries(HUNT_EQUIPMENT_SETS))
    if (set.weaponId === mainHandId && set.armourId === armourId) return setId as HuntSetId;
  return null;
}
export function huntSetForItem(itemId: string): HuntSetId | null {
  for (const [setId, set] of Object.entries(HUNT_EQUIPMENT_SETS))
    if (set.weaponId === itemId || set.armourId === itemId) return setId as HuntSetId;
  return null;
}
export const AREA_LEADER_RELIC_IDS = [
  "mossback_fang_relic", "westroad_fang_relic", "northroad_fang_relic", "broodmother_heart",
  "silverfang_venom_sac", "gloomfang_venom_sac", "stonehide_core_relic", "ruinbreaker_keystone",
  "warleader_crest", "ashglass_lens", "westroad_pack_totem", "northroad_pack_totem",
  "gloam_alpha_gland", "sunscar_alpha_gland", "ironburrow_crown", "broodspitter_focus_shard",
  "stone_warden_lantern", "frontier_champion_crest", "mireback_crown", "quarrymaster_sigil", "watchbreaker_crest",
] as const satisfies readonly ItemId[];
export type AreaLeaderRelicId = typeof AREA_LEADER_RELIC_IDS[number];
export const LEADER_FORGE_MARKS = {
  alpha_forgemark: { weaponId: "fang_dagger", name: "Alpha Fang", perk: "Combo finishers deal +1 damage" },
  venom_forgemark: { weaponId: "acid_gland_focus", name: "Venom Surge", perk: "Every third bolt deals +1 damage" },
  crusher_forgemark: { weaponId: "stone_core_hammer", name: "Crusher Break", perk: "Hits against staggered enemies deal +1 damage" },
} as const;
export type LeaderForgemarkId = keyof typeof LEADER_FORGE_MARKS;
const leaderForgeRecipe = (markId: LeaderForgemarkId) => ({ markId, weaponId: LEADER_FORGE_MARKS[markId].weaponId, relics: 3 as const, exchangeGold: 12 as const });
export const LEADER_FORGE_RECIPES = {
  mossback_fang_relic: leaderForgeRecipe("alpha_forgemark"), westroad_fang_relic: leaderForgeRecipe("alpha_forgemark"),
  northroad_fang_relic: leaderForgeRecipe("alpha_forgemark"), broodmother_heart: leaderForgeRecipe("alpha_forgemark"),
  westroad_pack_totem: leaderForgeRecipe("alpha_forgemark"), northroad_pack_totem: leaderForgeRecipe("alpha_forgemark"),
  ironburrow_crown: leaderForgeRecipe("alpha_forgemark"),
  silverfang_venom_sac: leaderForgeRecipe("venom_forgemark"), gloomfang_venom_sac: leaderForgeRecipe("venom_forgemark"),
  ashglass_lens: leaderForgeRecipe("venom_forgemark"), gloam_alpha_gland: leaderForgeRecipe("venom_forgemark"),
  sunscar_alpha_gland: leaderForgeRecipe("venom_forgemark"), broodspitter_focus_shard: leaderForgeRecipe("venom_forgemark"),
  mireback_crown: leaderForgeRecipe("venom_forgemark"),
  stonehide_core_relic: leaderForgeRecipe("crusher_forgemark"), ruinbreaker_keystone: leaderForgeRecipe("crusher_forgemark"),
  warleader_crest: leaderForgeRecipe("crusher_forgemark"), stone_warden_lantern: leaderForgeRecipe("crusher_forgemark"),
  frontier_champion_crest: leaderForgeRecipe("crusher_forgemark"),
  quarrymaster_sigil: leaderForgeRecipe("crusher_forgemark"),
  watchbreaker_crest: leaderForgeRecipe("crusher_forgemark"),
} as const satisfies Record<AreaLeaderRelicId, { markId: LeaderForgemarkId; weaponId: "fang_dagger" | "acid_gland_focus" | "stone_core_hammer"; relics: 3; exchangeGold: 12 }>;
export const LeaderForgeSchema = z.object({ relicId: z.enum(AREA_LEADER_RELIC_IDS), action: z.enum(["awaken", "exchange"]) });
/** Capacity used when collecting a floor drop into the carried inventory. */
export function lootCarryCapacity(itemId: ItemId, mineralCapacity: number): number {
  if (itemId === "healing_potion") return HEALING_POTION.capacity;
  if (itemId === "iron_ore" || itemId === "silver_ore" || itemId === "ember_ore") return mineralCapacity;
  return 65_535;
}
export const ITEM_RARITIES = {
  common: { label: "Common", order: 0 },
  uncommon: { label: "Uncommon", order: 1 },
  rare: { label: "Rare", order: 2 },
  epic: { label: "Epic", order: 3 },
  legendary: { label: "Legendary", order: 4 },
} as const;
export type ItemRarity = keyof typeof ITEM_RARITIES;
export const EQUIPMENT_RARITY = {
  wanderer_robes: "common",
  leather_armour: "common",
  forager_wrap: "uncommon",
  fenwalker_mantle: "uncommon",
  quarry_hauberk: "uncommon",
  ridgeguard_mantle: "uncommon",
  iron_armour: "uncommon",
  rootguard_armour: "epic",
  bastion_plate: "epic",
  fangstalker_wrap: "rare",
  venomweave_mantle: "rare",
  mirebreaker_mantle: "legendary",
  rootstalker_wrap: "legendary",
  northwatch_cloak: "rare",
  worldsplitter_plate: "rare",
  cinderfang_blade: "legendary",
  ashguard_mantle: "legendary",
  emberheart_focus: "legendary",
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
  mossback_fang_relic: "rare",
  westroad_fang_relic: "rare",
  northroad_fang_relic: "rare",
  broodmother_heart: "epic",
  silverfang_venom_sac: "epic",
  gloomfang_venom_sac: "epic",
  stonehide_core_relic: "rare",
  ruinbreaker_keystone: "epic",
  warleader_crest: "epic",
  ashglass_lens: "epic",
  westroad_pack_totem: "rare",
  northroad_pack_totem: "rare",
  gloam_alpha_gland: "rare",
  sunscar_alpha_gland: "rare",
  ironburrow_crown: "rare",
  broodspitter_focus_shard: "epic",
  stone_warden_lantern: "epic",
  frontier_champion_crest: "epic",
  mireback_crown: "epic",
  quarrymaster_sigil: "epic",
  watchbreaker_crest: "epic",
  alpha_forgemark: "legendary",
  venom_forgemark: "legendary",
  crusher_forgemark: "legendary",
} as const satisfies Partial<Record<ItemId, ItemRarity>>;
export function itemRarity(itemId: string): ItemRarity {
  return Object.hasOwn(EQUIPMENT_RARITY, itemId) ? EQUIPMENT_RARITY[itemId as keyof typeof EQUIPMENT_RARITY] : "common";
}

export type LootBagTier = "brown" | "pink" | "blue" | "purple" | "white";
export type LootBagItem = { itemId: ItemId; quantity: number };
const LOOT_BAG_TIER_ORDER: Record<LootBagTier, number> = { brown: 0, pink: 1, blue: 2, purple: 3, white: 4 };

export function lootBagTierForItem(itemId: ItemId): LootBagTier {
  const rarity = itemRarity(itemId);
  if (rarity === "legendary") return "white";
  if (rarity === "epic" || itemId === "moonstone" || itemId === "ember_core") return "purple";
  if (rarity === "rare") return "blue";
  if (isEquipmentItem(itemId) || rarity === "uncommon") return "pink";
  return "brown";
}

export function lootBagTierForItems(items: readonly LootBagItem[]): LootBagTier {
  return items.reduce<LootBagTier>((tier, item) => {
    const next = lootBagTierForItem(item.itemId);
    return LOOT_BAG_TIER_ORDER[next] > LOOT_BAG_TIER_ORDER[tier] ? next : tier;
  }, "brown");
}

export function normalizeLootBagItems(items: readonly LootBagItem[]): LootBagItem[] {
  const quantities = new Map<ItemId, number>();
  for (const item of items) {
    if (!Object.hasOwn(ITEM_DEFINITIONS, item.itemId)) continue;
    const quantity = Math.max(0, Math.min(65_535, Math.floor(item.quantity)));
    if (quantity > 0) quantities.set(item.itemId, Math.min(65_535, (quantities.get(item.itemId) ?? 0) + quantity));
  }
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export function encodeLootBagItems(items: readonly LootBagItem[]): string {
  return JSON.stringify(normalizeLootBagItems(items));
}

export function decodeLootBagItems(contentsJson: string, fallbackItemId?: string, fallbackQuantity = 1): LootBagItem[] {
  if (contentsJson) {
    try {
      const parsed = JSON.parse(contentsJson) as unknown;
      if (Array.isArray(parsed)) return normalizeLootBagItems(parsed.flatMap(value => {
        if (!value || typeof value !== "object") return [];
        const entry = value as { itemId?: unknown; quantity?: unknown };
        return typeof entry.itemId === "string" && Object.hasOwn(ITEM_DEFINITIONS, entry.itemId) && typeof entry.quantity === "number"
          ? [{ itemId: entry.itemId as ItemId, quantity: entry.quantity }] : [];
      }));
    } catch { /* Fall back to the legacy single-item fields. */ }
  }
  return fallbackItemId && Object.hasOwn(ITEM_DEFINITIONS, fallbackItemId)
    ? normalizeLootBagItems([{ itemId: fallbackItemId as ItemId, quantity: fallbackQuantity }]) : [];
}

export function lootBagRepresentative(items: readonly LootBagItem[]): LootBagItem | null {
  return [...normalizeLootBagItems(items)].sort((a, b) => {
    const tier = LOOT_BAG_TIER_ORDER[lootBagTierForItem(b.itemId)] - LOOT_BAG_TIER_ORDER[lootBagTierForItem(a.itemId)];
    if (tier !== 0) return tier;
    return ITEM_RARITIES[itemRarity(b.itemId)].order - ITEM_RARITIES[itemRarity(a.itemId)].order;
  })[0] ?? null;
}

export type EquipmentPerkId = "core_quake" | "rootfall" | "moon_arc" | "living_guard" | "bastion_ward" | "venom_bloom" | "echo_chain" | "cinder_ignite" | "emberheart_field"
  | "alpha_finish" | "venom_surge" | "crusher_break" | "fang_set" | "venom_set" | "crusher_set";
export const EQUIPMENT_PERK_ITEMS = {
  stone_core_hammer: "core_quake",
  rootbound_hammer: "rootfall",
  matriarch_edge: "moon_arc",
  rootguard_armour: "living_guard",
  bastion_plate: "bastion_ward",
  venom_focus: "venom_bloom",
  echo_prism: "echo_chain",
  fangstalker_wrap: "fang_set",
  venomweave_mantle: "venom_set",
  worldsplitter_plate: "crusher_set",
  cinderfang_blade: "cinder_ignite",
  emberheart_focus: "emberheart_field",
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
    case "cinder_ignite": {
      const damage = 2 + Math.floor(safeRank / 2);
      return { id: "cinder_ignite", name: "Cinder Ignite", damage, detail: `Hits against staggered enemies ignite for ${damage} bonus damage` };
    }
    case "emberheart_field": {
      const durationMs = 4_000 + safeRank * 500, radius = 3.5 + safeRank * .25;
      return { id: "emberheart_field", name: "Emberheart Field", damage: 1, radius, durationMs,
        detail: `Calling abilities create a ${(durationMs / 1000).toFixed(1)}s field; allies inside deal +1 damage` };
    }
    case "fang_set": return { id: "fang_set", name: "Fangstalker Set", detail: HUNT_EQUIPMENT_SETS.fang.bonus, stamina: 12, damage: 2 };
    case "venom_set": return { id: "venom_set", name: "Venomweave Set", detail: HUNT_EQUIPMENT_SETS.venom.bonus, damage: 1, radius: 2.1, durationMs: 3_000, cooldownMs: 1_500 };
    case "crusher_set": return { id: "crusher_set", name: "Worldsplitter Set", detail: HUNT_EQUIPMENT_SETS.crusher.bonus, damage: 1, radius: 2.6, durationMs: 3_000 };
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
  unarmed: { id: "unarmed", name: "Bare Hands", tag: "melee", attackName: "Punch" },
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
  cinderfang_blade: { id: "cinderfang_blade", name: "Cinderfang Blade", tag: "melee", attackName: "Cinder Combo", requiredItemId: "cinderfang_blade" },
  emberheart_focus: { id: "emberheart_focus", name: "Emberheart Focus", tag: "focus", attackName: "Ember Bolt", requiredItemId: "emberheart_focus" },
} as const satisfies Record<string, MainHandDefinition>;

export type MainHandId = keyof typeof MAIN_HAND_DEFINITIONS;
export function equipmentForItem(itemId: string): MainHandId | null {
  return (Object.keys(MAIN_HAND_DEFINITIONS) as MainHandId[])
    .find(id => "requiredItemId" in MAIN_HAND_DEFINITIONS[id] && (MAIN_HAND_DEFINITIONS[id] as MainHandDefinition).requiredItemId === itemId) ?? null;
}

export const BACKPACK_BASE_SLOTS = 12;
export const BACKPACK_EXPLORER_SLOTS = 16;
export const BACKPACK_ADVENTURER_SLOTS = 20;
export const BACKPACK_STACK_SIZE = 25;
export const BACKPACK_UPGRADE_BITS = { explorer_pack: 512, adventurer_pack: 1024 } as const;

export function backpackCapacity(upgradeFlags: number): number {
  if ((upgradeFlags & BACKPACK_UPGRADE_BITS.adventurer_pack) !== 0) return BACKPACK_ADVENTURER_SLOTS;
  if ((upgradeFlags & BACKPACK_UPGRADE_BITS.explorer_pack) !== 0) return BACKPACK_EXPLORER_SLOTS;
  return BACKPACK_BASE_SLOTS;
}

/** Number of real backpack slots occupied by one item type. Potions use their own pouch. */
export function backpackSlotsForItem(itemId: ItemId, quantity: number, mainHandId: MainHandId, armourId: ArmourId): number {
  if (itemId === "healing_potion" || quantity <= 0) return 0;
  const weapon = equipmentForItem(itemId);
  const armour = armourForItem(itemId);
  const equippedCopies = weapon === mainHandId || armour === armourId ? 1 : 0;
  const carried = Math.max(0, Math.floor(quantity) - equippedCopies);
  return weapon || armour ? carried : Math.ceil(carried / BACKPACK_STACK_SIZE);
}

export function backpackSlotsUsed(quantityForItem: (itemId: ItemId) => number,
  mainHandId: MainHandId, armourId: ArmourId): number {
  return (Object.keys(ITEM_DEFINITIONS) as ItemId[]).reduce((slots, itemId) =>
    slots + backpackSlotsForItem(itemId, quantityForItem(itemId), mainHandId, armourId), 0);
}

/** Largest part of a pickup that fits after applying stack and equipped-item rules. */
export function backpackAddableQuantity(quantityForItem: (itemId: ItemId) => number, itemId: ItemId, desired: number,
  mainHandId: MainHandId, armourId: ArmourId, capacity = BACKPACK_BASE_SLOTS): number {
  const wanted = Math.max(0, Math.floor(desired));
  if (wanted === 0 || itemId === "healing_potion") return wanted;
  const before = quantityForItem(itemId);
  let low = 0, high = wanted;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const used = backpackSlotsUsed(id => id === itemId ? before + middle : quantityForItem(id), mainHandId, armourId);
    if (used <= capacity) low = middle;
    else high = middle - 1;
  }
  return low;
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
  unarmed: { combo: false, comboWindowMs: 0, range: 1.2, minimumFacingDot: .5, projectileTravelMs: 0,
    attacks: [{ step: 1, durationMs: 600, impactMs: 280, damage: 1, knockback: .05 }] },
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
  cinderfang_blade: { combo: true, comboWindowMs: 480, range: 2.15, minimumFacingDot: .32, projectileTravelMs: 0,
    attacks: [
      { step: 1, durationMs: 330, impactMs: 115, damage: 2, knockback: .26 },
      { step: 2, durationMs: 360, impactMs: 135, damage: 2, knockback: .38 },
      { step: 3, durationMs: 500, impactMs: 190, damage: 3, knockback: .82 },
    ] },
  emberheart_focus: { combo: false, comboWindowMs: 0, range: 8, minimumFacingDot: .58, projectileTravelMs: 260,
    attacks: [{ step: 1, durationMs: 460, impactMs: 185, damage: 2, knockback: .3 }] },
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

// Reserved for a later equipment-specific design; existing saved selections remain dormant.
export const WEAPON_TECHNIQUES_AVAILABLE = false;
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

// Reserved for a later item-driven system; F currently belongs to the Calling.
export const FIELD_TECHNIQUES_AVAILABLE = false;
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
  // Ordered client simulation steps. The server replays these against its own
  // collision world instead of guessing the path from a held final direction.
  steps: z.array(z.object({
    strafe: z.number().finite().min(-1).max(1),
    forward: z.number().finite().min(-1).max(1),
    dtMs: z.number().finite().min(0).max(50),
  })).max(12).optional(),
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
  actionAt: z.number().finite().optional(),
});

export const DodgeRequestSchema = z.object({
  requestId: z.string().min(1).max(64),
  strafe: z.number().finite().min(-1).max(1),
  forward: z.number().finite().min(-1).max(1),
  yaw: z.number().finite(),
  actionAt: z.number().finite().optional(),
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
  mainHandId: z.enum(["unarmed", "longsword", "bow", "magic_focus", "fang_dagger", "stone_core_hammer", "rootbound_hammer", "matriarch_edge", "acid_gland_focus", "venom_focus", "echo_prism", "forged_sword", "forged_bow", "forged_focus"]),
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
  kind?: "encounter" | "miniboss" | "hunt" | "portal" | "loot" | "hub" | "explore";
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

export const RealmHuntBoardRequestSchema = z.object({
  action: z.enum(["sync", "select", "contract"]),
  mobId: z.string().max(80).optional(),
  pathId: z.enum(["fang", "venom", "crusher"]).optional(),
  difficulty: z.enum(["normal", "veteran", "ascendant"]).optional(),
}).strict();
export const HuntCollectionRequestSchema = z.object({
  action: z.enum(["sync", "save", "equip", "claim"]),
  slot: z.number().int().min(1).max(3).optional(),
  name: z.string().max(18).optional(),
}).strict();
export type RealmHuntDifficulty = "normal" | "veteran" | "ascendant";
export type RealmHuntStatus = {
  mobId: string;
  name: string;
  territory: string;
  status: "alive" | "recovering" | "empowered";
  respawnSeconds: number;
  rematchTier: number;
  modifier: string;
  relicId: AreaLeaderRelicId;
  relicName: string;
  relicCount: number;
  awakened: boolean;
  forgeName: string;
  targetX: number;
  targetY: number;
  targetZ: number;
};
export type RealmHuntContractStatus = {
  pathId: "fang" | "venom" | "crusher";
  pathName: string;
  forgeName: string;
  step: number;
  required: number;
  targetMobId: string;
  targetName: string;
  modifier: string;
  tier: number;
  championActive: boolean;
  championName: string;
  completed: boolean;
  failed: boolean;
  difficulty: RealmHuntDifficulty;
  livesRemaining: number;
  elapsedMs: number;
};
export type RealmHuntMasteryStatus = { rank: number; bestTimesMs: Partial<Record<RealmHuntDifficulty, number>>;
  veteranUnlocked: boolean; ascendantUnlocked: boolean };
export type RealmHuntBoardUpdate = { selectedMobId: string; hunts: RealmHuntStatus[]; contract: RealmHuntContractStatus | null;
  mastery: Record<"fang" | "venom" | "crusher", RealmHuntMasteryStatus>; message: string };
export type HuntLoadoutSlot = { slot: 1 | 2 | 3; name: string; mainHandId: MainHandId; armourId: ArmourId;
  equippedPower: PowerId; equippedPowerSecondary: PowerId; equippedSpecial: SpecialId; equippedTrait: TraitId;
  seismicMastery: SeismicMasteryId; buildPathId: BuildPathId | null };
export type HuntCollectionUpdate = {
  loadouts: HuntLoadoutSlot[];
  mastery: Record<HuntSetId, RealmHuntMasteryStatus>;
  sets: Record<HuntSetId, { weaponOwned: boolean; armourOwned: boolean; forgemarkOwned: boolean }>;
  rewardClaimed: boolean; canClaim: boolean; inTown: boolean; message: string;
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

export type AreaLeaderExposed = {
  mobId: string;
  durationMs: number;
  reason?: "follower" | "charge" | "pack-interrupt" | "volley-interrupt" | "formation-interrupt";
  armourSegments?: number;
};

export type AreaLeaderReinforcements = {
  mobId: string;
  count: number;
  durationMs: number;
};

export type AreaLeaderFormation = {
  mobId: string;
  state: "forming" | "full" | "pin" | "crossfire" | "broken";
  tactic?: "surround" | "venom-lock" | "breach" | "ram-advance" | "ashglass-crossfire" | "pack-collapse";
  durationMs: number;
  originX?: number;
  originY?: number;
  originZ?: number;
  chargeYaw?: number;
  chargeDistance?: number;
  crawlerX?: number;
  crawlerY?: number;
  crawlerZ?: number;
  crawlerYaw?: number;
  crawlerDistance?: number;
  crossfireX?: number;
  crossfireY?: number;
  crossfireZ?: number;
  crossfireRadius?: number;
  bruteTargetId?: string;
  bruteTargetX?: number;
  bruteTargetY?: number;
  bruteTargetZ?: number;
  crawlerTargetId?: string;
  crawlerTargetX?: number;
  crawlerTargetY?: number;
  crawlerTargetZ?: number;
  spitterTargetId?: string;
  spitterTargetX?: number;
  spitterTargetY?: number;
  spitterTargetZ?: number;
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
  /** Guaranteed bonus consumed by the first weapon hit after a perfect dodge. */
  dodgeCounterBonus?: number;
  /** Rootbound finisher origin; clients render one shockwave from this hit. */
  rootShockwave?: boolean;
  /** Secondary enemy struck by the Rootbound finisher's area shockwave. */
  secondary?: boolean;
  /** Fixed equipment identity responsible for bonus damage or area impact. */
  perk?: EquipmentPerkId;
  /** Current buildup for stacking perks such as Venom Bloom. */
  perkStacks?: number;
  /** Active two-piece Hunt set that modified this hit. */
  setBonus?: HuntSetId;
  setBonusDamage?: number;
  staminaRestored?: number;
  cooldownReducedMs?: number;
}

export const ROOTBOUND_FINISHER = { radius: 2.35, damage: 1, rootMs: 650 } as const;

export interface CombatMiss {
  attackerId: string;
  mainHandId: MainHandId;
  comboStep: number;
}

/** Owner-only diagnostics; never changes combat authority or outcomes. */
export interface CombatTimingEvent {
  requestId: string;
  action: "attack" | "dodge" | "defense" | "power" | "special" | "calling";
  phase: "accepted" | "released" | "resolved";
  serverTime: number;
  scheduledAt?: number;
  outcome?: "hit" | "miss" | "cancelled" | "applied";
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
  kind?: "rock" | "acid" | "crystal" | "vine";
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

export interface ThornBindingUpdate {
  bindingId: string;
  mobId: string;
  targetId: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
  expiresAt: number;
  phase: "applied" | "damaged" | "broken" | "expired";
  breakerId?: string;
}

export interface MobHazardPlaced {
  hazardId: string;
  mobId: string;
  kind?: "acid" | "root" | "pressure" | "toxic-cloud" | "fire-trail";
  x: number;
  y: number;
  z: number;
  radius: number;
  expiresAt: number;
  cue?: string;
}

export interface CinderRamImpact {
  mobId: string;
  phase: "impact" | "weakspot";
  exposedUntil: number;
  durationMs: number;
}

export type AshenReliquaryChoice = "weapon" | "armour" | "focus" | "gold";
export interface AshenReliquaryState {
  phase: "sealed" | "unlocked" | "cooldown";
  defeated: number;
  required: number;
  eligible: boolean;
  claimed: boolean;
  blueprintChoiceRequired: boolean;
  blueprints: AshenBlueprintId[];
  expiresAt: number;
  cooldownUntil: number;
  x: number;
  y: number;
  z: number;
}
export interface AshenReliquaryResult {
  ok: boolean;
  message: string;
  choice?: AshenReliquaryChoice;
}
export interface AshenEquipmentForged {
  blueprint: AshenBlueprintId;
  itemId: ItemId;
  name: string;
  description: string;
}

export interface FenBloaterGlandHit {
  mobId: string;
  attackerId: string;
  hits: number;
  required: number;
  interrupted: boolean;
  staggerMs: number;
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
  absorbedBy?: "bastion" | "northwatch";
  wardCooldownMs?: number;
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

export const MISTFEN_MASTERY_CAP = 150;
export const MISTFEN_MASTERY_RANKS = [
  { rank: 1, name: "PATHFINDER", threshold: 5, reward: "Marsh routes charted" },
  { rank: 2, name: "MARSH HUNTER", threshold: 40, reward: "Bonus marsh materials" },
  { rank: 3, name: "MIREBREAKER", threshold: 100, reward: "Enhanced Mireback caches" },
] as const;
export type MistfenMasteryRank = 0 | 1 | 2 | 3;

export function mistfenMasteryRank(points: number, discovered = false): MistfenMasteryRank {
  if (!discovered) return 0;
  const score = Math.max(0, Math.floor(points));
  if (score >= 100) return 3;
  if (score >= 40) return 2;
  return 1;
}

export const GREENWOOD_MASTERY_CAP = 150;
export const GREENWOOD_MASTERY_RANKS = [
  { rank: 1, name: "TRAILFINDER", threshold: 5, reward: "Camps and timber groves charted" },
  { rank: 2, name: "PACKBREAKER", threshold: 40, reward: "Elite crawler packs and improved materials" },
  { rank: 3, name: "ROOTSLAYER", threshold: 100, reward: "Empowered Broodmother rematches" },
] as const;
export function greenwoodMasteryRank(points: number, discovered = false): 0 | 1 | 2 | 3 {
  if (!discovered) return 0;
  const score = Math.max(0, Math.floor(points));
  return score >= 100 ? 3 : score >= 40 ? 2 : 1;
}
export function greenwoodMasteryStatus(points: number, discovered = false) {
  const score = Math.min(GREENWOOD_MASTERY_CAP, Math.max(0, Math.floor(points)));
  const rank = greenwoodMasteryRank(score, discovered);
  if (!rank) return { rank, name: "UNDISCOVERED", points: score, nextThreshold: 5, progress: 0, reward: "Enter Greenwood" };
  const current = GREENWOOD_MASTERY_RANKS[rank - 1]!;
  const next = rank === 1 ? GREENWOOD_MASTERY_RANKS[1] : rank === 2 ? GREENWOOD_MASTERY_RANKS[2] : undefined;
  const ceiling = next?.threshold ?? GREENWOOD_MASTERY_CAP;
  return { rank, name: current.name, points: score, nextThreshold: ceiling,
    progress: rank === 3 ? score / GREENWOOD_MASTERY_CAP : (score - current.threshold) / Math.max(1, ceiling - current.threshold),
    reward: next?.reward ?? current.reward };
}

export function mistfenMasteryStatus(points: number, discovered = false): {
  rank: MistfenMasteryRank; name: string; points: number; nextThreshold: number; progress: number; reward: string;
} {
  const score = Math.min(MISTFEN_MASTERY_CAP, Math.max(0, Math.floor(points)));
  const rank = mistfenMasteryRank(score, discovered);
  if (rank === 0) return { rank, name: "UNDISCOVERED", points: score, nextThreshold: 5, progress: 0, reward: "Enter Mistfen Marsh" };
  const current = MISTFEN_MASTERY_RANKS[rank - 1]!;
  const next = rank === 1 ? MISTFEN_MASTERY_RANKS[1] : rank === 2 ? MISTFEN_MASTERY_RANKS[2] : undefined;
  const floor = current.threshold;
  const ceiling = next?.threshold ?? MISTFEN_MASTERY_CAP;
  return { rank, name: current.name, points: score, nextThreshold: ceiling,
    progress: rank === 3 ? score / MISTFEN_MASTERY_CAP : (score - floor) / Math.max(1, ceiling - floor),
    reward: next?.reward ?? current.reward };
}

export * from "./melee-strikes.js";
