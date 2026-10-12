import type { MobArchetypeId } from "./mob-archetypes.js";
import type { SilverDepthsWing } from "@blockcraft/protocol";

export type SilverDepthsEncounterStage = 1 | 2 | 3 | 4;

export interface SilverDepthsEncounterSpawn {
  id: string;
  name: string;
  archetype: MobArchetypeId;
  stage: SilverDepthsEncounterStage;
  wing?: SilverDepthsWing;
  x: number;
  y: number;
  z: number;
  baseHealth: number;
  level: number;
}

export const SILVER_DEPTHS_ENCOUNTERS: readonly SilverDepthsEncounterSpawn[] = [
  { id: "depths-wave-one-crawler-a", name: "Moonstone Crawler", archetype: "moss_crawler", stage: 1, x: 89.5, y: 1, z: 8.5, baseHealth: 8, level: 7 },
  { id: "silver-depths-spitter-a", name: "Moonstone Spitter", archetype: "cave_spitter", stage: 1, x: 94.5, y: 1, z: 14.5, baseHealth: 8, level: 8 },
  { id: "depths-wave-one-crawler-b", name: "Moonstone Crawler", archetype: "moss_crawler", stage: 1, x: 89.5, y: 1, z: 21.5, baseHealth: 8, level: 7 },
  { id: "depths-iron-crawler-a", name: "Iron Crawler", archetype: "moss_crawler", stage: 2, wing: "iron", x: 96.5, y: 1, z: -4.5, baseHealth: 11, level: 9 },
  { id: "depths-iron-warden", name: "Iron Warden", archetype: "stone_brute", stage: 2, wing: "iron", x: 102.5, y: 1, z: -7.5, baseHealth: 19, level: 10 },
  { id: "depths-iron-crawler-b", name: "Iron Crawler", archetype: "moss_crawler", stage: 2, wing: "iron", x: 105.5, y: 1, z: -3.5, baseHealth: 11, level: 9 },
  { id: "depths-silver-spitter-a", name: "Echo Spitter", archetype: "cave_spitter", stage: 2, wing: "silver", x: 96.5, y: 1, z: 30.5, baseHealth: 11, level: 9 },
  { id: "depths-silver-crawler", name: "Echo Crawler", archetype: "moss_crawler", stage: 2, wing: "silver", x: 103.5, y: 1, z: 31.5, baseHealth: 12, level: 9 },
  { id: "depths-silver-spitter-b", name: "Echo Spitter", archetype: "cave_spitter", stage: 2, wing: "silver", x: 109.5, y: 1, z: 29.5, baseHealth: 11, level: 10 },
  { id: "depths-antechamber-crawler-a", name: "Crystal Crawler", archetype: "moss_crawler", stage: 3, x: 118.5, y: 1, z: 10.5, baseHealth: 10, level: 10 },
  { id: "depths-antechamber-warden", name: "Crystal Warden", archetype: "stone_brute", stage: 3, x: 120.5, y: 1, z: 14.5, baseHealth: 18, level: 11 },
  { id: "depths-antechamber-crawler-b", name: "Crystal Crawler", archetype: "moss_crawler", stage: 3, x: 118.5, y: 1, z: 19.5, baseHealth: 10, level: 10 },
  { id: "crystal-matriarch", name: "Crystal Matriarch", archetype: "cave_spitter", stage: 4, x: 131.5, y: 1, z: 14.5, baseHealth: 28, level: 12 },
] as const;

export const SILVER_DEPTHS_GALLERY_IDS = SILVER_DEPTHS_ENCOUNTERS.filter(entry => entry.stage <= 2).map(entry => entry.id);
export const SILVER_DEPTHS_ANTECHAMBER_IDS = SILVER_DEPTHS_ENCOUNTERS.filter(entry => entry.stage === 3).map(entry => entry.id);
export const SILVER_DEPTHS_ENEMY_IDS = SILVER_DEPTHS_ENCOUNTERS.map(entry => entry.id);

export function silverDepthsStageSpawns(stage: SilverDepthsEncounterStage, wing?: SilverDepthsWing): readonly SilverDepthsEncounterSpawn[] {
  return SILVER_DEPTHS_ENCOUNTERS.filter(entry => entry.stage === stage && (stage !== 2 || entry.wing === wing));
}

export function silverDepthsScaledStats(entry: SilverDepthsEncounterSpawn, partySize: number): { health: number; damageBonus: number; speedMultiplier: number } {
  const size = Math.max(1, Math.min(4, Math.floor(partySize)));
  return {
    health: Math.ceil(entry.baseHealth * (1 + (size - 1) * .4)),
    damageBonus: size >= 3 ? 1 : 0,
    speedMultiplier: 1 + (size - 1) * .025,
  };
}
