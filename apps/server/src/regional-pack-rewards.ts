import type { ItemId } from "@blockcraft/protocol";

export const REGIONAL_PACK_SWIFT_CLEAR_MS = 20_000;

export type RegionalPackRewardKind = "veteran" | "formation-break" | "swift-clear";
type RegionalPackRegion = "greenwood" | "mistfen" | "stoneheart" | "ashen";

export interface RegionalPackRewardCycle {
  firstDefeatedAt: number;
  veteranFirst: boolean;
}

export interface RegionalPackRewardResult {
  cycle: RegionalPackRewardCycle | null;
  rewards: readonly RegionalPackRewardKind[];
}

const regionFor = (packId: string): RegionalPackRegion | null => {
  if (packId.startsWith("greenwood-")) return "greenwood";
  if (packId.startsWith("mistfen-")) return "mistfen";
  if (packId.startsWith("stoneheart-")) return "stoneheart";
  if (packId.startsWith("ashen-")) return "ashen";
  return null;
};

/** Pure pack-cycle transition. Current member is still alive while this is evaluated. */
export function regionalPackRewardDefeat(packId: string, isVeteran: boolean, otherMembersAlive: number,
  now: number, previous: RegionalPackRewardCycle | undefined): RegionalPackRewardResult {
  if (!regionFor(packId)) return { cycle: null, rewards: [] };
  const cycle = previous ?? { firstDefeatedAt: now, veteranFirst: isVeteran };
  const rewards: RegionalPackRewardKind[] = [];
  if (isVeteran) {
    rewards.push("veteran");
    if (cycle.veteranFirst) rewards.push("formation-break");
  }
  if (otherMembersAlive === 0) {
    if (now - cycle.firstDefeatedAt <= REGIONAL_PACK_SWIFT_CLEAR_MS) rewards.push("swift-clear");
    return { cycle: null, rewards };
  }
  return { cycle, rewards };
}

export function regionalPackRewardItems(packId: string, rewards: readonly RegionalPackRewardKind[]):
  { itemId: ItemId; quantity: number }[] {
  const region = regionFor(packId);
  if (!region || rewards.length === 0) return [];
  const veteranTable: Record<RegionalPackRegion, { itemId: ItemId; quantity: number }[]> = {
    greenwood: [{ itemId: "moss_fibre", quantity: 2 }, { itemId: "crawler_fang", quantity: 1 }],
    mistfen: [{ itemId: "acid_gland", quantity: 2 }, { itemId: "silver_ore", quantity: 1 }],
    stoneheart: [{ itemId: "stone_core", quantity: 2 }, { itemId: "iron_ore", quantity: 2 }],
    ashen: [{ itemId: "ember_ore", quantity: 2 }, { itemId: "stone_core", quantity: 1 }],
  };
  const signature: Record<RegionalPackRegion, ItemId> = {
    greenwood: "moss_fibre", mistfen: "acid_gland", stoneheart: "stone_core", ashen: "ember_ore",
  };
  return [
    ...(rewards.includes("veteran") ? veteranTable[region] : []),
    ...(rewards.includes("formation-break") ? [{ itemId: signature[region], quantity: 1 }] : []),
    ...(rewards.includes("swift-clear")
      ? [{ itemId: signature[region], quantity: 2 }, { itemId: "healing_potion" as ItemId, quantity: 1 }] : []),
  ];
}

export function regionalPackRewardNotice(packName: string, rewards: readonly RegionalPackRewardKind[]): string | null {
  if (rewards.includes("swift-clear")) return `SWIFT PACK CLEAR · ${packName} broken in under 20s. Personal regional materials and a potion added to your loot bag.`;
  if (rewards.includes("formation-break")) return `FORMATION BREAK · ${packName} veteran fell first. Bonus regional material added to your personal loot bag.`;
  if (rewards.includes("veteran")) return `VETERAN DEFEATED · ${packName} regional materials added to your personal loot bag.`;
  return null;
}
