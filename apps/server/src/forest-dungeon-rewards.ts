import type { ItemId } from "@blockcraft/protocol";

/** Fixed progression: every clear has a known reward and never rolls rarity. */
export function forestCacheFeaturedReward(quantity: (itemId: ItemId) => number): ItemId {
  if (quantity("rootbound_hammer") <= 0) return "rootbound_hammer";
  if (quantity("rootguard_armour") <= 0) return "rootguard_armour";
  return "silver_ore";
}

export function forestCacheRewardLabel(itemId: ItemId): string {
  return itemId === "rootbound_hammer" ? "Rootbound Hammer"
    : itemId === "rootguard_armour" ? "Rootguard Armour"
      : "Veteran supplies · silver, materials, and gold";
}

export const FOREST_CACHE_DUPLICATE_GOLD = 18;
