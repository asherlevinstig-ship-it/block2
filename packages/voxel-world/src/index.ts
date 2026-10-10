export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 24;
export const SURFACE_HEIGHT = 7;
export const TOWN_CENTER_X = CHUNK_SIZE / 2 + 0.5;
export const TOWN_CENTER_Z = CHUNK_SIZE / 2 + 0.5;
export const TOWN_SAFE_RADIUS = 22;
export const WILDS_MINIMUM_RADIUS = 34;
export const FRONTIER_MINIMUM_RADIUS = 46;
export const SPAWN_PROTECTION_RADIUS = TOWN_SAFE_RADIUS;
export const TOWN_TAVERN_Z_OFFSET = 6;
export const TOWN_TAVERN = { minX: 0, maxX: 16, minZ: 16, maxZ: 25, roofBaseY: 12, roofTopY: 16 } as const;
export const TOWN_BUILDINGS = [TOWN_TAVERN] as const;
export const TOWN_GATE_POSTS = [
  [-14, 7], [-14, 10], [30, 7], [30, 10],
  [7, -14], [10, -14], [7, 30], [10, 30],
] as const;
export const PLAYER_RADIUS = 0.28;
export const PLAYER_HEIGHT = 1.45;
export const GRAVITY = 18;
export const TERMINAL_VELOCITY = 12;

export const TOWN_TAVERN_TABLE_CENTERS = [[4.5, 19.5], [12.5, 19.5], [12.5, 22.5]] as const;
export const TOWN_TAVERN_QUIZ_TABLE_POSITION = { x: 12.5, y: 8, z: 22.5 } as const;
export const TOWN_TAVERN_KEEPER_POSITION = { x: 5.1, y: 8, z: 24.35 } as const;
export const TOWN_BLACKSMITH_STALL_POSITION = { x: 22.5, y: 8, z: 2.5 } as const;
export const TOWN_STORAGE_CHEST_POSITION = { x: 26.5, y: 8, z: 4.5 } as const;
export function isAtTownStorage(player: { x: number; y: number; z: number }): boolean {
  const chest = TOWN_STORAGE_CHEST_POSITION;
  return Math.abs(player.y - chest.y) <= 1.5 && Math.hypot(player.x - chest.x, player.z - chest.z) <= 2;
}
export const TOWN_BLACKSMITH_STALL_COLLIDER = { x: 22.5, z: 2.5, width: 3.1, depth: 0.7, minY: 8, maxY: 9.15 } as const;
export const TOWN_BEACON_POSITION = { x: -2, z: 1 } as const;
export const MILESTONE_CAVE_X_OFFSET = 14;
export const CAVE_SHALLOW_HOME = { x: 39.5, y: 3, z: 6.5 } as const;
export const CAVE_DEEP_HOME = { x: 48.5, y: 1, z: 10.5 } as const;
export const CAVE_HIDDEN_HOME = { x: 56.5, y: 1, z: 9.5 } as const;
/** Side veins are excavated horizontally, leaving the main stairway intact. */
export const CAVE_ORE_POCKETS = [
  { id: "shallow-iron", minX: 38, maxX: 40, minZ: 3, maxZ: 4, floorY: 2, block: 5 },
  { id: "deep-silver", minX: 46, maxX: 49, minZ: 14, maxZ: 15, floorY: 0, block: 8 },
] as const;
export function isCaveReturnRoute(x: number, z: number): boolean {
  return z >= 7 && z <= 9 && ((x >= 32 && x <= 35) || (x >= 42 && x <= 43));
}
export const GREENWOOD_REGION = { minX: 31, maxX: 51, minZ: -10, maxZ: 27 } as const;
export const GREENWOOD_CAMP = { minX: 36, maxX: 46, minZ: 14, maxZ: 24 } as const;
export const GREENWOOD_IRON_SEAM = { minX: 48, maxX: 50, minZ: 19, maxZ: 21 } as const;
export const GREENWOOD_CRAWLER_HOMES = [
  { x: 39.5, y: 8, z: 16.5 }, { x: 43.5, y: 8, z: 21.5 }, { x: 45.5, y: 8, z: 16.5 },
] as const;
export const STONE_BRUTE_ARENA = { minX: 35, maxX: 49, minZ: 34, maxZ: 48 } as const;
export const STONE_BRUTE_ARENA_HOME = { x: 42.5, y: 8, z: 41.5 } as const;
export function isInStoneBruteArena(x: number, z: number): boolean {
  return x >= STONE_BRUTE_ARENA.minX && x <= STONE_BRUTE_ARENA.maxX + 1
    && z >= STONE_BRUTE_ARENA.minZ && z <= STONE_BRUTE_ARENA.maxZ + 1;
}

export function stoneBruteArenaBlock(x: number, y: number, z: number): BlockId | null {
  const arena = isInStoneBruteArena(x, z);
  const approach = x >= 41 && x <= 42 && z >= 25 && z < STONE_BRUTE_ARENA.minZ;
  if (!arena && !approach) return null;
  if (y > SURFACE_HEIGHT) return Block.Air;
  if (y === SURFACE_HEIGHT) {
    const edge = arena && (x === 35 || x === 49 || z === 34 || z === 48);
    return approach || edge ? Block.Dirt : Block.Stone;
  }
  return y >= SURFACE_HEIGHT - 2 ? Block.Stone : null;
}
export function isInGreenwoodCamp(x: number, z: number): boolean {
  return x >= GREENWOOD_CAMP.minX && x <= GREENWOOD_CAMP.maxX + 1
    && z >= GREENWOOD_CAMP.minZ && z <= GREENWOOD_CAMP.maxZ + 1;
}

