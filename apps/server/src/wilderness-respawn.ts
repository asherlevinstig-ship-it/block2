import type { MobArchetypeId } from "./mob-archetypes.js";

/**
 * The overworld should breathe after a fight. Lighter enemies return sooner,
 * while heavier threats leave a longer window to loot, heal, and reposition.
 */
export const WILDERNESS_RESPAWN_BASE_MS: Readonly<Record<MobArchetypeId, number>> = {
  moss_crawler: 12_000,
  briar_crawler: 14_000,
  cave_spitter: 16_000,
  stone_brute: 22_000,
};

export const WILDERNESS_RESPAWN_STAGGER_MS = 1_500;
const WILDERNESS_RESPAWN_STAGGER_SLOTS = 4;

function stableSlot(id: string): number {
  const packIndex = /:(\d+)$/.exec(id)?.[1];
  if (packIndex !== undefined) return Number(packIndex) % WILDERNESS_RESPAWN_STAGGER_SLOTS;
  let hash = 0;
  for (let index = 0; index < id.length; index++) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return hash % WILDERNESS_RESPAWN_STAGGER_SLOTS;
}

/** Stable offsets stop a freshly cleared group from reforming on one frame. */
export function wildernessRespawnDelay(mobId: string, archetype: MobArchetypeId): number {
  return WILDERNESS_RESPAWN_BASE_MS[archetype] + stableSlot(mobId) * WILDERNESS_RESPAWN_STAGGER_MS;
}
