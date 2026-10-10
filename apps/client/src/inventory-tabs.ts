export const INVENTORY_TABS = ["weapons", "armour", "tools", "materials", "supplies"] as const;
export type InventoryTab = typeof INVENTORY_TABS[number];
export function nextInventoryTab(current: InventoryTab, key: string): InventoryTab {
  const index = INVENTORY_TABS.indexOf(current);
  if (key === "Home") return INVENTORY_TABS[0];
  if (key === "End") return INVENTORY_TABS[INVENTORY_TABS.length - 1]!;
  if (key === "ArrowRight") return INVENTORY_TABS[(index + 1) % INVENTORY_TABS.length]!;
  if (key === "ArrowLeft") return INVENTORY_TABS[(index + INVENTORY_TABS.length - 1) % INVENTORY_TABS.length]!;
  return current;
}