type FurnitureCollider = { x: number; z: number; width: number; depth: number; minY: number; maxY: number };
export const TOWN_TAVERN_FURNITURE_COLLIDERS: readonly FurnitureCollider[] = [
  ...TOWN_TAVERN_TABLE_CENTERS.map(([x, z]) => ({ x, z, width: 2.72, depth: 2.08, minY: 8.1, maxY: 9.05 })),
  { x: 4.9, z: 23.73, width: 3.92, depth: 0.7, minY: 8, maxY: 9.45 },
  { x: 4.025, z: 22.5, width: 0.62, depth: 1.38, minY: 8, maxY: 9.95 },
];

export const Block = {
  Air: 0,
  Bedrock: 1,
  Stone: 2,
  Dirt: 3,
  Grass: 4,
  IronOre: 5,
  OakLog: 6,
  Leaves: 7,
  SilverOre: 8,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

export const WILDERNESS_TERRITORIES = [
  { tier: 1, name: "IRON OUTSKIRTS", detail: "Scattered crawlers · exposed iron · prepare for the wilds" },
  { tier: 2, name: "SILVER WILDS", detail: "Spitter pairs guard silver · use cover and dodge their shots" },
  { tier: 3, name: "STONE FRONTIER", detail: "Brutes guard rich silver seams · defeat them for Stone Core Hammers" },
] as const;
export function wildernessTerritoryAt(x: number, z: number) {
  const radius = Math.hypot(x - TOWN_CENTER_X, z - TOWN_CENTER_Z);
  return radius < TOWN_SAFE_RADIUS ? null : WILDERNESS_TERRITORIES[radius >= FRONTIER_MINIMUM_RADIUS ? 2 : radius >= WILDS_MINIMUM_RADIUS ? 1 : 0]!;
}
/** Flat ground palettes distinguish rings without adding collision geometry. */
export function wildernessSurfaceBlock(x: number, z: number): BlockId {
  const territory = wildernessTerritoryAt(x, z);
  const patch = Math.abs(Math.floor(x / 3) + Math.floor(z / 3)) % 4;
  return territory?.tier === 3 ? (patch < 2 ? Block.Stone : Block.Dirt)
    : territory?.tier === 2 && patch === 0 ? Block.Dirt : Block.Grass;
}

// Shared by authoritative mining and the local progress presentation.
export function miningDurationMs(block: number): number {
  if (block === Block.SilverOre) return 1200;
  if (block === Block.IronOre) return 850;
  if (block === Block.Stone) return 600;
  if (block === Block.OakLog) return 500;
  return 300;
}

export function miningLineClear(player: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }, read: WorldBlockReader): boolean {
  const origin = { x: player.x, y: player.y + 0.8, z: player.z };
  // Test the nearest block surface, not its buried centre: exposed ore tops
  // must remain mineable without the ray cutting through adjacent ground.
  const nearest = (value: number, cell: number) => Math.max(cell + 0.01, Math.min(cell + 0.99, value));
  const points = [{ x: nearest(origin.x, target.x), y: nearest(origin.y, target.y), z: nearest(origin.z, target.z) }];
  for (const axis of ["x", "y", "z"] as const) {
    if (origin[axis] >= target[axis] && origin[axis] <= target[axis] + 1) continue;
    const face = { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 };
    face[axis] = origin[axis] < target[axis] ? target[axis] + 0.001 : target[axis] + 0.999;
    points.push(face);
  }
  for (const point of points) {
    const delta = { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z };
    const distance = Math.hypot(delta.x, delta.y, delta.z);
    if (distance < 0.001) continue;
    const hit = voxelRaycast(origin, delta, distance + 0.01, read);
    if (hit && hit.x === target.x && hit.y === target.y && hit.z === target.z) return true;
  }
  return false;
}

