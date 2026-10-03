export type MobArchetypeId = "moss_crawler" | "stone_brute" | "cave_spitter";

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
    spawn: { x: 24.5, y: 8, z: 14.5 },
    maxHealth: 8,
    armor: 0,
    attackKind: "melee",
    speed: 1.35,
    stopDistance: 1.35,
    minimumAttackRange: 0,
    aggroRange: 7,
    windupMs: 650,
    recoverMs: 450,
    cooldownMs: 1100,
    damage: 1,
    lungeDistance: 0.85,
    hitRange: 2.1,
    projectileTravelMs: 0,
    hazardDurationMs: 0,
    hazardRadius: 0,
    respawnMs: 5000,
    rewardHealth: 0,
    rewardStamina: 12,
  },
  stone_brute: {
    id: "stone_brute",
    name: "Stone Brute",
    spawn: { x: 21.5, y: 8, z: 19.5 },
    maxHealth: 18,
    armor: 1,
    attackKind: "melee",
    speed: 0.72,
    stopDistance: 1.8,
    minimumAttackRange: 0,
    aggroRange: 10,
    windupMs: 1150,
    recoverMs: 850,
    cooldownMs: 2400,
    damage: 2,
    lungeDistance: 0.45,
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
    spawn: { x: 25.5, y: 8, z: 5.5 },
    maxHealth: 6,
    armor: 0,
    attackKind: "projectile",
    speed: 1.05,
    stopDistance: 7,
    minimumAttackRange: 4.6,
    aggroRange: 10,
    windupMs: 900,
    recoverMs: 520,
    cooldownMs: 1850,
    damage: 1,
    lungeDistance: 0,
    hitRange: 0.9,
    projectileTravelMs: 650,
    hazardDurationMs: 3200,
    hazardRadius: 1.3,
    respawnMs: 6500,
    rewardHealth: 0,
    rewardStamina: 22,
  },
};

export function mobArchetype(value: string): MobArchetypeDefinition {
  if (value === "stone_brute") return MOB_ARCHETYPES.stone_brute;
  if (value === "cave_spitter") return MOB_ARCHETYPES.cave_spitter;
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
