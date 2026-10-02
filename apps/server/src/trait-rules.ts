import { MOMENTUM_TRAIT, TRAIT_DEFINITIONS, type TraitId } from "@blockcraft/protocol";

export function gainMomentum(currentStacks: number, traitId: TraitId = "momentum", amount = 1): number {
  if (traitId !== "momentum") return 0;
  return Math.min(MOMENTUM_TRAIT.maxStacks, Math.max(0, Math.floor(currentStacks)) + Math.max(0, Math.floor(amount)));
}

export function momentumAfterDefense(currentStacks: number, damage: number, parried: boolean, traitId: TraitId = "momentum"): number {
  if (traitId !== "momentum") return 0;
  if (parried) return MOMENTUM_TRAIT.maxStacks;
  return damage > 0 ? 0 : currentStacks;
}

export function movementSpeedWithMomentum(baseSpeed: number, stacks: number, traitId: TraitId = "momentum"): number {
  if (traitId !== "momentum") return baseSpeed;
  return baseSpeed * (1 + Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, stacks)) * MOMENTUM_TRAIT.movementSpeedBonusPerStack);
}

export function staminaRecoveryWithMomentum(baseRecovery: number, stacks: number, traitId: TraitId = "momentum"): number {
  if (traitId !== "momentum") return baseRecovery;
  return baseRecovery + Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, stacks)) * MOMENTUM_TRAIT.staminaRecoveryPerStack;
}

export function guardStaminaCost(baseCost: number, traitId: TraitId): number {
  return traitId === "bulwark" ? baseCost * TRAIT_DEFINITIONS.bulwark.guardCostMultiplier : baseCost;
}

export function parryStaminaRestore(traitId: TraitId): number {
  return traitId === "bulwark" ? TRAIT_DEFINITIONS.bulwark.parryStaminaRestore : 0;
}

export function executionerDamageBonus(
  traitId: TraitId,
  target: { health: number; maxHealth: number; combatState: string },
  attack: { comboStep?: number; power?: boolean },
): number {
  if (traitId !== "executioner") return 0;
  if (!attack.power && attack.comboStep !== 3) return 0;
  const vulnerable = target.combatState === "stagger"
    || target.health / Math.max(1, target.maxHealth) <= TRAIT_DEFINITIONS.executioner.healthThreshold;
  return vulnerable ? TRAIT_DEFINITIONS.executioner.bonusDamage : 0;
}
