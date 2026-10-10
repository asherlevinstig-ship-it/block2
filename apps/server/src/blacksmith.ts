import { BLACKSMITH_UPGRADES, IRON_ORE_GOLD_PRICE, SILVER_ORE_GOLD_PRICE, type BlacksmithUpgradeId, type MainHandId } from "@blockcraft/protocol";
import { Block, TOWN_BLACKSMITH_STALL_POSITION, type BlockId } from "@blockcraft/voxel-world";
import { BLACKSMITH_STOCK, type BlacksmithStockId } from "@blockcraft/protocol";

export function weaponPurchase(gold: number, quantity: number, itemId: BlacksmithStockId) {
  const price = BLACKSMITH_STOCK[itemId].price;
  if (quantity >= 65535) return { ok: false as const, gold, quantity, message: "No room for another copy of this equipment." };
  if (gold < price) return { ok: false as const, gold, quantity, message: `You need ${price} gold for this equipment.` };
  return { ok: true as const, gold: gold - price, quantity: quantity + 1, message: "Equipment bought. Open your pack with I to equip it." };
}

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

export function forgeBlacksmithUpgrade(
  flags: number,
  gold: number,
  ironOre: number,
  upgradeId: BlacksmithUpgradeId,
): { flags: number; gold: number; ironOre: number; forged: boolean; reason?: "owned" | "gold" | "iron_ore" } {
  if (ownsBlacksmithUpgrade(flags, upgradeId)) return { flags, gold, ironOre, forged: false, reason: "owned" };
  const recipe = BLACKSMITH_UPGRADES[upgradeId];
  if (ironOre < recipe.ironOre) return { flags, gold, ironOre, forged: false, reason: "iron_ore" };
  if (gold < recipe.price) return { flags, gold, ironOre, forged: false, reason: "gold" };
  return {
    flags: flags | UPGRADE_BITS[upgradeId],
    gold: gold - recipe.price,
    ironOre: ironOre - recipe.ironOre,
    forged: true,
  };
}

export function ironCapacity(flags: number): number {
  return ownsBlacksmithUpgrade(flags, "miners_pack") ? UPGRADED_IRON_CAPACITY : BASE_IRON_CAPACITY;
}

export function minedIronQuantity(flags: number): number {
  return ownsBlacksmithUpgrade(flags, "reinforced_pickaxe") ? 2 : 1;
}

export function ironSwordDamageBonus(flags: number, mainHandId: MainHandId = "longsword"): number {
  return mainHandId === "longsword" && ownsBlacksmithUpgrade(flags, "iron_sword") ? 1 : 0;
}

export function blacksmithNextStep(flags: number, gold: number, ore: number): string {
  if (ownsBlacksmithUpgrade(flags, "iron_sword")) return "Iron Sword ready: head beyond the town walls, defeat mobs, and collect their dropped items. Open your pack with I to equip loot.";
  const needed = Math.max(0, Math.ceil((BLACKSMITH_UPGRADES.iron_sword.price - gold) / IRON_ORE_GOLD_PRICE));
  if (needed === 0) return "You can forge the Iron Sword now for 45 gold. It equips your longsword and adds +1 sword damage.";
  if (ore >= needed) return `Sell your iron ore, then forge the Iron Sword for 45 gold. You need ${needed} ore worth of gold.`;
  return `Mine ${needed - ore} more iron ore, sell it here for 3 gold each, then forge the Iron Sword for 45 gold.`;
}

export function minedMineral(block: BlockId): "iron_ore" | "silver_ore" | null {
  return block === Block.IronOre ? "iron_ore" : block === Block.SilverOre ? "silver_ore" : null;
}

export function canTradeAtBlacksmith(player: { x: number; y: number; z: number }): boolean {
  return Math.abs(player.y - TOWN_BLACKSMITH_STALL_POSITION.y) <= 1.6
    && Math.hypot(player.x - TOWN_BLACKSMITH_STALL_POSITION.x, player.z - TOWN_BLACKSMITH_STALL_POSITION.z) <= 2.6;
}

export function ironOreSale(available: number, gold: number): { sold: number; goldGranted: number } {
  const sold = Math.max(0, Math.min(Math.floor(available), Math.floor((MAX_GOLD - gold) / IRON_ORE_GOLD_PRICE)));
  return { sold, goldGranted: sold * IRON_ORE_GOLD_PRICE };
}

export function mineralSale(iron: number, silver: number, gold: number): { ironSold: number; silverSold: number; goldGranted: number } {
  const ironSale = ironOreSale(iron, gold);
  const silverSold = Math.max(0, Math.min(Math.floor(silver), Math.floor((MAX_GOLD - gold - ironSale.goldGranted) / SILVER_ORE_GOLD_PRICE)));
  return { ironSold: ironSale.sold, silverSold, goldGranted: ironSale.goldGranted + silverSold * SILVER_ORE_GOLD_PRICE };
}