export const MINERAL_DEPOSITS = [
  { x: 35, z: -5, block: Block.IronOre, radius: 1 },
  { x: -23, z: 8, block: Block.IronOre, radius: 1 },
  { x: 8, z: -23, block: Block.IronOre, radius: 1 },
  { x: 48, z: 28, block: Block.SilverOre, radius: 1 },
  { x: -30, z: 8, block: Block.SilverOre, radius: 1 },
  { x: 68, z: 27, block: Block.SilverOre, radius: 2 },
  { x: -48, z: 8, block: Block.SilverOre, radius: 2 },
] as const;
export const RENEWABLE_MINERAL_DEPOSITS = [...MINERAL_DEPOSITS, { x: 49, z: 20, block: Block.IronOre, radius: 1 }] as const;
export const WILDERNESS_CAMPS = MINERAL_DEPOSITS.map(deposit => ({ ...deposit,
  kind: deposit.block === Block.IronOre ? "nest" as const : deposit.radius === 1 ? "spitter" as const : "ruin" as const,
}));
export const SILVER_GUARD_CLEARING = { minX: 44, maxX: 55, minZ: 25, maxZ: 33 } as const;
export const SILVER_GUARD_HOMES = [{ x: 46.5, y: 8, z: 31.5 }, { x: 50.5, y: 8, z: 25.5 }] as const;
export const SILVER_GUARD_COVER = [{ x: 44, z: 25 }, { x: 52, z: 25 }, { x: 54, z: 30 }] as const;
export function isInSilverGuardClearing(x: number, z: number): boolean {
  const area = SILVER_GUARD_CLEARING;
  return x >= area.minX && x <= area.maxX + 1 && z >= area.minZ && z <= area.maxZ + 1;
}
export function isSilverRetreatTrail(x: number, z: number): boolean {
  return x >= 8 && x <= 10 && z >= 30 && z <= 32
    || x >= 9 && x <= 40 && z >= 31 && z <= 33
    || x >= 39 && x <= 41 && z >= 28 && z <= 32
    || x >= 40 && x <= 48 && z >= 27 && z <= 29;
}
/** Low stone cover blocks real shots; ore is layered afterwards and remains exposed. */
export function silverGuardEncounterBlock(x: number, y: number, z: number): BlockId | null {
  if (y < SURFACE_HEIGHT || (!isInSilverGuardClearing(x, z) && !isSilverRetreatTrail(x, z))) return null;
  if (y === SURFACE_HEIGHT) return isSilverRetreatTrail(x, z) ? Block.Dirt : Block.Grass;
  const cover = SILVER_GUARD_COVER.some(rock => x >= rock.x && x <= rock.x + 1 && z >= rock.z && z <= rock.z + 1);
  return cover && y <= SURFACE_HEIGHT + 2 ? Block.Stone : Block.Air;
}
/** Broken cover, never a closed enclosure. The central ore and cardinal approaches stay open. */
export function wildernessCampBlock(x: number, y: number, z: number): BlockId | null {
  if (y < SURFACE_HEIGHT || isInStoneBruteArena(x, z)
    || Math.hypot(x - TOWN_CENTER_X, z - TOWN_CENTER_Z) < TOWN_SAFE_RADIUS) return null;
  let camp: typeof WILDERNESS_CAMPS[number] | undefined;
  let nearest = Infinity;
  for (const site of WILDERNESS_CAMPS) {
    const dx = x - site.x; const dz = z - site.z;
    const distance = dx * dx + dz * dz;
    if (Math.abs(dx) <= site.radius + 3 && Math.abs(dz) <= site.radius + 3 && distance < nearest) {
      camp = site; nearest = distance;
    }
  }
  if (!camp) return null;
  const dx = x - camp.x; const dz = z - camp.z;
  if (Math.abs(dx) <= camp.radius + 1 && Math.abs(dz) <= camp.radius + 1) return null;
  if (y === SURFACE_HEIGHT) return camp.kind === "nest" ? Block.Dirt : camp.kind === "ruin" ? Block.Stone : Block.Dirt;
  const pillar = camp.kind === "spitter" && Math.abs(dx) === 3 && Math.abs(dz) === 2;
  const brokenWall = camp.kind === "ruin" && Math.abs(dx) === 4 && (Math.abs(dz) === 4 || Math.abs(dz) === 3);
  if ((pillar || brokenWall) && y <= SURFACE_HEIGHT + (Math.abs(dz) === 4 ? 3 : 2)) return Block.Stone;
  // Clear canopy above the encounter so cover and deposits can be read from the camera.
  return Block.Air;
}
export function authoredMineralAt(x: number, y: number, z: number): BlockId | null {
  if (y !== SURFACE_HEIGHT && y !== SURFACE_HEIGHT - 1) return null;
  return RENEWABLE_MINERAL_DEPOSITS.find(deposit => Math.abs(x - deposit.x) <= deposit.radius && Math.abs(z - deposit.z) <= deposit.radius)?.block ?? null;
}

/** Flat, exposed outcrops: visible ore, firm footing, no canopy or hidden drop. */
export function mineralOutcropBlock(x: number, y: number, z: number): BlockId | null {
  const deposit = MINERAL_DEPOSITS.find(point => Math.abs(x - point.x) <= point.radius + 1 && Math.abs(z - point.z) <= point.radius + 1);
  if (!deposit || y < SURFACE_HEIGHT - 2) return null;
  if (y > SURFACE_HEIGHT) return Block.Air;
  const core = Math.abs(x - deposit.x) <= deposit.radius && Math.abs(z - deposit.z) <= deposit.radius;
  return core && y >= SURFACE_HEIGHT - 1 ? deposit.block : Block.Stone;
}

export interface ChunkAddress {
  chunkX: number;
  chunkZ: number;
  localX: number;
  localZ: number;
}

export interface GeneratedChunk {
  chunkX: number;
  chunkZ: number;
  blocks: Uint8Array;
}

export interface VoxelPoint {
  x: number;
  y: number;
  z: number;
}

export interface VoxelRaycastHit extends VoxelPoint {
  block: BlockId;
  distance: number;
  previous: VoxelPoint;
}

export type WorldBlockReader = (x: number, y: number, z: number) => BlockId;

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

