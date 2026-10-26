/** Canonical manifest for the first floor of the new tower game. */
export const TOWER_FLOOR_ONE = {
  id: "tower-floor-1",
  name: "Floor 1 · The Overgrown Rampart",
  levelMin: 1,
  levelMax: 4,
  bounds: { minX: 296, maxX: 392, minZ: 56, maxZ: 156 },
  entry: { x: 305.5, y: 8, z: 106.5 },
  returnPortal: { x: 301.5, y: 8, z: 106.5 },
  ascentPortal: { x: 387.5, y: 8, z: 106.5 },
  townPortal: { x: 104.5, y: 8, z: 106 },
  sanctuary: { minX: 298, maxX: 316, minZ: 91, maxZ: 121 },
  bossCourt: { x: 374, z: 106, radius: 14 },
} as const;

export type TowerFloorOneSpawn = {
  id: string;
  archetype: "moss_crawler" | "briar_crawler" | "stone_brute" | "cave_spitter" | "thornbinder";
  name: string;
  level: number;
  respawnMs: number;
  x: number;
  y: number;
  z: number;
  leader?: boolean;
  floorBoss?: boolean;
};

export const TOWER_FLOOR_ONE_SPAWNS: readonly TowerFloorOneSpawn[] = [
  { id: "floor1-mossling-a", archetype: "moss_crawler", name: "Rampart Mossling", level: 1, respawnMs: 40_000, x: 325, y: 8, z: 97 },
  { id: "floor1-mossling-b", archetype: "briar_crawler", name: "Briarbound Scout", level: 1, respawnMs: 42_000, x: 329, y: 8, z: 113 },
  { id: "floor1-thorn-a", archetype: "thornbinder", name: "Rampart Thorncaster", level: 2, respawnMs: 46_000, x: 335, y: 8, z: 105 },
  { id: "floor1-north-guard", archetype: "briar_crawler", name: "North Warden's Hound", level: 2, respawnMs: 55_000, x: 344, y: 8, z: 78 },
  { id: "floor1-north-warden", archetype: "stone_brute", name: "North Root Warden", level: 3, respawnMs: 90_000, x: 350, y: 8, z: 80, leader: true },
  { id: "floor1-south-guard", archetype: "cave_spitter", name: "South Warden's Seer", level: 2, respawnMs: 55_000, x: 344, y: 8, z: 134 },
  { id: "floor1-south-warden", archetype: "thornbinder", name: "South Root Warden", level: 3, respawnMs: 90_000, x: 350, y: 8, z: 132, leader: true },
  { id: "floor1-court-briar-a", archetype: "briar_crawler", name: "Crown Briar", level: 3, respawnMs: 65_000, x: 361, y: 8, z: 98 },
  { id: "floor1-court-briar-b", archetype: "briar_crawler", name: "Crown Briar", level: 3, respawnMs: 65_000, x: 361, y: 8, z: 114 },
  { id: "floor1-crownkeeper", archetype: "stone_brute", name: "The Crownkeeper", level: 4, respawnMs: 120_000, x: 375, y: 8, z: 106, leader: true, floorBoss: true },
] as const;

export const TOWER_FLOOR_ONE_WARDENS = ["floor1-north-warden", "floor1-south-warden"] as const;
export const TOWER_FLOOR_ONE_BOSS_ID = "floor1-crownkeeper";

export function isInsideTowerFloorOne(x: number, z: number, inset = 0): boolean {
  const bounds = TOWER_FLOOR_ONE.bounds;
  return x >= bounds.minX + inset && x <= bounds.maxX - inset
    && z >= bounds.minZ + inset && z <= bounds.maxZ - inset;
}

export function towerFloorOneSpawn(id: string): TowerFloorOneSpawn | undefined {
  return TOWER_FLOOR_ONE_SPAWNS.find(spawn => spawn.id === id);
}

export function towerFloorOneEncounterAllows(id: string, position: { x: number; y: number; z: number }): boolean {
  const spawn = towerFloorOneSpawn(id);
  return Boolean(spawn) && Math.abs(position.y - 8) <= 1.5
    && isInsideTowerFloorOne(position.x, position.z, 2)
    && Math.hypot(position.x - spawn!.x, position.z - spawn!.z) <= (spawn!.floorBoss ? 14 : spawn!.leader ? 11 : 9);
}
