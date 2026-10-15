import { backpackAddableQuantity, backpackCapacity, backpackSlotsUsed,
  type ArmourId, type ItemId, type MainHandId } from "@blockcraft/protocol";
import type { PlayerState } from "./schema.js";

const quantityFor = (player: PlayerState) => (itemId: ItemId) => player.inventory.get(itemId)?.quantity ?? 0;

export function playerBackpackSlots(player: PlayerState, mainHandId = player.mainHandId as MainHandId,
  armourId = player.armourId as ArmourId): number {
  return backpackSlotsUsed(quantityFor(player), mainHandId, armourId);
}

export function playerBackpackAddable(player: PlayerState, itemId: ItemId, desired: number,
  mainHandId = player.mainHandId as MainHandId, armourId = player.armourId as ArmourId,
  capacity = backpackCapacity(player.blacksmithUpgrades)): number {
  return backpackAddableQuantity(quantityFor(player), itemId, desired, mainHandId, armourId, capacity);
}

export function playerBackpackHasRoom(player: PlayerState, mainHandId = player.mainHandId as MainHandId,
  armourId = player.armourId as ArmourId, capacity = backpackCapacity(player.blacksmithUpgrades)): boolean {
  return playerBackpackSlots(player, mainHandId, armourId) <= capacity;
}