export interface PlayerMotionResult extends PlayerPosition {
  grounded: boolean;
  hitVertical: boolean;
  stepped: boolean;
}

function hash32(value: number): number {
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function hashSeed(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function noise(seed: number, x: number, y: number, z: number): number {
  return hash32(seed ^ Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) / 0xffffffff;
}

export function isInGreenwoodRegion(x: number, z: number): boolean {
  return x >= GREENWOOD_REGION.minX && x <= GREENWOOD_REGION.maxX
    && z >= GREENWOOD_REGION.minZ && z <= GREENWOOD_REGION.maxZ;
}

function isGreenwoodRoad(x: number, z: number): boolean {
  return (x >= GREENWOOD_REGION.minX && x <= GREENWOOD_REGION.maxX && (z === 8 || z === 9))
    || (x === 31 && z >= 8 && z <= 12)
    || (z === 12 && x >= 31 && x <= 40)
    || ((x === 39 || x === 40) && z >= 9 && z <= GREENWOOD_CAMP.minZ);
}

function isGreenwoodCampClearing(x: number, z: number): boolean {
  return x >= GREENWOOD_CAMP.minX - 3 && x <= GREENWOOD_CAMP.maxX + 5
    && z >= GREENWOOD_CAMP.minZ - 3 && z <= GREENWOOD_CAMP.maxZ + 3;
}

function isGreenwoodTreeCenter(seed: number, x: number, z: number): boolean {
  if (x < GREENWOOD_REGION.minX + 2 || x > GREENWOOD_REGION.maxX - 2
    || z < GREENWOOD_REGION.minZ + 2 || z > GREENWOOD_REGION.maxZ - 2
    || isGreenwoodRoad(x, z) || isGreenwoodCampClearing(x, z)
    || ((z >= 6 && z <= 14) || (x >= 37 && x <= 42 && z >= 9 && z <= GREENWOOD_CAMP.minZ))) return false;
  return hash32(seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(z, 0x119de1f3)) % 13 === 0;
}

/** Deterministic authored layer for the first Phase 1 wilderness region. */
export function greenwoodRegionBlock(seedText: string, worldX: number, y: number, worldZ: number): BlockId | null {
  if (!isInGreenwoodRegion(worldX, worldZ)) return null;
  const seam = worldX >= GREENWOOD_IRON_SEAM.minX && worldX <= GREENWOOD_IRON_SEAM.maxX
    && worldZ >= GREENWOOD_IRON_SEAM.minZ && worldZ <= GREENWOOD_IRON_SEAM.maxZ;
  if (seam && (y === SURFACE_HEIGHT || y === SURFACE_HEIGHT - 1)) return Block.IronOre;
  // A firm foundation under the clearing prevents generated cave pockets from
  // dropping a miner through the camp after removing its first surface block.
  if (isGreenwoodCampClearing(worldX, worldZ) && y >= SURFACE_HEIGHT - 2 && y < SURFACE_HEIGHT) return Block.Stone;
  if (y === SURFACE_HEIGHT) return isGreenwoodRoad(worldX, worldZ) || isGreenwoodCampClearing(worldX, worldZ)
    ? Block.Dirt
    : Block.Grass;
  if (y <= SURFACE_HEIGHT) return null;

  const seed = hashSeed(seedText) ^ 0x6a09e667;
  for (let dz = -2; dz <= 2; dz += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const centerX = worldX - dx;
      const centerZ = worldZ - dz;
      if (!isGreenwoodTreeCenter(seed, centerX, centerZ)) continue;
      const trunkTop = 10 + (hash32(seed ^ Math.imul(centerX, 97) ^ Math.imul(centerZ, 193)) % 2);
      if (dx === 0 && dz === 0 && y >= SURFACE_HEIGHT + 1 && y <= trunkTop) return Block.OakLog;
      const canopyY = trunkTop + 1;
      const horizontal = Math.abs(dx) + Math.abs(dz);
      if (y >= trunkTop && y <= canopyY + 1 && horizontal <= (y === canopyY + 1 ? 1 : 3)) return Block.Leaves;
    }
  }
  return null;
}

function milestoneCaveBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  for (const pocket of CAVE_ORE_POCKETS) {
    if (worldX < pocket.minX - 1 || worldX > pocket.maxX + 1 || worldZ < pocket.minZ - 1 || worldZ > pocket.maxZ || y >= SURFACE_HEIGHT) continue;
    // The deep chamber's existing exposed silver wall is the pocket entrance.
    if (pocket.id === "deep-silver" && worldZ === pocket.minZ - 1) continue;
    if (worldX >= pocket.minX && worldX <= pocket.maxX && worldZ >= pocket.minZ && worldZ <= pocket.maxZ
      && y > pocket.floorY && y <= pocket.floorY + 2) return pocket.block;
    // Solid floor and perimeter keep mining pockets supported across world seeds.
    if (worldZ >= pocket.minZ && worldZ <= pocket.maxZ || worldZ === pocket.minZ - 1) return Block.Stone;
  }
  // Authored stone enclosure prevents random generation from puncturing floors or the sealed chamber.
  if (worldX >= 31 && worldX <= 59 && worldZ >= 4 && worldZ <= 13 && y < SURFACE_HEIGHT) {
    if (worldX === 31) return y === SURFACE_HEIGHT ? Block.Grass : Block.Stone;
    if (worldX >= 42) {
      if (worldX <= 43 && worldZ >= 7 && worldZ <= 9) {
        const floor = worldX === 42 ? 1 : 0;
        return y > floor && y <= 5 ? Block.Air : Block.Stone;
      }
      const deep = worldX >= 44 && worldX <= 51 && worldZ >= 5 && worldZ <= 12;
      const hidden = worldX >= 53 && worldX <= 58 && worldZ >= 7 && worldZ <= 11;
      if ((deep || hidden) && y >= 1 && y <= 3) return Block.Air;
      // A two-block-high silver seam is the mineable doorway; no second open entrance.
      if (worldX === 52 && worldZ >= 8 && worldZ <= 9 && y >= 1 && y <= 3) return Block.SilverOre;
      if (worldX >= 46 && worldX <= 49 && worldZ === 13 && y >= 1 && y <= 2) return Block.SilverOre;
      if (worldX === 58 && worldZ >= 8 && worldZ <= 10 && y >= 1 && y <= 2) return Block.SilverOre;
      return y === SURFACE_HEIGHT ? Block.Grass : Block.Stone;
    }
    if (worldX >= 37 && worldX <= 40 && worldZ === 12 && y >= 3 && y <= 4) return Block.IronOre;
  }
  const caveX = worldX - MILESTONE_CAVE_X_OFFSET;
  const inChamberFootprint = caveX >= 22 && caveX <= 27 && worldZ >= 5 && worldZ <= 11;
  if (inChamberFootprint && y === 2) return Block.Stone;

  if (worldZ >= 7 && worldZ <= 9) {
    const entranceFloorY = caveX === 18 ? 6 : caveX === 19 ? 5 : caveX === 20 ? 4 : caveX === 21 ? 3 : null;
    if (entranceFloorY === y) return Block.Stone;
  }

  if (worldZ < 7 || worldZ > 9) {
    const inChamber = inChamberFootprint && y >= 3 && y <= 5;
    return inChamber ? Block.Air : worldX >= 31 && worldX <= 41 && worldZ >= 4 && worldZ <= 13 && y < SURFACE_HEIGHT ? Block.Stone : null;
  }
  if (caveX === 18 && y === SURFACE_HEIGHT) return Block.Air;
  if (caveX === 19 && y >= 6 && y <= SURFACE_HEIGHT) return Block.Air;
  if (caveX === 20 && y >= 5 && y <= SURFACE_HEIGHT) return Block.Air;
  if (caveX === 21 && y >= 4 && y <= 6) return Block.Air;
  if (caveX >= 22 && caveX <= 27 && y >= 3 && y <= 5) return Block.Air;
  return worldX >= 32 && worldX <= 41 && y < SURFACE_HEIGHT ? Block.Stone : null;
}

