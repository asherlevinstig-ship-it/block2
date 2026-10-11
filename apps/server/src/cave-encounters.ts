import type { Position } from "./action-rules.js";

export const CAVE_ENCOUNTERS: Record<string, { name: string; minX: number; maxX: number; minZ: number; maxZ: number; minY: number; maxY: number }> = {
  "shallow-cave-crawler": { name: "Iron Chamber Crawler", minX: 36.3, maxX: 41.7, minZ: 5.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
  "deep-cave-spitter": { name: "Silver Chamber Spitter", minX: 44.3, maxX: 51.7, minZ: 5.3, maxZ: 12.7, minY: 0.8, maxY: 3.2 },
  "buried-vault-crawler": { name: "Vault Crawler", minX: 53.3, maxX: 58.7, minZ: 7.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
  "buried-chamber-brute": { name: "Stone Warden", minX: 53.3, maxX: 58.7, minZ: 7.3, maxZ: 11.7, minY: 0.8, maxY: 3.2 },
};

const SILVER_DEPTHS_ENCOUNTERS: typeof CAVE_ENCOUNTERS = {
  "silver-depths-spitter-a": { name: "Moonstone Spitter", minX: 60.3, maxX: 67.7, minZ: 4.3, maxZ: 13.7, minY: 0.8, maxY: 3.2 },
  "silver-depths-spitter-b": { name: "Moonstone Spitter", minX: 60.3, maxX: 67.7, minZ: 4.3, maxZ: 13.7, minY: 0.8, maxY: 3.2 },
  "crystal-matriarch": { name: "Crystal Matriarch", minX: 69.3, maxX: 75.7, minZ: 4.3, maxZ: 13.7, minY: 0.8, maxY: 4.2 },
};

/** Exclude the surface, but allow mined ledges and falling within the room. */
export function caveEncounterAllows(mobId: string, position: Position): boolean {
  const area = CAVE_ENCOUNTERS[mobId] ?? SILVER_DEPTHS_ENCOUNTERS[mobId];
  return !area || (position.x >= area.minX && position.x <= area.maxX && position.z >= area.minZ && position.z <= area.maxZ
    && position.y >= area.minY && position.y <= area.maxY);
}
