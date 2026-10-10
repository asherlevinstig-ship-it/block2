import { BLACKSMITH_STOCK, type BlacksmithStockId } from "@blockcraft/protocol";
export type BlacksmithShopTab = "sell" | "weapons" | "armour" | "upgrades";
export function blacksmithShopStock(tab: BlacksmithShopTab): BlacksmithStockId[] {
  if (tab !== "weapons" && tab !== "armour") return [];
  return (Object.keys(BLACKSMITH_STOCK) as BlacksmithStockId[]).filter(id => id.endsWith("armour") === (tab === "armour"));
}
export function shopGoldShortfall(id: BlacksmithStockId, gold: number): number {
  return Math.max(0, BLACKSMITH_STOCK[id].price - gold);
}