export function isTownTavernFootprint(worldX: number, worldZ: number): boolean {
  return worldX >= TOWN_TAVERN.minX && worldX <= TOWN_TAVERN.maxX
    && worldZ >= TOWN_TAVERN.minZ && worldZ <= TOWN_TAVERN.maxZ
    && (worldZ < 18 + TOWN_TAVERN_Z_OFFSET || (worldX >= 2 && worldX <= 14));
}

export function townTavernBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  if (!isTownTavernFootprint(worldX, worldZ)) return null;
  worldZ -= TOWN_TAVERN_Z_OFFSET;
  if (y === SURFACE_HEIGHT) return Block.Dirt;
  if (y === 12) return Block.Stone;
  if (y === 13) return worldX >= 1 && worldX <= 15 && worldZ >= 11 && worldZ <= 18 ? Block.Stone : null;
  if (y === 14) return worldX >= 3 && worldX <= 13 && worldZ >= 13 && worldZ <= 16 ? Block.Stone : null;
  if (y === 15 || y === 16) return worldX === 3 && worldZ === 16 ? Block.Stone : null;
  if (y < 8 || y > 11) return null;

  const edgeX = worldZ >= 18 ? worldX === 2 || worldX === 14 : worldX === 0 || worldX === 16;
  const perimeter = edgeX || worldZ === 10 || worldZ === 19
    || (worldZ === 17 && (worldX <= 2 || worldX >= 14));
  const doorway = (worldZ === 10 || worldZ === 19) && worldX >= 7 && worldX <= 9 && y <= 10;
  if (doorway) return Block.Air;
  if (perimeter) {
    const window = y === 9 && ((worldX === 0 || worldX === 16) && (worldZ === 12 || worldZ === 15)
      || (worldZ === 10 || worldZ === 19) && (worldX === 4 || worldX === 12));
    return window ? Block.Air : y === 8 ? Block.Stone : Block.Dirt;
  }
  // Furniture is low visual geometry rather than a full voxel: otherwise the
  // player auto-steps onto every table and visibly jolts inside the hall.
  if (worldX === 3 && worldZ === 16 && y >= 8) return Block.Stone;
  return Block.Air;
}

