import type { MobArchetypeId } from "./mob-archetypes.js";

export type WildernessEliteKind = "frenzied" | "volatile" | "siegebound";
export const MAX_ACTIVE_WILDERNESS_ELITES = 2;
export const ELITE_CHANCE_BY_TIER = { 2: .14, 3: .22 } as const;

export function wildernessEliteKind(archetype: MobArchetypeId): WildernessEliteKind {
  if (archetype === "cave_spitter") return "volatile";
  if (archetype === "stone_brute") return "siegebound";
  return "frenzied";
}

export function shouldBecomeWildernessElite(tier: number, activeElites: number, roll: number): boolean {
  if (tier < 2 || activeElites >= MAX_ACTIVE_WILDERNESS_ELITES || !Number.isFinite(roll)) return false;
  const chance = tier >= 3 ? ELITE_CHANCE_BY_TIER[3] : ELITE_CHANCE_BY_TIER[2];
  return roll >= 0 && roll < chance;
}

export function wildernessEliteName(kind: WildernessEliteKind, baseName: string): string {
  const title = kind === "frenzied" ? "Frenzied" : kind === "volatile" ? "Volatile" : "Siegebound";
  return `${title} ${baseName}`;
}

export function wildernessEliteStats(stats: { maxHealth: number; damage: number; armor: number; speedMultiplier: number; rewardMultiplier: number }) {
  return {
    maxHealth: Math.max(2, Math.round(stats.maxHealth * 1.65)),
    damage: stats.damage + 1,
    armor: stats.armor,
    speedMultiplier: stats.speedMultiplier * 1.12,
    rewardMultiplier: stats.rewardMultiplier * 1.8,
  };
}

export function wildernessElitePattern(archetype: MobArchetypeId, sequence: number): string {
  if (archetype === "cave_spitter") return sequence % 2 === 0 ? "fan" : "pool";
  if (archetype === "stone_brute") return sequence % 2 === 0 ? "rocks" : "slam";
  return "rush";
}
