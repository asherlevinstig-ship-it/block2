export const FIRST_COMBAT_MOB_ID = "south-causeway-crawler";

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
