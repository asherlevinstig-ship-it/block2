/**
 * The overworld should breathe after a fight. Every enemy leaves at least a
 * forty-second clearing, while each level above one adds another five seconds.
 */
export const WILDERNESS_RESPAWN_MIN_MS = 40_000;
export const WILDERNESS_RESPAWN_PER_LEVEL_MS = 5_000;
export const WILDERNESS_RESPAWN_STAGGER_MS = 1_500;
export const WILDERNESS_RESPAWN_SAFE_RADIUS = 8;
export const WILDERNESS_RESPAWN_RECHECK_MS = 1_000;
export const WILDERNESS_MATERIALIZE_MS = 1_500;
const WILDERNESS_RESPAWN_STAGGER_SLOTS = 4;

function stableSlot(id: string): number {
  const packIndex = /:(\d+)$/.exec(id)?.[1];
  if (packIndex !== undefined) return Number(packIndex) % WILDERNESS_RESPAWN_STAGGER_SLOTS;
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % WILDERNESS_RESPAWN_STAGGER_SLOTS;
}

/** Stable offsets stop a freshly cleared group from reforming on one frame. */
export function wildernessRespawnDelay(mobId: string, level: number): number {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  return WILDERNESS_RESPAWN_MIN_MS + (safeLevel - 1) * WILDERNESS_RESPAWN_PER_LEVEL_MS
    + stableSlot(mobId) * WILDERNESS_RESPAWN_STAGGER_MS;
}

export function wildernessSpawnClear(spawn: { x: number; y: number; z: number },
  players: Iterable<{ x: number; y: number; z: number; health: number }>): boolean {
  for (const player of players) {
    if (player.health <= 0 || Math.abs(player.y - spawn.y) > 2.5) continue;
    if (Math.hypot(player.x - spawn.x, player.z - spawn.z) < WILDERNESS_RESPAWN_SAFE_RADIUS) return false;
  }
  return true;
}
