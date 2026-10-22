import { BRUTE_SLAM, SPITTER_PATTERN, crawlerRushDistance } from "@blockcraft/protocol";
export type MobArchetypeId = "moss_crawler" | "briar_crawler" | "stone_brute" | "cave_spitter" | "ridge_stalker" | "ember_hound" | "shard_sentry" | "thornbinder" | "fen_bloater" | "cinder_ram";
export const isSpitterLike = (archetype: string): boolean => archetype === "cave_spitter" || archetype === "shard_sentry";
export const isThornbinder = (archetype: string): boolean => archetype === "thornbinder";

export interface MobArchetypeDefinition {
  id: MobArchetypeId;
  name: string;
  spawn: { x: number; y: number; z: number };
  maxHealth: number;
  armor: number;
  attackKind: "melee" | "projectile";
  speed: number;
  stopDistance: number;
  minimumAttackRange: number;
  aggroRange: number;
  windupMs: number;
  recoverMs: number;
  cooldownMs: number;
  damage: number;
  lungeDistance: number;
  hitRange: number;
  projectileTravelMs: number;
  hazardDurationMs: number;
  hazardRadius: number;
  respawnMs: number;
  rewardHealth: number;
  rewardStamina: number;
}

export const MOB_ARCHETYPES: Record<MobArchetypeId, MobArchetypeDefinition> = {
  moss_crawler: {
    id: "moss_crawler",
    name: "Moss Crawler",
    spawn: { x: 40.5, y: 8, z: 15.5 },
    maxHealth: 8,
    armor: 0,
    attackKind: "melee",
    speed: 1.35,
    stopDistance: 2.1,
    minimumAttackRange: 0,
    aggroRange: 7,
    windupMs: 650,
    recoverMs: 650,
    cooldownMs: 1500,
    damage: 1,
    lungeDistance: crawlerRushDistance("moss_crawler"),
    hitRange: 2.1,
    projectileTravelMs: 0,
    hazardDurationMs: 0,
    hazardRadius: 0,
    respawnMs: 5000,
    rewardHealth: 0,
    rewardStamina: 12,
  },
  briar_crawler: {
    id: "briar_crawler",
    name: "Briar Crawler",
    spawn: { x: 37.5, y: 8, z: 17.5 },
    maxHealth: 10,
    armor: 0,
    attackKind: "melee",
    speed: 1.5,
    stopDistance: 2.3,
    minimumAttackRange: 0,
    aggroRange: 8,
    windupMs: 720,
    recoverMs: 700,
    cooldownMs: 1650,
    damage: 1,
    lungeDistance: crawlerRushDistance("briar_crawler"),
    hitRange: 2.2,
    projectileTravelMs: 0,
    hazardDurationMs: 0,
    hazardRadius: 0,
    respawnMs: 6000,
    rewardHealth: 0,
    rewardStamina: 16,
  },
  stone_brute: {
    id: "stone_brute",
    name: "Stone Brute",
    spawn: { x: 37.5, y: 8, z: 31.5 },
    maxHealth: 18,
    armor: 1,
    attackKind: "melee",
    speed: 0.72,
    stopDistance: 1.8,
    minimumAttackRange: 0,
    aggroRange: 10,
    windupMs: 1150,
    recoverMs: BRUTE_SLAM.recoveryMs,
    cooldownMs: 2400,
    damage: 2,
    lungeDistance: 0,
    hitRange: 2.75,
    projectileTravelMs: 0,
    hazardDurationMs: 0,
    hazardRadius: 0,
    respawnMs: 8500,
    rewardHealth: 1,
    rewardStamina: 35,
  },
  cave_spitter: {
    id: "cave_spitter",
    name: "Cave Spitter",
    spawn: { x: 40.5, y: 8, z: 5.5 },
    maxHealth: 6,
    armor: 0,
    attackKind: "projectile",
    speed: 1.05,
    stopDistance: 7,
    minimumAttackRange: 4.6,
    aggroRange: 10,
    windupMs: 900,
    recoverMs: 1000,
    cooldownMs: 2200,
    damage: 1,
    lungeDistance: 0,
    hitRange: 0.9,
    projectileTravelMs: SPITTER_PATTERN.travelMs,
    hazardDurationMs: 0,
    hazardRadius: 0,
    respawnMs: 6500,
    rewardHealth: 0,
    rewardStamina: 22,
  },
  ridge_stalker: {
    id: "ridge_stalker", name: "Ridge Stalker", spawn: { x: 7.5, y: 8, z: -42.5 },
    maxHealth: 9, armor: 0, attackKind: "melee", speed: 2.05,
    stopDistance: 2.15, minimumAttackRange: 0, aggroRange: 10,
    windupMs: 680, recoverMs: 850, cooldownMs: 1850, damage: 1,
    lungeDistance: crawlerRushDistance("ridge_stalker"), hitRange: 2.25,
    projectileTravelMs: 0, hazardDurationMs: 0, hazardRadius: 0,
    respawnMs: 6500, rewardHealth: 0, rewardStamina: 18,
  },
  ember_hound: {
    id: "ember_hound", name: "Ember Hound", spawn: { x: 100.5, y: 8, z: 56.5 },
    maxHealth: 8, armor: 0, attackKind: "melee", speed: 2.25,
    stopDistance: 2.05, minimumAttackRange: 0, aggroRange: 11,
    windupMs: 620, recoverMs: 900, cooldownMs: 1_900, damage: 1,
    lungeDistance: crawlerRushDistance("ember_hound"), hitRange: 2.3,
    projectileTravelMs: 0, hazardDurationMs: 0, hazardRadius: 0,
    respawnMs: 45_000, rewardHealth: 0, rewardStamina: 18,
  },
  shard_sentry: {
    id: "shard_sentry", name: "Shard Sentry", spawn: { x: 18.5, y: 8, z: -54.5 },
    maxHealth: 8, armor: 0, attackKind: "projectile", speed: .9,
    stopDistance: 8, minimumAttackRange: 5.2, aggroRange: 12,
    windupMs: 1050, recoverMs: 1100, cooldownMs: 2500, damage: 1,
    lungeDistance: 0, hitRange: .9, projectileTravelMs: SPITTER_PATTERN.travelMs,
    hazardDurationMs: 0, hazardRadius: 0,
    respawnMs: 7000, rewardHealth: 0, rewardStamina: 24,
  },
  thornbinder: {
    id: "thornbinder", name: "Greenwood Thornbinder", spawn: { x: 47.5, y: 8, z: 17.5 },
    maxHealth: 9, armor: 0, attackKind: "projectile", speed: .92,
    stopDistance: 7.5, minimumAttackRange: 4.2, aggroRange: 11,
    windupMs: 1_150, recoverMs: 1_050, cooldownMs: 3_250, damage: 0,
    lungeDistance: 0, hitRange: .9, projectileTravelMs: 900,
    hazardDurationMs: 0, hazardRadius: 0,
    respawnMs: 45_000, rewardHealth: 0, rewardStamina: 24,
  },
  fen_bloater: {
    id: "fen_bloater", name: "Fen Bloater", spawn: { x: -36.5, y: 8, z: -34.5 },
    maxHealth: 14, armor: 0, attackKind: "melee", speed: .68,
    stopDistance: 3.2, minimumAttackRange: 0, aggroRange: 9,
    windupMs: 2_000, recoverMs: 2_500, cooldownMs: 5_200, damage: 1,
    lungeDistance: 0, hitRange: 3.4, projectileTravelMs: 0,
    hazardDurationMs: 5_500, hazardRadius: 3.4,
    respawnMs: 45_000, rewardHealth: 0, rewardStamina: 28,
  },
  cinder_ram: {
    id: "cinder_ram", name: "Cinder Ram", spawn: { x: 165.5, y: 8, z: 61.5 },
    maxHealth: 18, armor: 1, attackKind: "melee", speed: 1.05,
    stopDistance: 6.4, minimumAttackRange: 0, aggroRange: 12,
    windupMs: 1_600, recoverMs: 2_100, cooldownMs: 4_800, damage: 2,
    lungeDistance: 0, hitRange: 1.2, projectileTravelMs: 0,
    hazardDurationMs: 3_800, hazardRadius: .72,
    respawnMs: 50_000, rewardHealth: 0, rewardStamina: 34,
  },
};

