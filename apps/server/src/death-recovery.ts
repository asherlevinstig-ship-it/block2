import { HEALING_POTION, ITEM_DEFINITIONS, MAIN_HAND_DEFINITIONS, type ItemId, type MainHandId } from "@blockcraft/protocol";
import { ironCapacity } from "./blacksmith.js";
import { InventoryItemState, RecoveryBagState, type PlayerState } from "./schema.js";

export type RecoveryBagData = { id: string; x: number; y: number; z: number; items: Partial<Record<ItemId, number>> };
export function leaveRecoveryBag(player: PlayerState, id: string): number {
  if (player.health > 0 || player.recoveryBags.has(id)) return 0;
  const bag = new RecoveryBagState(); bag.x = player.x; bag.y = player.y; bag.z = player.z;
  const hand = MAIN_HAND_DEFINITIONS[player.mainHandId as MainHandId];
  let total = 0;
  for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    // Potions are supplies rather than loot; keep them, along with permanent tools.
    if (itemId === "reinforced_pickaxe" || itemId === "healing_potion") continue;
    const item = player.inventory.get(itemId); if (!item) continue;
    const equipped = player.armourId === itemId || (hand && "requiredItemId" in hand && hand.requiredItemId === itemId);
    const quantity = Math.max(0, item.quantity - (equipped ? 1 : 0)); if (!quantity) continue;
    const dropped = new InventoryItemState(); dropped.quantity = quantity;
    bag.items.set(itemId, dropped); item.quantity -= quantity; total += quantity;
  }
  if (total) player.recoveryBags.set(id, bag);
  return total;
}
export function collectRecoveryBag(player: PlayerState, id: string, clearPath: (bag: RecoveryBagState) => boolean): string {
  const bag = player.recoveryBags.get(id);
  if (!bag) return "That recovery bag is no longer available.";
  if (player.health <= 0) return "Return to town before recovering your bag.";
  if (Math.hypot(player.x - bag.x, player.z - bag.z) > 2 || Math.abs(player.y - bag.y) > 1.5 || !clearPath(bag))
    return "Move beside your bag with a clear path to recover it.";
  let recovered = 0, remaining = 0;
  for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const item = bag.items.get(itemId); if (!item || item.quantity <= 0) continue;
    const capacity = itemId === "healing_potion" ? HEALING_POTION.capacity : itemId === "iron_ore" || itemId === "silver_ore" ? ironCapacity(player.blacksmithUpgrades) : 65535;
    let carried = player.inventory.get(itemId);
    const quantity = Math.max(0, Math.min(item.quantity, capacity - (carried?.quantity ?? 0)));
    if (quantity) {
      if (!carried) { carried = new InventoryItemState(); player.inventory.set(itemId, carried); }
      carried.quantity += quantity; item.quantity -= quantity; recovered += quantity;
    }
    remaining += item.quantity;
  }
  if (!remaining) player.recoveryBags.delete(id);
  return remaining ? `Recovered ${recovered} items. ${remaining} remain — make room in your pack.` : `Recovered ${recovered} items. Your bag is empty.`;
}
export function snapshotRecoveryBags(player: PlayerState): RecoveryBagData[] {
  return [...player.recoveryBags.entries()].map(([id, bag]) => ({ id, x: bag.x, y: bag.y, z: bag.z,
    items: Object.fromEntries([...bag.items.entries()].filter(([id, item]) => id in ITEM_DEFINITIONS && item.quantity > 0).map(([id, item]) => [id, item.quantity])) }));
}
export function parseRecoveryBags(value: unknown): RecoveryBagData[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>(), bags: RecoveryBagData[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const bag = candidate as Record<string, unknown>;
    if (typeof bag.id !== "string" || !bag.id || bag.id.length > 80 || ids.has(bag.id)
      || ![bag.x, bag.y, bag.z].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 4096)
      || !bag.items || typeof bag.items !== "object") continue;
    const items: Partial<Record<ItemId, number>> = {};
    for (const id of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
      const quantity = (bag.items as Record<string, unknown>)[id];
      if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0) items[id] = Math.min(65535, quantity);
    }
    if (!Object.keys(items).length) continue;
    ids.add(bag.id); bags.push({ id: bag.id, x: bag.x as number, y: bag.y as number, z: bag.z as number, items });
  }
  return bags;
}
export function restoreRecoveryBags(player: PlayerState, bags: RecoveryBagData[]): void {
  for (const saved of bags) {
    const bag = new RecoveryBagState(); bag.x = saved.x; bag.y = saved.y; bag.z = saved.z;
    for (const [id, quantity] of Object.entries(saved.items)) { const item = new InventoryItemState(); item.quantity = quantity!; bag.items.set(id, item); }
    player.recoveryBags.set(saved.id, bag);
  }
}
