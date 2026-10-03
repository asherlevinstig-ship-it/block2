export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 24;
export const SURFACE_HEIGHT = 7;
export const TOWN_CENTER_X = CHUNK_SIZE / 2 + 0.5;
export const TOWN_CENTER_Z = CHUNK_SIZE / 2 + 0.5;
export const TOWN_SAFE_RADIUS = 14;
export const SPAWN_PROTECTION_RADIUS = TOWN_SAFE_RADIUS;
export const TOWN_TAVERN = { minX: 0, maxX: 16, minZ: 10, maxZ: 19, roofBaseY: 12, roofTopY: 16 } as const;
export const TOWN_BUILDINGS = [TOWN_TAVERN] as const;
export const TOWN_GATE_POSTS = [
  [-6, 7], [-6, 10], [22, 7], [22, 10],
  [7, -6], [10, -6], [7, 22], [10, 22],
] as const;
export const PLAYER_RADIUS = 0.28;
export const PLAYER_HEIGHT = 1.45;
export const GRAVITY = 18;
export const TERMINAL_VELOCITY = 12;

export const Block = {
  Air: 0,
  Bedrock: 1,
  Stone: 2,
  Dirt: 3,
  Grass: 4,
  IronOre: 5,
} as const;

export type BlockId = (typeof Block)[keyof typeof Block];

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

function milestoneCaveBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  const inChamberFootprint = worldX >= 22 && worldX <= 27 && worldZ >= 5 && worldZ <= 11;
  if (inChamberFootprint && y === 2) return Block.Stone;

  if (worldZ >= 7 && worldZ <= 9) {
    const entranceFloorY = worldX === 18 ? 6 : worldX === 19 ? 5 : worldX === 20 ? 4 : worldX === 21 ? 3 : null;
    if (entranceFloorY === y) return Block.Stone;
  }

  if (worldZ < 7 || worldZ > 9) {
    const inChamber = inChamberFootprint && y >= 3 && y <= 5;
    return inChamber ? Block.Air : null;
  }
  if (worldX === 18 && y === SURFACE_HEIGHT) return Block.Air;
  if (worldX === 19 && y >= 6 && y <= SURFACE_HEIGHT) return Block.Air;
  if (worldX === 20 && y >= 5 && y <= SURFACE_HEIGHT) return Block.Air;
  if (worldX === 21 && y >= 4 && y <= 6) return Block.Air;
  if (worldX >= 22 && worldX <= 27 && y >= 3 && y <= 5) return Block.Air;
  return null;
}

export function isTownTavernFootprint(worldX: number, worldZ: number): boolean {
  return worldX >= TOWN_TAVERN.minX && worldX <= TOWN_TAVERN.maxX
    && worldZ >= TOWN_TAVERN.minZ && worldZ <= TOWN_TAVERN.maxZ
    && (worldZ < 18 || (worldX >= 2 && worldX <= 14));
}

export function townTavernBlock(worldX: number, y: number, worldZ: number): BlockId | null {
  if (!isTownTavernFootprint(worldX, worldZ)) return null;
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
  const table = y === 8 && (worldZ === 13 || worldZ === 16)
    && ((worldX >= 3 && worldX <= 5) || (worldX >= 11 && worldX <= 13));
  if (table) return Block.Dirt;
  if (worldX === 3 && worldZ === 16 && y >= 9) return Block.Stone;
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

  const beaconCenter = worldX === 8 && worldZ === 4;
  const beaconBase = Math.abs(worldX - 8) <= 1 && Math.abs(worldZ - 4) <= 1;
  if (beaconCenter && y >= 8 && y <= 11) return Block.IronOre;
  if (beaconBase && y === 8) return Block.Stone;

  if (y === SURFACE_HEIGHT) {
    const plaza = worldX >= 5 && worldX <= 11 && worldZ >= 5 && worldZ <= 11;
    if (plaza) return Block.Stone;
    const road = ((worldX === 8 || worldX === 9) && worldZ >= -6 && worldZ <= 22)
      || ((worldZ === 8 || worldZ === 9) && worldX >= -6 && worldX <= 17)
      || (worldZ === 1 && worldX >= 5 && worldX <= 8)
      || (worldZ === 16 && worldX >= 5 && worldX <= 8)
      || (worldX === 1 && worldZ >= 9 && worldZ <= 11)
      || (worldZ === 13 && worldX >= 8 && worldX <= 16);
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
    || townWallBlock(x, 8, z) !== null;
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
        let block: BlockId = y === 0 ? Block.Bedrock : y === height ? Block.Grass : y >= height - 2 ? Block.Dirt : Block.Stone;
        const cave = y > 1 && y < height - 1 && noise(seed, worldX, y, worldZ) > 0.86;
        if (cave) block = Block.Air;
        else if (block === Block.Stone && noise(seed ^ 0x9e3779b9, worldX, y, worldZ) > 0.94) block = Block.IronOre;
        blocks[chunkIndex(localX, y, localZ)] = block;
      }

      for (let y = 1; y < CHUNK_HEIGHT; y += 1) {
        const caveBlock = milestoneCaveBlock(worldX, y, worldZ);
        if (caveBlock !== null) blocks[chunkIndex(localX, y, localZ)] = caveBlock;
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
