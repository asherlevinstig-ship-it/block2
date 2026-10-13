export const DODGE_STAMINA_COST = 35;
export const DODGE_CHAIN_COST_STEP = 10;
export const DODGE_MAX_STAMINA_COST = 55;
export const DODGE_CHAIN_WINDOW_MS = 1_600;
export const DODGE_EXHAUSTION_MS = 900;
export const PERFECT_DODGE_COUNTER_MS = 1_600;
export const PERFECT_DODGE_STAMINA_RESTORE = 15;

export function dodgeChainStaminaCost(chain: number): number {
  return Math.min(DODGE_MAX_STAMINA_COST, DODGE_STAMINA_COST + Math.max(0, Math.floor(chain)) * DODGE_CHAIN_COST_STEP);
}

export function nextDodgeChain(previousChain: number, previousAt: number, now: number): number {
  return now - previousAt <= DODGE_CHAIN_WINDOW_MS ? Math.max(0, previousChain) + 1 : 0;
}

export interface DodgePressureUpdate {
  phase: "dodge" | "exhausted" | "perfect";
  cost: number;
  chain: number;
  exhaustedUntil: number;
  counterUntil: number;
  staminaRestored: number;
}
