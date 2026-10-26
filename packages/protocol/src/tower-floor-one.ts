/** Canonical manifest for the first floor of the new tower game. */
export const TOWER_FLOOR_ONE = {
  id: "tower-floor-1",
  name: "Floor 1 · The Overgrown Rampart",
  levelMin: 1,
  levelMax: 4,
  bounds: { minX: 296, maxX: 392, minZ: 56, maxZ: 156 },
  entry: { x: 305.5, y: 9, z: 106.5 },
  returnPortal: { x: 301.5, y: 9, z: 106.5 },
  ascentPortal: { x: 387.5, y: 9.55, z: 106.5 },
  townPortal: { x: 104.5, y: 8, z: 106 },
  sanctuary: { minX: 298, maxX: 316, minZ: 91, maxZ: 121 },
  bossCourt: { x: 374, z: 106, radius: 14 },
} as const;

const smoothStep = (value: number): number => {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
};

function terraceHeight(x: number, z: number, cx: number, cz: number,
  innerRadius: number, outerRadius: number, height: number): number {
  const distance = Math.hypot(x - cx, z - cz);
  if (distance <= innerRadius) return height;
  if (distance >= outerRadius) return 0;
  return height * (1 - smoothStep((distance - innerRadius) / (outerRadius - innerRadius)));
}

function causewayHeight(x: number, z: number, ax: number, az: number, bx: number, bz: number,
  startHeight: number, endHeight: number, halfWidth: number): number {
  const dx = bx - ax, dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSquared));
  const px = ax + dx * t, pz = az + dz * t;
  const distance = Math.hypot(x - px, z - pz);
  if (distance >= halfWidth + 1.8) return 0;
  const edge = 1 - smoothStep((distance - halfWidth) / 1.8);
  return (startHeight + (endHeight - startHeight) * t) * edge;
}

/** Shared walkable silhouette for Floor 1. Visual terraces and authoritative
 * movement both use this function, preventing raised scenery from becoming a
 * cosmetic ledge that the player clips through. */
export function towerFloorOneGroundHeight(x: number, z: number): number {
  if (!isInsideTowerFloorOne(x, z)) return 8;
  const sanctuary = terraceHeight(x, z, 306, 106, 9.2, 13.5, 1);
  const opening = terraceHeight(x, z, 329, 106, 10.5, 15, .18);
  const northWarden = terraceHeight(x, z, 350, 80, 10.2, 15.5, .68);
  const southWarden = terraceHeight(x, z, 350, 132, 10.2, 15.5, .68);
  const crownCourt = terraceHeight(x, z, 375, 106, 13.2, 19.5, 1.55);
  const arrivalCauseway = causewayHeight(x, z, 307, 106, 329, 106, 1, .18, 3.3);
  const northCauseway = causewayHeight(x, z, 329, 104, 350, 80, .18, .68, 2.6);
  const southCauseway = causewayHeight(x, z, 329, 108, 350, 132, .18, .68, 2.6);
  const crownCauseway = causewayHeight(x, z, 330, 106, 375, 106, .18, 1.55, 3.2);
  return 8 + Math.max(sanctuary, opening, northWarden, southWarden, crownCourt,
    arrivalCauseway, northCauseway, southCauseway, crownCauseway);
}

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
  { id: "floor1-mossling-a", archetype: "moss_crawler", name: "Rampart Mossling", level: 1, respawnMs: 40_000, x: 325, y: towerFloorOneGroundHeight(325, 97), z: 97 },
  { id: "floor1-mossling-b", archetype: "briar_crawler", name: "Briarbound Scout", level: 1, respawnMs: 42_000, x: 329, y: towerFloorOneGroundHeight(329, 113), z: 113 },
  { id: "floor1-thorn-a", archetype: "thornbinder", name: "Rampart Thorncaster", level: 2, respawnMs: 46_000, x: 335, y: towerFloorOneGroundHeight(335, 105), z: 105 },
  { id: "floor1-north-guard", archetype: "briar_crawler", name: "North Warden's Hound", level: 2, respawnMs: 55_000, x: 344, y: towerFloorOneGroundHeight(344, 78), z: 78 },
  { id: "floor1-north-warden", archetype: "stone_brute", name: "North Root Warden", level: 3, respawnMs: 90_000, x: 350, y: towerFloorOneGroundHeight(350, 80), z: 80, leader: true },
  { id: "floor1-south-guard", archetype: "cave_spitter", name: "South Warden's Seer", level: 2, respawnMs: 55_000, x: 344, y: towerFloorOneGroundHeight(344, 134), z: 134 },
  { id: "floor1-south-warden", archetype: "thornbinder", name: "South Root Warden", level: 3, respawnMs: 90_000, x: 350, y: towerFloorOneGroundHeight(350, 132), z: 132, leader: true },
  { id: "floor1-court-briar-a", archetype: "briar_crawler", name: "Crown Briar", level: 3, respawnMs: 65_000, x: 361, y: towerFloorOneGroundHeight(361, 98), z: 98 },
  { id: "floor1-court-briar-b", archetype: "briar_crawler", name: "Crown Briar", level: 3, respawnMs: 65_000, x: 361, y: towerFloorOneGroundHeight(361, 114), z: 114 },
  { id: "floor1-crownkeeper", archetype: "stone_brute", name: "The Crownkeeper", level: 4, respawnMs: 120_000, x: 375, y: towerFloorOneGroundHeight(375, 106), z: 106, leader: true, floorBoss: true },
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
  return Boolean(spawn) && Math.abs(position.y - towerFloorOneGroundHeight(position.x, position.z)) <= 1.5
    && isInsideTowerFloorOne(position.x, position.z, 2)
    && Math.hypot(position.x - spawn!.x, position.z - spawn!.z) <= (spawn!.floorBoss ? 14 : spawn!.leader ? 11 : 9);
}
