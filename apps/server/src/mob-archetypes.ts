export type MobArchetypeId = "moss_crawler" | "stone_brute";

export interface MobArchetypeDefinition {
  id: MobArchetypeId;
  name: string;
  spawn: { x: number; y: number; z: number };
  maxHealth: number;
  armor: number;
  speed: number;
  stopDistance: number;
  aggroRange: number;
  windupMs: number;
  recoverMs: number;
  cooldownMs: number;
  damage: number;
  lungeDistance: number;
  hitRange: number;
  respawnMs: number;
  rewardHealth: number;
  rewardStamina: number;
}

export const MOB_ARCHETYPES: Record<MobArchetypeId, MobArchetypeDefinition> = {
  moss_crawler: {
    id: "moss_crawler",
    name: "Moss Crawler",
    spawn: { x: 13.5, y: 8, z: 11.5 },
    maxHealth: 8,
    armor: 0,
    speed: 1.35,
    stopDistance: 1.35,
    aggroRange: 7,
    windupMs: 650,
    recoverMs: 450,
    cooldownMs: 1100,
    damage: 1,
    lungeDistance: 0.85,
    hitRange: 2.1,
    respawnMs: 5000,
    rewardHealth: 0,
    rewardStamina: 12,
  },
  stone_brute: {
    id: "stone_brute",
    name: "Stone Brute",
    spawn: { x: 16.5, y: 8, z: 15.5 },
    maxHealth: 18,
    armor: 1,
    speed: 0.72,
    stopDistance: 1.8,
    aggroRange: 12,
    windupMs: 1150,
    recoverMs: 850,
    cooldownMs: 2400,
    damage: 2,
    lungeDistance: 0.45,
    hitRange: 2.75,
    respawnMs: 8500,
    rewardHealth: 1,
    rewardStamina: 35,
  },
};

export function mobArchetype(value: string): MobArchetypeDefinition {
  return value === "stone_brute" ? MOB_ARCHETYPES.stone_brute : MOB_ARCHETYPES.moss_crawler;
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
): { health: number; stamina: number; healthRestored: number; staminaRestored: number } {
  const nextHealth = Math.min(maxHealth, health + definition.rewardHealth);
  const nextStamina = Math.min(maxStamina, stamina + definition.rewardStamina);
  return {
    health: nextHealth,
    stamina: nextStamina,
    healthRestored: nextHealth - health,
    staminaRestored: Math.round(nextStamina - stamina),
  };
}
