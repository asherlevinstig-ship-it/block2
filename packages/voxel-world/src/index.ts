export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 24;
export const SURFACE_HEIGHT = 7;
export const SPAWN_PROTECTION_RADIUS = 6;
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
  const spawnX = CHUNK_SIZE / 2;
  const spawnZ = CHUNK_SIZE / 2;
  return Math.hypot(x - spawnX, z - spawnZ) <= SPAWN_PROTECTION_RADIUS;
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