/** A continuous voxel rampart, with two-block-wide passages at the four cardinal gates. */
export function townWallBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  if (y < 8 || y > 11) return null;
  const dx = worldX - (TOWN_CENTER_X - 0.5);
  const dz = worldZ - (TOWN_CENTER_Z - 0.5);
  const radius = Math.hypot(dx, dz);
  if (radius < TOWN_SAFE_RADIUS - 0.5 || radius >= TOWN_SAFE_RADIUS + 0.5) return null;

  const gatePost = TOWN_GATE_POSTS.some(([x, z]) => worldX === x && worldZ === z);
  if (gatePost) return y === 11 ? Block.IronOre : Block.Stone;
  const gateOpening = (Math.abs(dx) === TOWN_SAFE_RADIUS && (worldZ === 8 || worldZ === 9))
    || (Math.abs(dz) === TOWN_SAFE_RADIUS && (worldX === 8 || worldX === 9));
  if (gateOpening) return y <= 9 ? Block.Air : y === 10 ? Block.Stone : Block.Air;
  if (y <= 10) return Block.Stone;
  return (worldX + worldZ + 72) % 3 === 0 ? Block.Stone : Block.Air;
}

export function townOfBeginningsBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  const tavern = townTavernBlock(worldX, y, worldZ);
  if (tavern !== null) return tavern;

  const wall = townWallBlock(worldX, y, worldZ);
  if (wall !== null) return wall;

  const beaconCenter = worldX === TOWN_BEACON_POSITION.x && worldZ === TOWN_BEACON_POSITION.z;
  const beaconBase = Math.abs(worldX - TOWN_BEACON_POSITION.x) <= 1 && Math.abs(worldZ - TOWN_BEACON_POSITION.z) <= 1;
  if (beaconCenter && y >= 8 && y <= 11) return Block.IronOre;
  if (beaconBase && y === 8) return Block.Stone;

  if (y === SURFACE_HEIGHT) {
    const plaza = worldX >= 3 && worldX <= 13 && worldZ >= 3 && worldZ <= 13;
    if (plaza) return Block.Stone;
    const road = ((worldX === 8 || worldX === 9) && worldZ >= -14 && worldZ <= 30)
      || ((worldZ === 8 || worldZ === 9) && worldX >= -14 && worldX <= 30)
      || ((worldZ === 1 || worldZ === 2) && worldX >= -2 && worldX <= 23)
      || ((worldX === 21 || worldX === 22) && worldZ >= 2 && worldZ <= 9)
      || (worldZ === 19 && worldX >= 8 && worldX <= 16);
    if (road) return Block.Dirt;
  }
  return null;
}

export function chunkIndex(x: number, y: number, z: number): number {
  return y * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x;
}

export function worldToChunk(x: number, z: number): ChunkAddress {
  const chunkX = Math.floor(x / CHUNK_SIZE);
  const chunkZ = Math.floor(z / CHUNK_SIZE);
  return {
    chunkX,
    chunkZ,
    localX: x - chunkX * CHUNK_SIZE,
    localZ: z - chunkZ * CHUNK_SIZE,
  };
}

export function isProtectedVoxel(x: number, z: number): boolean {
  return Math.hypot(x - TOWN_CENTER_X, z - TOWN_CENTER_Z) <= SPAWN_PROTECTION_RADIUS
    || townWallBlock(x, 8, z) !== null || isCaveReturnRoute(x, z);
}

export function generateChunk(seedText: string, chunkX: number, chunkZ: number): GeneratedChunk {
  const seed = hashSeed(seedText);
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);

  for (let localZ = 0; localZ < CHUNK_SIZE; localZ += 1) {
    for (let localX = 0; localX < CHUNK_SIZE; localX += 1) {
      const worldX = chunkX * CHUNK_SIZE + localX;
      const worldZ = chunkZ * CHUNK_SIZE + localZ;
      const height = SURFACE_HEIGHT;

      for (let y = 0; y <= height; y += 1) {
        let block: BlockId = y === 0 ? Block.Bedrock : y === height ? wildernessSurfaceBlock(worldX, worldZ) : y >= height - 2 ? Block.Dirt : Block.Stone;
        const cave = y > 1 && y < height - 1 && noise(seed, worldX, y, worldZ) > 0.86;
        if (cave) block = Block.Air;
        else if (block === Block.Stone && noise(seed ^ 0x9e3779b9, worldX, y, worldZ) > 0.94) block = Block.IronOre;
        blocks[chunkIndex(localX, y, localZ)] = block;
      }

      for (let y = 1; y < CHUNK_HEIGHT; y += 1) {
        const caveBlock = milestoneCaveBlock(worldX, y, worldZ);
        if (caveBlock !== null) blocks[chunkIndex(localX, y, localZ)] = caveBlock;
        const greenwoodBlock = greenwoodRegionBlock(seedText, worldX, y, worldZ);
        if (greenwoodBlock !== null && caveBlock === null) blocks[chunkIndex(localX, y, localZ)] = greenwoodBlock;
        const arenaBlock = stoneBruteArenaBlock(worldX, y, worldZ);
        if (arenaBlock !== null) blocks[chunkIndex(localX, y, localZ)] = arenaBlock;
        const campBlock = wildernessCampBlock(worldX, y, worldZ);
        if (campBlock !== null) blocks[chunkIndex(localX, y, localZ)] = campBlock;
        const mineralBlock = mineralOutcropBlock(worldX, y, worldZ);
        const silverGuardBlock = silverGuardEncounterBlock(worldX, y, worldZ);
        if (silverGuardBlock !== null) blocks[chunkIndex(localX, y, localZ)] = silverGuardBlock;
        if (mineralBlock !== null) blocks[chunkIndex(localX, y, localZ)] = mineralBlock;
        // The authored cave owns its subsurface geometry, regardless of surface biome overlays.
        if (caveBlock !== null && y < SURFACE_HEIGHT) blocks[chunkIndex(localX, y, localZ)] = caveBlock;
        const townBlock = townOfBeginningsBlock(worldX, y, worldZ);
        if (townBlock !== null) blocks[chunkIndex(localX, y, localZ)] = townBlock;
      }
    }
  }

  return { chunkX, chunkZ, blocks };
}

