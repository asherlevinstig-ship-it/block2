import { armourForItem, equipmentForItem, ITEM_DEFINITIONS, type ItemId } from "@blockcraft/protocol";
export function equipmentPickupCard(itemId: ItemId, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  const armour = armourForItem(itemId); const hand = equipmentForItem(itemId);
  if (!armour && !hand) return null;
  const category = armour ? "Armour" : hand?.includes("bow") ? "Bow" : hand?.includes("focus") ? "Focus"
    : hand === "stone_core_hammer" ? "Hammer" : hand === "fang_dagger" ? "Dagger" : "Sword";
  return { title: "EQUIPMENT COLLECTED", name: ITEM_DEFINITIONS[itemId].name,
    quantity: quantity > 1 ? ` ×${quantity}` : "", category, hint: "Press I to view or equip in your pack" };
}
