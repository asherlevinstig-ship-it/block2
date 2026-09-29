export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 24;
export const SPAWN_PROTECTION_RADIUS = 6;

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
      const height = 6 + Math.floor(noise(seed, worldX >> 2, 0, worldZ >> 2) * 4);

      for (let y = 0; y <= height; y += 1) {
        let block: BlockId = y === 0 ? Block.Bedrock : y === height ? Block.Grass : y >= height - 2 ? Block.Dirt : Block.Stone;
        const cave = y > 1 && y < height - 1 && noise(seed, worldX, y, worldZ) > 0.86;
        if (cave) block = Block.Air;
        else if (block === Block.Stone && noise(seed ^ 0x9e3779b9, worldX, y, worldZ) > 0.94) block = Block.IronOre;
        blocks[chunkIndex(localX, y, localZ)] = block;
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
