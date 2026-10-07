import { BLACKSMITH_UPGRADES, IRON_ORE_GOLD_PRICE, type BlacksmithUpgradeId } from "@blockcraft/protocol";
import { Block, TOWN_BLACKSMITH_STALL_POSITION, type BlockId } from "@blockcraft/voxel-world";

export const MAX_GOLD = 1_000_000;
export const BASE_IRON_CAPACITY = 12;
export const UPGRADED_IRON_CAPACITY = 30;

const UPGRADE_BITS: Record<BlacksmithUpgradeId, number> = {
  reinforced_pickaxe: 1,
  iron_sword: 2,
  miners_pack: 4,
};

export function ownsBlacksmithUpgrade(flags: number, upgradeId: BlacksmithUpgradeId): boolean {
  return (flags & UPGRADE_BITS[upgradeId]) !== 0;
}

export function ownedBlacksmithUpgrades(flags: number): BlacksmithUpgradeId[] {
  return (Object.keys(BLACKSMITH_UPGRADES) as BlacksmithUpgradeId[]).filter(id => ownsBlacksmithUpgrade(flags, id));
}

export function buyBlacksmithUpgrade(flags: number, gold: number, upgradeId: BlacksmithUpgradeId): { flags: number; gold: number; purchased: boolean; reason?: "owned" | "gold" } {
  if (ownsBlacksmithUpgrade(flags, upgradeId)) return { flags, gold, purchased: false, reason: "owned" };
  const price = BLACKSMITH_UPGRADES[upgradeId].price;
  if (gold < price) return { flags, gold, purchased: false, reason: "gold" };
  return { flags: flags | UPGRADE_BITS[upgradeId], gold: gold - price, purchased: true };
}

export function ironCapacity(flags: number): number {
  return ownsBlacksmithUpgrade(flags, "miners_pack") ? UPGRADED_IRON_CAPACITY : BASE_IRON_CAPACITY;
}

export function minedIronQuantity(flags: number): number {
  return ownsBlacksmithUpgrade(flags, "reinforced_pickaxe") ? 2 : 1;
}

export function ironSwordDamageBonus(flags: number): number {
  return ownsBlacksmithUpgrade(flags, "iron_sword") ? 1 : 0;
}

export function minedMineral(block: BlockId): "iron_ore" | null {
  return block === Block.IronOre ? "iron_ore" : null;
}

export function canTradeAtBlacksmith(player: { x: number; y: number; z: number }): boolean {
  return Math.abs(player.y - TOWN_BLACKSMITH_STALL_POSITION.y) <= 1.6
    && Math.hypot(player.x - TOWN_BLACKSMITH_STALL_POSITION.x, player.z - TOWN_BLACKSMITH_STALL_POSITION.z) <= 2.6;
}

export function ironOreSale(available: number, gold: number): { sold: number; goldGranted: number } {
  const sold = Math.max(0, Math.min(Math.floor(available), Math.floor((MAX_GOLD - gold) / IRON_ORE_GOLD_PRICE)));
  return { sold, goldGranted: sold * IRON_ORE_GOLD_PRICE };
}