export function mobArchetype(value: string): MobArchetypeDefinition {
  if (value === "briar_crawler") return MOB_ARCHETYPES.briar_crawler;
  if (value === "stone_brute") return MOB_ARCHETYPES.stone_brute;
  if (value === "cave_spitter") return MOB_ARCHETYPES.cave_spitter;
  if (value === "ridge_stalker") return MOB_ARCHETYPES.ridge_stalker;
  if (value === "ember_hound") return MOB_ARCHETYPES.ember_hound;
  if (value === "shard_sentry") return MOB_ARCHETYPES.shard_sentry;
  if (value === "thornbinder") return MOB_ARCHETYPES.thornbinder;
  if (value === "fen_bloater") return MOB_ARCHETYPES.fen_bloater;
  if (value === "cinder_ram") return MOB_ARCHETYPES.cinder_ram;
  return MOB_ARCHETYPES.moss_crawler;
}

export function damageAfterArmor(rawDamage: number, armor: number, armorPiercing = false): number {
  const safeDamage = Math.max(0, Math.floor(rawDamage));
  if (safeDamage === 0) return 0;
  return armorPiercing ? safeDamage : Math.max(1, safeDamage - Math.max(0, Math.floor(armor)));
}

export function defeatReward(
  health: number,
  maxHealth: number,
  stamina: number,
  maxStamina: number,
  definition: MobArchetypeDefinition,
  rewardMultiplier = 1,
): { health: number; stamina: number; healthRestored: number; staminaRestored: number } {
  const nextHealth = Math.min(maxHealth, health + Math.round(definition.rewardHealth * rewardMultiplier));
  const nextStamina = Math.min(maxStamina, stamina + Math.round(definition.rewardStamina * rewardMultiplier));
  return {
    health: nextHealth,
    stamina: nextStamina,
    healthRestored: nextHealth - health,
    staminaRestored: Math.round(nextStamina - stamina),
  };
}
