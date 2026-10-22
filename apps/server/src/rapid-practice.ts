import type { MobArchetypeId } from "./mob-archetypes.js";

export const RAPID_PRACTICE_ARENA = {
  minX: 88,
  maxX: 128,
  minZ: 90,
  maxZ: 122,
  floorY: 7,
  spawn: { x: 99.5, y: 8, z: 106.5 },
} as const;

export type RapidPracticeSpawn = {
  id: string;
  archetype: MobArchetypeId;
  x: number;
  y: number;
  z: number;
};

export const RAPID_PRACTICE_SPAWNS: readonly RapidPracticeSpawn[] = [
  { id: "rapid-crawler-01", archetype: "moss_crawler", x: 106.5, y: 8, z: 99.5 },
  { id: "rapid-crawler-02", archetype: "moss_crawler", x: 109.5, y: 8, z: 102.5 },
  { id: "rapid-crawler-03", archetype: "briar_crawler", x: 113.5, y: 8, z: 97.5 },
  { id: "rapid-crawler-04", archetype: "briar_crawler", x: 119.5, y: 8, z: 103.5 },
  { id: "rapid-crawler-05", archetype: "moss_crawler", x: 123.5, y: 8, z: 108.5 },
  { id: "rapid-crawler-06", archetype: "briar_crawler", x: 118.5, y: 8, z: 115.5 },
  { id: "rapid-crawler-07", archetype: "moss_crawler", x: 109.5, y: 8, z: 118.5 },
  { id: "rapid-crawler-08", archetype: "briar_crawler", x: 101.5, y: 8, z: 116.5 },
  { id: "rapid-spitter-01", archetype: "cave_spitter", x: 111.5, y: 8, z: 93.5 },
  { id: "rapid-spitter-02", archetype: "cave_spitter", x: 125.5, y: 8, z: 100.5 },
  { id: "rapid-spitter-03", archetype: "cave_spitter", x: 125.5, y: 8, z: 117.5 },
  { id: "rapid-spitter-04", archetype: "cave_spitter", x: 113.5, y: 8, z: 120.5 },
  { id: "rapid-stalker-01", archetype: "ridge_stalker", x: 116.5, y: 8, z: 106.5 },
  { id: "rapid-stalker-02", archetype: "ridge_stalker", x: 121.5, y: 8, z: 112.5 },
  { id: "rapid-stalker-03", archetype: "ridge_stalker", x: 106.5, y: 8, z: 111.5 },
  { id: "rapid-brute-01", archetype: "stone_brute", x: 121.5, y: 8, z: 94.5 },
  { id: "rapid-brute-02", archetype: "stone_brute", x: 126.5, y: 8, z: 111.5 },
  { id: "rapid-brute-03", archetype: "stone_brute", x: 115.5, y: 8, z: 110.5 },
] as const;

export function rapidPracticeMovementSpeed(baseSpeed: number, enabled: boolean): number {
  return enabled ? baseSpeed * 1.38 : baseSpeed;
}

export function rapidPracticeProjectileTravelMs(travelMs: number, enabled: boolean): number {
  if (!enabled || travelMs <= 0) return travelMs;
  return Math.max(180, Math.round(travelMs * 0.68));
}
