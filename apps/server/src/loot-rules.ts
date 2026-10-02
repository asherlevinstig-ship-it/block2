import type { ItemId } from "@blockcraft/protocol";
import type { MobArchetypeId } from "./mob-archetypes.js";

export const LOOT_DESPAWN_MS = 30_000;
export const LOOT_PICKUP_RADIUS = 1.35;

const LOOT_BY_ARCHETYPE: Record<MobArchetypeId, readonly { itemId: ItemId; quantity: number }[]> = {
  moss_crawler: [
    { itemId: "moss_fibre", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
    { itemId: "fang_dagger", quantity: 1 },
  ],
  stone_brute: [
    { itemId: "stone_core", quantity: 1 },
    { itemId: "stone_core_hammer", quantity: 1 },
  ],
  cave_spitter: [
    { itemId: "acid_gland", quantity: 1 },
    { itemId: "acid_gland_focus", quantity: 1 },
  ],
};

export function lootForArchetype(archetypeId: MobArchetypeId): readonly { itemId: ItemId; quantity: number }[] {
  return LOOT_BY_ARCHETYPE[archetypeId];
}

export function isLootInPickupRange(
  player: { x: number; y: number; z: number },
  drop: { x: number; y: number; z: number },
  radius = LOOT_PICKUP_RADIUS,
): boolean {
  return Math.hypot(player.x - drop.x, player.y - drop.y, player.z - drop.z) <= radius;
}

export function inventoryTotal(current: number | undefined, quantity: number): number {
  return Math.min(65_535, Math.max(0, Math.floor(current ?? 0)) + Math.max(0, Math.floor(quantity)));
}
