import type { MobArchetypeDefinition } from "./mob-archetypes.js";
import { TOWN_CENTER_X, TOWN_CENTER_Z, TOWN_SAFE_RADIUS } from "@blockcraft/voxel-world";

export const WORLD_SAFE_CENTER = { x: TOWN_CENTER_X, z: TOWN_CENTER_Z } as const;
export const MOB_TOWN_MINIMUM_RADIUS = TOWN_SAFE_RADIUS + 8;

export type DangerTier = 0 | 1 | 2 | 3;

export interface DangerBand {
  tier: DangerTier;
  name: string;
  minimumRadius: number;
  healthMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
  rewardMultiplier: number;
  armorBonus: number;
}

export const DANGER_BANDS: readonly DangerBand[] = [
  { tier: 0, name: "Town of Beginnings", minimumRadius: 0, healthMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, rewardMultiplier: 1, armorBonus: 0 },
  { tier: 1, name: "Outskirts", minimumRadius: TOWN_SAFE_RADIUS, healthMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1, rewardMultiplier: 1, armorBonus: 0 },
  { tier: 2, name: "Wilds", minimumRadius: 26, healthMultiplier: 1.4, damageMultiplier: 1.5, speedMultiplier: 1.08, rewardMultiplier: 1.35, armorBonus: 0 },
  { tier: 3, name: "Deep Frontier", minimumRadius: 38, healthMultiplier: 1.85, damageMultiplier: 2, speedMultiplier: 1.15, rewardMultiplier: 1.8, armorBonus: 1 },
] as const;

export function radiusFromSafeCenter(position: { x: number; z: number }): number {
  return Math.hypot(position.x - WORLD_SAFE_CENTER.x, position.z - WORLD_SAFE_CENTER.z);
}

export function isInsideTownSafeZone(position: { x: number; z: number }): boolean {
  return radiusFromSafeCenter(position) < TOWN_SAFE_RADIUS;
}

/** Mobs can fight players near a gate without wandering back into the sanctuary. */
export function keepMobOutsideTown(position: { x: number; z: number }): { x: number; z: number } {
  const dx = position.x - WORLD_SAFE_CENTER.x;
  const dz = position.z - WORLD_SAFE_CENTER.z;
  const radius = Math.hypot(dx, dz);
  if (radius >= MOB_TOWN_MINIMUM_RADIUS) return position;
  const scale = MOB_TOWN_MINIMUM_RADIUS / (radius || 1);
  return { x: WORLD_SAFE_CENTER.x + (radius ? dx : 1) * scale, z: WORLD_SAFE_CENTER.z + dz * scale };
}

export function dangerBandAt(position: { x: number; z: number }): DangerBand {
  const radius = radiusFromSafeCenter(position);
  for (let index = DANGER_BANDS.length - 1; index >= 0; index -= 1) {
    const band = DANGER_BANDS[index];
    if (band && radius >= band.minimumRadius) return band;
  }
  return DANGER_BANDS[0]!;
}

export function scaledMobStats(definition: MobArchetypeDefinition, band: DangerBand): {
  maxHealth: number;
  damage: number;
  armor: number;
  speedMultiplier: number;
  rewardMultiplier: number;
} {
  return {
    maxHealth: Math.max(1, Math.round(definition.maxHealth * band.healthMultiplier)),
    damage: Math.max(1, Math.round(definition.damage * band.damageMultiplier)),
    armor: Math.max(0, definition.armor + band.armorBonus),
    speedMultiplier: band.speedMultiplier,
    rewardMultiplier: band.rewardMultiplier,
  };
}