export function getBlock(chunk: GeneratedChunk, localX: number, y: number, localZ: number): BlockId {
  if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return Block.Air;
  return chunk.blocks[chunkIndex(localX, y, localZ)] as BlockId;
}

export function setBlock(chunk: GeneratedChunk, localX: number, y: number, localZ: number, block: BlockId): void {
  if (localX < 0 || localX >= CHUNK_SIZE || localZ < 0 || localZ >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
  chunk.blocks[chunkIndex(localX, y, localZ)] = block;
}

export function highestSolidY(chunk: GeneratedChunk, localX: number, localZ: number): number {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
    if (getBlock(chunk, localX, y, localZ) !== Block.Air) return y;
  }
  return 0;
}

export function playerCollides(readBlock: WorldBlockReader, x: number, y: number, z: number): boolean {
  const chest = TOWN_STORAGE_CHEST_POSITION;
  if (y + PLAYER_HEIGHT > chest.y && y < chest.y + .95
    && readBlock(Math.floor(chest.x), SURFACE_HEIGHT, Math.floor(chest.z)) !== Block.Air) {
    const dx = Math.max(0, Math.abs(x - chest.x) - .65);
    const dz = Math.max(0, Math.abs(z - chest.z) - .45);
    if (Math.hypot(dx, dz) < PLAYER_RADIUS) return true;
  }
  if (y + PLAYER_HEIGHT - 0.06 > TOWN_BLACKSMITH_STALL_COLLIDER.minY
    && y + 0.06 < TOWN_BLACKSMITH_STALL_COLLIDER.maxY
    && readBlock(Math.floor(TOWN_BLACKSMITH_STALL_POSITION.x), SURFACE_HEIGHT, Math.floor(TOWN_BLACKSMITH_STALL_POSITION.z)) !== Block.Air) {
    const box = TOWN_BLACKSMITH_STALL_COLLIDER;
    const nearestX = Math.max(box.x - box.width / 2, Math.min(x, box.x + box.width / 2));
    const nearestZ = Math.max(box.z - box.depth / 2, Math.min(z, box.z + box.depth / 2));
    if (Math.hypot(x - nearestX, z - nearestZ) < PLAYER_RADIUS) return true;
  }
  // Tavern details are rendered below voxel resolution. Keep their physical footprints
  // shared by the authoritative server and client prediction without creating stepable blocks.
  if (x >= TOWN_TAVERN.minX && x <= TOWN_TAVERN.maxX + 1
    && z >= TOWN_TAVERN.minZ && z <= TOWN_TAVERN.maxZ + 1
    && y < 10 && y + PLAYER_HEIGHT > 8
    && readBlock(8, 12, 14 + TOWN_TAVERN_Z_OFFSET) === Block.Stone
    && readBlock(8, 8, 14 + TOWN_TAVERN_Z_OFFSET) === Block.Air
    && TOWN_TAVERN_FURNITURE_COLLIDERS.some(box => {
      if (y + PLAYER_HEIGHT - 0.06 <= box.minY || y + 0.06 >= box.maxY) return false;
      const nearestX = Math.max(box.x - box.width / 2, Math.min(x, box.x + box.width / 2));
      const nearestZ = Math.max(box.z - box.depth / 2, Math.min(z, box.z + box.depth / 2));
      return Math.hypot(x - nearestX, z - nearestZ) < PLAYER_RADIUS;
    })) return true;
  const minX = Math.floor(x - PLAYER_RADIUS);
  const maxX = Math.floor(x + PLAYER_RADIUS);
  const minY = Math.floor(y + 0.06);
  const maxY = Math.floor(y + PLAYER_HEIGHT - 0.06);
  const minZ = Math.floor(z - PLAYER_RADIUS);
  const maxZ = Math.floor(z + PLAYER_RADIUS);
  for (let blockY = minY; blockY <= maxY; blockY += 1) {
    for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
      for (let blockX = minX; blockX <= maxX; blockX += 1) {
        if (readBlock(blockX, blockY, blockZ) !== Block.Air) return true;
      }
    }
  }
  return false;
}

export function isPlayerSupported(readBlock: WorldBlockReader, x: number, y: number, z: number): boolean {
  return hasPlayerSupport(readBlock, x, y, z, PLAYER_RADIUS * 0.82);
}

