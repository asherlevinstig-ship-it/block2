import type { ItemId } from "@blockcraft/protocol";
import type { MobArchetypeId } from "./mob-archetypes.js";
import { isSilverGuard } from "./wilderness-encounters.js";

export const LOOT_DESPAWN_MS = 30_000;
export const LOOT_PICKUP_RADIUS = 1.35;
export function armourDropForMob(archetype: string, tier: number, roll: number): { itemId: ItemId; quantity: number }[] {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return [];
  if ((archetype === "moss_crawler" || archetype === "briar_crawler") && roll < .2) return [{ itemId: "leather_armour", quantity: 1 }];
  if (archetype === "stone_brute" && tier >= 3 && roll < .25) return [{ itemId: "iron_armour", quantity: 1 }];
  return [];
}

const LOOT_BY_ARCHETYPE: Record<MobArchetypeId, readonly { itemId: ItemId; quantity: number }[]> = {
  moss_crawler: [
    { itemId: "moss_fibre", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
    { itemId: "fang_dagger", quantity: 1 },
  ],
  briar_crawler: [
    { itemId: "moss_fibre", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
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

export function lootForArchetype(archetypeId: MobArchetypeId, mobId = ""): readonly { itemId: ItemId; quantity: number }[] {
  if (archetypeId === "cave_spitter" && isSilverGuard(mobId)) return [
    { itemId: "acid_gland", quantity: 2 }, { itemId: "acid_gland_focus", quantity: 1 }, { itemId: "healing_potion", quantity: 1 },
  ];
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
