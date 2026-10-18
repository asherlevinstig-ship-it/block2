import type { ItemId } from "@blockcraft/protocol";
import type { MobArchetypeId } from "./mob-archetypes.js";
import { isSilverGuard } from "./wilderness-encounters.js";

export const LOOT_DESPAWN_MS = 120_000;
export const LOOT_PICKUP_RADIUS = 1.35;
export const EQUIPMENT_DROP_CHANCES = {
  fang_dagger: .14,
  acid_gland_focus: .12,
  forged_focus: .1,
  stone_core_hammer: .09,
  leather_armour: .08,
  iron_armour: .1,
} as const satisfies Partial<Record<ItemId, number>>;

export type LootThreat = "normal" | "guard" | "elite" | "miniboss" | "champion";

function equipmentChance(itemId: keyof typeof EQUIPMENT_DROP_CHANCES, threat: LootThreat): number {
  if (threat === "champion" || threat === "miniboss") return 1;
  if (threat === "elite") return .4;
  if (threat === "guard") return .3;
  return EQUIPMENT_DROP_CHANCES[itemId];
}

export class NormalLootCadence {
  record(_playerId: string, _roll: number): boolean {
    // Every credited defeat should create a readable personal material bag.
    // Equipment inside the bag still uses the per-archetype rarity roll below.
    return true;
  }
}

export function armourDropForMob(archetype: string, tier: number, roll: number): { itemId: ItemId; quantity: number }[] {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return [];
  if ((archetype === "moss_crawler" || archetype === "briar_crawler" || archetype === "ridge_stalker") && roll < EQUIPMENT_DROP_CHANCES.leather_armour) return [{ itemId: "leather_armour", quantity: 1 }];
  if (archetype === "stone_brute" && tier >= 3 && roll < EQUIPMENT_DROP_CHANCES.iron_armour) return [{ itemId: "iron_armour", quantity: 1 }];
  return [];
}

const MATERIAL_LOOT_BY_ARCHETYPE: Record<MobArchetypeId, readonly { itemId: ItemId; quantity: number }[]> = {
  moss_crawler: [
    { itemId: "moss_fibre", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
  ],
  briar_crawler: [
    { itemId: "moss_fibre", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
  ],
  stone_brute: [
    { itemId: "stone_core", quantity: 1 },
  ],
  cave_spitter: [
    { itemId: "acid_gland", quantity: 1 },
  ],
  ridge_stalker: [
    { itemId: "ridge_hide", quantity: 1 },
    { itemId: "crawler_fang", quantity: 1 },
  ],
  shard_sentry: [
    { itemId: "stone_core", quantity: 1 },
    { itemId: "silver_ore", quantity: 1 },
  ],
  thornbinder: [
    { itemId: "moss_fibre", quantity: 2 },
  ],
  fen_bloater: [
    { itemId: "acid_gland", quantity: 2 },
    { itemId: "moss_fibre", quantity: 1 },
  ],
};

export function lootForArchetype(archetypeId: MobArchetypeId, mobId = "", equipmentRoll = 1, threat: LootThreat = "normal", consumableRoll = 1, regionTier = 1): readonly { itemId: ItemId; quantity: number }[] {
  const guard = archetypeId === "cave_spitter" && isSilverGuard(mobId);
  const effectiveThreat = threat === "champion" || threat === "miniboss" || threat === "elite" ? threat : guard ? "guard" : threat;
  const normalMaterials = guard
    ? [{ itemId: "acid_gland" as const, quantity: 2 }, ...(consumableRoll < .18 ? [{ itemId: "healing_potion" as const, quantity: 1 }] : [])]
    : [...MATERIAL_LOOT_BY_ARCHETYPE[archetypeId]];
  const leaderMultiplier = 3 + Math.max(0, Math.min(2, Math.floor(regionTier) - 1));
  const materials = threat === "miniboss"
    ? [...normalMaterials.map(entry => ({ ...entry, quantity: entry.quantity * leaderMultiplier })),
      { itemId: "healing_potion" as const, quantity: regionTier >= 3 ? 2 : 1 }]
    : threat === "elite"
    ? [...normalMaterials.map(entry => ({ ...entry, quantity: entry.quantity * 2 })),
      ...(consumableRoll < .35 ? [{ itemId: "healing_potion" as const, quantity: 1 }] : [])]
    : normalMaterials;
  const equipmentId = archetypeId === "moss_crawler" || archetypeId === "briar_crawler" || archetypeId === "ridge_stalker" ? "fang_dagger"
    : archetypeId === "stone_brute" ? "stone_core_hammer"
    : archetypeId === "shard_sentry" || archetypeId === "thornbinder" ? "forged_focus" : "acid_gland_focus";
  return equipmentRoll < equipmentChance(equipmentId, effectiveThreat)
    ? [...materials, { itemId: equipmentId, quantity: 1 }]
    : materials;
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