function hasPlayerSupport(readBlock: WorldBlockReader, x: number, y: number, z: number, sampleRadius: number): boolean {
  const supportY = Math.floor(y - 0.08);
  for (const offsetX of [-sampleRadius, sampleRadius]) {
    for (const offsetZ of [-sampleRadius, sampleRadius]) {
      if (readBlock(Math.floor(x + offsetX), supportY, Math.floor(z + offsetZ)) !== Block.Air) return true;
    }
  }
  return false;
}

function moveVertical(position: PlayerPosition, deltaY: number, readBlock: WorldBlockReader): { hit: boolean } {
  if (deltaY === 0) return { hit: false };
  const steps = Math.max(1, Math.ceil(Math.abs(deltaY) / 0.08));
  const step = deltaY / steps;
  for (let index = 0; index < steps; index += 1) {
    if (playerCollides(readBlock, position.x, position.y + step, position.z)) return { hit: true };
    position.y += step;
  }
  return { hit: false };
}

function moveHorizontalAxis(
  position: PlayerPosition,
  axis: "x" | "z",
  amount: number,
  canStep: boolean,
  readBlock: WorldBlockReader,
): boolean {
  if (amount === 0) return false;
  const candidate = { ...position, [axis]: position[axis] + amount };
  if (!playerCollides(readBlock, candidate.x, candidate.y, candidate.z)) {
    position[axis] = candidate[axis];
    return false;
  }
  if (!canStep) return false;
  candidate.y += 1;
  if (playerCollides(readBlock, candidate.x, candidate.y, candidate.z)) return false;
  // The leading edge touches a step before the inset grounded samples cross
  // the voxel boundary. Use the complete collider footprint for step support.
  if (!hasPlayerSupport(readBlock, candidate.x, candidate.y, candidate.z, PLAYER_RADIUS)) return false;
  position[axis] = candidate[axis];
  position.y = candidate.y;
  return true;
}

export function resolvePlayerMotion(
  start: PlayerPosition,
  delta: PlayerPosition,
  readBlock: WorldBlockReader,
): PlayerMotionResult {
  const position = { ...start };
  const supportedBeforeMove = isPlayerSupported(readBlock, position.x, position.y, position.z);
  const steppedX = moveHorizontalAxis(position, "x", delta.x, supportedBeforeMove, readBlock);
  const steppedZ = moveHorizontalAxis(position, "z", delta.z, supportedBeforeMove || steppedX, readBlock);
  const vertical = moveVertical(position, delta.y, readBlock);
  return {
    ...position,
    grounded: isPlayerSupported(readBlock, position.x, position.y, position.z),
    hitVertical: vertical.hit,
    stepped: steppedX || steppedZ,
  };
}

export function resolveSweptHorizontalMotion(
  start: PlayerPosition,
  delta: Pick<PlayerPosition, "x" | "z">,
  readBlock: WorldBlockReader,
  maximumStep = 0.3,
): PlayerMotionResult {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.z)) / maximumStep));
  const stepX = delta.x / steps;
  const stepZ = delta.z / steps;
  let position: PlayerPosition = { ...start };
  let stepped = false;
  for (let index = 0; index < steps; index += 1) {
    const next = resolvePlayerMotion(position, { x: stepX, y: 0, z: stepZ }, readBlock);
    stepped ||= next.stepped;
    const moved = Math.hypot(next.x - position.x, next.z - position.z);
    position = next;
    if (moved < 0.0001) break;
  }
  return {
    ...position,
    grounded: isPlayerSupported(readBlock, position.x, position.y, position.z),
    hitVertical: false,
    stepped,
  };
}

export function voxelRaycast(
  origin: VoxelPoint,
  direction: VoxelPoint,
  maxDistance: number,
  readBlock: WorldBlockReader,
): VoxelRaycastHit | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length === 0 || maxDistance < 0) return null;

  const dx = direction.x / length;
  const dy = direction.y / length;
  const dz = direction.z / length;
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  let previous = { x, y, z };
  let distance = 0;

  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const stepZ = Math.sign(dz);
  const deltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx);
  const deltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy);
  const deltaZ = dz === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dz);
  let sideX = dx > 0 ? (x + 1 - origin.x) * deltaX : dx < 0 ? (origin.x - x) * deltaX : Number.POSITIVE_INFINITY;
  let sideY = dy > 0 ? (y + 1 - origin.y) * deltaY : dy < 0 ? (origin.y - y) * deltaY : Number.POSITIVE_INFINITY;
  let sideZ = dz > 0 ? (z + 1 - origin.z) * deltaZ : dz < 0 ? (origin.z - z) * deltaZ : Number.POSITIVE_INFINITY;

  while (distance <= maxDistance) {
    const block = readBlock(x, y, z);
    if (block !== Block.Air) return { x, y, z, block, distance, previous };

    previous = { x, y, z };
    if (sideX <= sideY && sideX <= sideZ) {
      distance = sideX;
      sideX += deltaX;
      x += stepX;
    } else if (sideY <= sideZ) {
      distance = sideY;
      sideY += deltaY;
      y += stepY;
    } else {
      distance = sideZ;
      sideZ += deltaZ;
      z += stepZ;
    }
  }

  return null;
}
