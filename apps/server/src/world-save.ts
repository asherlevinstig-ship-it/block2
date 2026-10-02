import {
  Block,
  CHUNK_HEIGHT,
  getBlock,
  setBlock,
  worldToChunk,
  type BlockId,
  type GeneratedChunk,
} from "@blockcraft/voxel-world";

export const WORLD_DELTA_NAMESPACE = "blockcraft:world-deltas:v1";

export interface WorldBlockDelta {
  x: number;
  y: number;
  z: number;
  block: BlockId;
}

const VALID_BLOCKS = new Set<number>(Object.values(Block));

export function worldDeltaHashKey(seed: string): string {
  return `${WORLD_DELTA_NAMESPACE}:${encodeURIComponent(seed)}`;
}

export function worldDeltaField(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function parseWorldDelta(field: string, value: string): WorldBlockDelta | null {
  const coordinates = field.split(",").map(Number);
  if (coordinates.length !== 3) return null;
  const x = coordinates[0];
  const y = coordinates[1];
  const z = coordinates[2];
  if (x === undefined || y === undefined || z === undefined) return null;
  const block = Number(value);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
  if (y < 0 || y >= CHUNK_HEIGHT || !Number.isInteger(block) || !VALID_BLOCKS.has(block)) return null;
  return { x, y, z, block: block as BlockId };
}

export function parseWorldDeltas(values: Record<string, string>): WorldBlockDelta[] {
  const deltas: WorldBlockDelta[] = [];
  for (const [field, value] of Object.entries(values)) {
    const delta = parseWorldDelta(field, value);
    if (delta) deltas.push(delta);
  }
  return deltas;
}

export function applyWorldDeltasToChunk(chunk: GeneratedChunk, deltas: Iterable<WorldBlockDelta>): number {
  let applied = 0;
  for (const delta of deltas) {
    const address = worldToChunk(delta.x, delta.z);
    if (address.chunkX !== chunk.chunkX || address.chunkZ !== chunk.chunkZ) continue;
    if (getBlock(chunk, address.localX, delta.y, address.localZ) === delta.block) continue;
    setBlock(chunk, address.localX, delta.y, address.localZ, delta.block);
    applied += 1;
  }
  return applied;
}
