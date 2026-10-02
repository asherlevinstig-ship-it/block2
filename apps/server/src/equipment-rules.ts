import { MAIN_HAND_DEFINITIONS, type MainHandId } from "@blockcraft/protocol";

export function canEquipMainHand(mainHandId: MainHandId, quantityForItem: (itemId: string) => number): boolean {
  const definition = MAIN_HAND_DEFINITIONS[mainHandId];
  const requiredItemId = "requiredItemId" in definition ? definition.requiredItemId : undefined;
  return !requiredItemId || quantityForItem(requiredItemId) > 0;
}
