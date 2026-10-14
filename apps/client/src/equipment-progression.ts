import {
  BLACKSMITH_REFORGE,
  ITEM_DEFINITIONS,
  ITEM_RARITIES,
  armourForItem,
  equipmentForItem,
  itemRarity,
  equipmentPerkStats,
  type BlacksmithReforgeItemId,
  type ItemId,
} from "@blockcraft/protocol";

export type EquipmentCollectionEntry = {
  itemId: ItemId;
  slot: "weapon" | "armour" | "tool" | "light";
  source: string;
};

export const EQUIPMENT_COLLECTION: readonly EquipmentCollectionEntry[] = [
  { itemId: "forged_sword", slot: "weapon", source: "Buy from the Town blacksmith" },
  { itemId: "forged_bow", slot: "weapon", source: "Buy from the Town blacksmith" },
  { itemId: "forged_focus", slot: "weapon", source: "Buy from the Town blacksmith" },
  { itemId: "fang_dagger", slot: "weapon", source: "Hunt Moss Crawlers near Town" },
  { itemId: "stone_core_hammer", slot: "weapon", source: "Defeat Stone Brutes on the Frontier" },
  { itemId: "rootbound_hammer", slot: "weapon", source: "Defeat the Root Guardian" },
  { itemId: "matriarch_edge", slot: "weapon", source: "Defeat the Crystal Matriarch" },
  { itemId: "acid_gland_focus", slot: "weapon", source: "Hunt Cave Spitters in the Silver wilds" },
  { itemId: "venom_focus", slot: "weapon", source: "Defeat the Crystal Matriarch" },
  { itemId: "echo_prism", slot: "weapon", source: "Defeat the Silver Echo" },
  { itemId: "leather_armour", slot: "armour", source: "Buy from the Town blacksmith" },
  { itemId: "iron_armour", slot: "armour", source: "Buy from the Town blacksmith at level 5" },
  { itemId: "rootguard_armour", slot: "armour", source: "Defeat the Root Guardian" },
  { itemId: "bastion_plate", slot: "armour", source: "Defeat the Iron Bastion" },
  { itemId: "fangstalker_wrap", slot: "armour", source: "Complete a Veteran or Ascendant Fang Hunt" },
  { itemId: "venomweave_mantle", slot: "armour", source: "Complete a Veteran or Ascendant Venom Hunt" },
  { itemId: "mirebreaker_mantle", slot: "armour", source: "Defeat empowered Mireback as a Mirebreaker" },
  { itemId: "rootstalker_wrap", slot: "armour", source: "Defeat the empowered Broodmother as a Rootslayer" },
  { itemId: "worldsplitter_plate", slot: "armour", source: "Complete a Veteran or Ascendant Crusher Hunt" },
  { itemId: "reinforced_pickaxe", slot: "tool", source: "Forge at the Town blacksmith" },
  { itemId: "miners_lantern", slot: "light", source: "Recover from a dungeon equipment cache" },
] as const;

export function equipmentSlot(itemId: string): EquipmentCollectionEntry["slot"] | null {
  if (equipmentForItem(itemId)) return "weapon";
  if (armourForItem(itemId)) return "armour";
  if (itemId === "reinforced_pickaxe") return "tool";
  if (itemId === "miners_lantern") return "light";
  return null;
}

export function collectionProgress(owned: ReadonlyMap<ItemId, number>): { found: number; total: number } {
  return { found: EQUIPMENT_COLLECTION.filter(entry => (owned.get(entry.itemId) ?? 0) > 0).length, total: EQUIPMENT_COLLECTION.length };
}

export function equipmentProgressionText(itemId: ItemId, rank: number): string {
  const recipe = BLACKSMITH_REFORGE[itemId as BlacksmithReforgeItemId];
  const perk = equipmentPerkStats(itemId, rank);
  const perkText = perk ? `${perk.name}: ${perk.detail}` : "";
  if (!recipe) return perkText || (itemId === "reinforced_pickaxe" || itemId === "miners_lantern" ? "Utility gear · automatically active when owned" : "No reforge path");
  const safeRank = Math.max(0, Math.min(recipe.costs.length, Math.floor(rank)));
  if (safeRank >= recipe.costs.length) return `${perkText ? `${perkText} · ` : ""}Reforge Rank III · fully upgraded`;
  const cost = recipe.costs[safeRank]!;
  return `${perkText ? `${perkText} · ` : ""}Next: Rank ${["I", "II", "III"][safeRank]} · ${cost.gold} gold + ${cost.material} ${ITEM_DEFINITIONS[recipe.materialId].name}`;
}

export function equipmentCollectionLabel(itemId: ItemId, owned: boolean, rank = 0): string {
  if (!owned) return "UNDISCOVERED";
  const rarity = ITEM_RARITIES[itemRarity(itemId)].label.toUpperCase();
  return `${rarity}${rank > 0 ? ` · RANK ${["I", "II", "III"][Math.min(3, rank) - 1]}` : ""}`;
}
