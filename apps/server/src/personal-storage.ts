import { HEALING_POTION, ITEM_DEFINITIONS, MAIN_HAND_DEFINITIONS, type ItemId, type MainHandId } from "@blockcraft/protocol";
import { isAtTownStorage } from "@blockcraft/voxel-world";
import { z } from "zod";
import { ironCapacity } from "./blacksmith.js";
import { InventoryItemState, type PlayerState } from "./schema.js";
export const StorageTransferSchema = z.object({
  itemId: z.enum(Object.keys(ITEM_DEFINITIONS) as [ItemId, ...ItemId[]]),
  direction: z.enum(["deposit", "withdraw"]), quantity: z.union([z.literal("all"), z.number().int().min(1).max(65535)]),
});
export function canUseStorage(player: { x: number; y: number; z: number }): boolean {
  return isAtTownStorage(player);
}
export function transferStoredItem(player: PlayerState, payload: unknown): string {
  const parsed = StorageTransferSchema.safeParse(payload);
  if (!parsed.success) return "Choose a valid item and quantity.";
  if (player.health <= 0 || !canUseStorage(player)) return "Stand beside your town chest to transfer items.";
  const { itemId, direction, quantity } = parsed.data;
  if (itemId === "reinforced_pickaxe") return "Your permanent mining tool stays in your pack.";
  const deposit = direction === "deposit";
  const source = deposit ? player.inventory : player.storage;
  const destination = deposit ? player.storage : player.inventory;
  const sourceQuantity = source.get(itemId)?.quantity ?? 0;
  const targetQuantity = destination.get(itemId)?.quantity ?? 0;
  const hand = MAIN_HAND_DEFINITIONS[player.mainHandId as MainHandId];
  const worn = deposit && (player.armourId === itemId || (hand && "requiredItemId" in hand && hand.requiredItemId === itemId));
  const capacity = deposit ? 65535 : itemId === "healing_potion" ? HEALING_POTION.capacity
    : itemId === "iron_ore" || itemId === "silver_ore" ? ironCapacity(player.blacksmithUpgrades) : 65535;
  const moved = Math.min(quantity === "all" ? sourceQuantity : quantity, sourceQuantity - (worn ? 1 : 0), capacity - targetQuantity);
  if (moved <= 0) return worn ? "Keep your equipped copy in your pack. Remove it first to store it." : "No items to move, or the destination stack is full.";
  let target = destination.get(itemId);
  if (!target) { target = new InventoryItemState(); destination.set(itemId, target); }
  source.get(itemId)!.quantity -= moved; target.quantity += moved;
  return `${deposit ? "Stored" : "Withdrew"} ${moved} ${ITEM_DEFINITIONS[itemId].name}.`;
}
