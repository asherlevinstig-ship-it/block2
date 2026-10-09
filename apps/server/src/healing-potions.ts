import { HEALING_POTION } from "@blockcraft/protocol";
import { TOWN_TAVERN_KEEPER_POSITION } from "@blockcraft/voxel-world";
export function canBuyPotionAtKeeper(player: { x: number; y: number; z: number }): boolean {
  const keeper = TOWN_TAVERN_KEEPER_POSITION;
  return Math.abs(player.y - keeper.y) <= 1.6 && Math.hypot(player.x - keeper.x, player.z - keeper.z) <= 2.6;
}
export function potionBuyError(health: number, gold: number, quantity: number, nearby: boolean): string | null {
  if (health <= 0) return "Return to town before buying potions.";
  if (!nearby) return "Stand beside Mara in the tavern to buy potions.";
  if (quantity >= HEALING_POTION.capacity) return "Your potion pouch is full (3 / 3).";
  if (gold < HEALING_POTION.price) return "You need 5 gold for a healing potion.";
  return null;
}
export function potionUseError(health: number, maxHealth: number, quantity: number, cooldownUntil: number, now: number): string | null {
  if (health <= 0) return "Potions cannot revive you. Return to town.";
  if (quantity <= 0) return "No potions left. Buy more from Mara in the tavern.";
  if (health >= maxHealth) return "Health is full. Potion saved.";
  if (now < cooldownUntil) return "Potion is cooling down. Try again shortly.";
  return null;
}
