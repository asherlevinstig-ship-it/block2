import { MOMENTUM_TRAIT } from "@blockcraft/protocol";

export function gainMomentum(currentStacks: number, amount = 1): number {
  return Math.min(MOMENTUM_TRAIT.maxStacks, Math.max(0, Math.floor(currentStacks)) + Math.max(0, Math.floor(amount)));
}

export function momentumAfterDefense(currentStacks: number, damage: number, parried: boolean): number {
  if (parried) return MOMENTUM_TRAIT.maxStacks;
  return damage > 0 ? 0 : currentStacks;
}

export function movementSpeedWithMomentum(baseSpeed: number, stacks: number): number {
  return baseSpeed * (1 + Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, stacks)) * MOMENTUM_TRAIT.movementSpeedBonusPerStack);
}

export function staminaRecoveryWithMomentum(baseRecovery: number, stacks: number): number {
  return baseRecovery + Math.max(0, Math.min(MOMENTUM_TRAIT.maxStacks, stacks)) * MOMENTUM_TRAIT.staminaRecoveryPerStack;
}
