import {
  fastWorldRegionDefinition,
  type FastWorldRegionBounds,
  type FastWorldRegionId,
} from "@blockcraft/protocol";

export const FAST_WORLD_VISUAL_CHUNK_SIZE = 32;
export const FAST_WORLD_STREAMED_REGION_IDS = [
  "greenwood", "mistfen", "sunken-coast", "southern-quarry", "ashen-reach",
] as const;
export type FastWorldStreamedRegionId = typeof FAST_WORLD_STREAMED_REGION_IDS[number];

export type FastWorldVisualChunk = {
  key: string;
  regionId: FastWorldStreamedRegionId;
  chunkX: number;
  chunkZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
};

const streamedRegionSet = new Set<FastWorldRegionId>(FAST_WORLD_STREAMED_REGION_IDS);

export const fastWorldVisualChunkKey = (regionId: FastWorldStreamedRegionId, chunkX: number, chunkZ: number): string =>
  `${regionId}:${chunkX}:${chunkZ}`;

const chunkRange = (bounds: FastWorldRegionBounds): { minChunkX: number; maxChunkX: number; minChunkZ: number; maxChunkZ: number } => ({
  minChunkX: Math.floor(bounds.minX / FAST_WORLD_VISUAL_CHUNK_SIZE),
  maxChunkX: Math.floor((bounds.maxX - 1e-6) / FAST_WORLD_VISUAL_CHUNK_SIZE),
  minChunkZ: Math.floor(bounds.minZ / FAST_WORLD_VISUAL_CHUNK_SIZE),
  maxChunkZ: Math.floor((bounds.maxZ - 1e-6) / FAST_WORLD_VISUAL_CHUNK_SIZE),
});

export function fastWorldRegionVisualChunks(regionId: FastWorldStreamedRegionId): readonly FastWorldVisualChunk[] {
  const region = fastWorldRegionDefinition(regionId);
  const range = chunkRange(region.bounds);
  const chunks: FastWorldVisualChunk[] = [];
  for (let chunkX = range.minChunkX; chunkX <= range.maxChunkX; chunkX++) {
    for (let chunkZ = range.minChunkZ; chunkZ <= range.maxChunkZ; chunkZ++) {
      const minX = Math.max(region.bounds.minX, chunkX * FAST_WORLD_VISUAL_CHUNK_SIZE);
      const maxX = Math.min(region.bounds.maxX, (chunkX + 1) * FAST_WORLD_VISUAL_CHUNK_SIZE);
      const minZ = Math.max(region.bounds.minZ, chunkZ * FAST_WORLD_VISUAL_CHUNK_SIZE);
      const maxZ = Math.min(region.bounds.maxZ, (chunkZ + 1) * FAST_WORLD_VISUAL_CHUNK_SIZE);
      chunks.push({
        key: fastWorldVisualChunkKey(regionId, chunkX, chunkZ),
        regionId,
        chunkX,
        chunkZ,
        minX,
        maxX,
        minZ,
        maxZ,
        centerX: (minX + maxX) * .5,
        centerZ: (minZ + maxZ) * .5,
        width: maxX - minX,
        depth: maxZ - minZ,
      });
    }
  }
  return chunks;
}

const visualChunks = FAST_WORLD_STREAMED_REGION_IDS.flatMap(fastWorldRegionVisualChunks);
const visualChunkKeys = new Set(visualChunks.map(chunk => chunk.key));

export function fastWorldVisualChunkForPosition(regionId: FastWorldStreamedRegionId, x: number, z: number): string {
  return fastWorldVisualChunkKey(regionId, Math.floor(x / FAST_WORLD_VISUAL_CHUNK_SIZE),
    Math.floor(z / FAST_WORLD_VISUAL_CHUNK_SIZE));
}

export function fastWorldActiveVisualChunkKeys(x: number, z: number, radius = 1): Set<string> {
  const playerChunkX = Math.floor(x / FAST_WORLD_VISUAL_CHUNK_SIZE);
  const playerChunkZ = Math.floor(z / FAST_WORLD_VISUAL_CHUNK_SIZE);
  const active = new Set<string>();
  for (const regionId of FAST_WORLD_STREAMED_REGION_IDS) {
    for (let chunkX = playerChunkX - radius; chunkX <= playerChunkX + radius; chunkX++) {
      for (let chunkZ = playerChunkZ - radius; chunkZ <= playerChunkZ + radius; chunkZ++) {
        const key = fastWorldVisualChunkKey(regionId, chunkX, chunkZ);
        if (visualChunkKeys.has(key)) active.add(key);
      }
    }
  }
  return active;
}

export const fastWorldRegionStreamsVisuals = (regionId: FastWorldRegionId): regionId is FastWorldStreamedRegionId =>
  streamedRegionSet.has(regionId);

export type FastWorldVisualStreamChange = {
  active: Set<string>;
  activated: readonly string[];
  deactivated: readonly string[];
};

export class FastWorldVisualChunkStream {
  private playerChunkKey = "";
  private active = new Set<string>();

  constructor(private readonly radius = 1) {}

  update(x: number, z: number, force = false): FastWorldVisualStreamChange | null {
    const playerChunkKey = `${Math.floor(x / FAST_WORLD_VISUAL_CHUNK_SIZE)}:${Math.floor(z / FAST_WORLD_VISUAL_CHUNK_SIZE)}`;
    if (!force && playerChunkKey === this.playerChunkKey) return null;
    this.playerChunkKey = playerChunkKey;
    const next = fastWorldActiveVisualChunkKeys(x, z, this.radius);
    const activated = [...next].filter(key => !this.active.has(key));
    const deactivated = [...this.active].filter(key => !next.has(key));
    this.active = next;
    return { active: new Set(next), activated, deactivated };
  }
}
