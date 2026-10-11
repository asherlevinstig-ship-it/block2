import type { Position } from "./action-rules.js";
import { SILVER_DEPTHS_ENCOUNTERS } from "./silver-depths-encounters.js";

export const CAVE_ENCOUNTERS: Record<string, { name: string; minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }> = {
  "shallow-cave-crawler": { name: "Iron Chamber Crawler", minX: 36.3, maxX: 41.7, minZ: 5.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
  "deep-cave-spitter": { name: "Silver Chamber Spitter", minX: 44.3, maxX: 51.7, minZ: 5.3, maxZ: 12.7, minY: 0.8, maxY: 3.2 },
  "buried-vault-crawler": { name: "Vault Crawler", minX: 53.3, maxX: 58.7, minZ: 7.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
  "buried-chamber-brute": { name: "Stone Warden", minX: 53.3, maxX: 58.7, minZ: 7.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
};

const SILVER_DEPTHS_AREAS: typeof CAVE_ENCOUNTERS = Object.fromEntries(SILVER_DEPTHS_ENCOUNTERS.map(entry => [entry.id,
  entry.stage <= 2
    ? { name: entry.name, minX: 83.3, maxX: 107.7, minZ: 3.3, maxZ: 26.7, minY: 0.8, maxY: 5.2 }
    : entry.stage === 3
      ? { name: entry.name, minX: 115.3, maxX: 124.7, minZ: 7.3, maxZ: 22.7, minY: 0.8, maxY: 5.2 }
      : { name: entry.name, minX: 124.3, maxX: 139.7, minZ: -2.7, maxZ: 31.7, minY: 0.8, maxY: 5.2 },
]));

/** Exclude the surface, but allow mined ledges and falling within the room. */
export function caveEncounterAllows(mobId: string, position: Position): boolean {
  const area = CAVE_ENCOUNTERS[mobId] ?? SILVER_DEPTHS_AREAS[mobId];
  return !area || (position.x >= area.minX && position.x <= area.maxX && position.z >= area.minZ && position.z <= area.maxZ
    && position.y >= area.minY && position.y <= area.maxY);
}
