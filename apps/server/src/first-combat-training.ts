import type { BuildPathId, ItemId } from "@blockcraft/protocol";

export const FIRST_COMBAT_MOB_ID = "south-causeway-crawler";
export const FIRST_COMBAT_SUPPORT_IDS = ["south-causeway-scavenger-west", "south-causeway-scavenger-east"] as const;
export const FIRST_COMBAT_GROUP_IDS = [FIRST_COMBAT_MOB_ID, ...FIRST_COMBAT_SUPPORT_IDS] as const;

export function isFirstCombatSupport(mobId: string): boolean {
  return FIRST_COMBAT_SUPPORT_IDS.some(id => id === mobId);
}

export function firstCombatReward(pathId: BuildPathId | null): ItemId {
  switch (pathId) {
    case "tank": return "leather_armour";
    case "ranger": return "forged_bow";
    case "mage":
    case "healer": return "forged_focus";
    case "assassin":
    case "thief": return "fang_dagger";
    default: return "leather_armour";
  }
}

export function firstCombatHealthAfterHit(mobId: string, playerLevel: number, completedDodge: boolean,
  currentHealth: number, damage: number): number {
  const next = Math.max(0, currentHealth - Math.max(0, damage));
  return mobId === FIRST_COMBAT_MOB_ID && playerLevel <= 2 && !completedDodge ? Math.max(1, next) : next;
}

export function firstCombatExperience(mobId: string, playerLevel: number, currentExperience: number,
  requiredExperience: number, baseExperience: number): number {
  if (mobId !== FIRST_COMBAT_MOB_ID || playerLevel !== 1) return baseExperience;
  return Math.max(baseExperience, Math.max(0, requiredExperience - currentExperience));
}
