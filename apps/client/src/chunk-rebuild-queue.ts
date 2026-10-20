export interface ChunkRebuildLocation {
  chunkX: number;
  chunkZ: number;
}

export function nearestQueuedChunkKey<T extends ChunkRebuildLocation>(
  queued: ReadonlyMap<string, T>,
  center: ChunkRebuildLocation,
): string | null {
  let nearestKey: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const [key, chunk] of queued) {
    const distance = Math.abs(chunk.chunkX - center.chunkX) + Math.abs(chunk.chunkZ - center.chunkZ);
    if (distance < nearestDistance || (distance === nearestDistance && (nearestKey === null || key < nearestKey))) {
      nearestDistance = distance;
      nearestKey = key;
    }
  }
  return nearestKey;
}
