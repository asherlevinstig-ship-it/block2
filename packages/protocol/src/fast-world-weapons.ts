import type { MainHandId } from "./index.js";

export const FAST_WORLD_ATTACK_SCALE = .7;
export type FastWorldProjectileStyle = "crescent" | "arrow" | "orb";
export interface FastWorldWeaponProfile {
  style: FastWorldProjectileStyle; range: number; travelMs: number;
  pierce: number; splashRadius: number; bonusDamage: number;
}

/** Sword upgrades retain the crescent identity; daggers and hammers stay melee. */
export function fastWorldWeaponProfile(id: MainHandId, enabled: boolean): FastWorldWeaponProfile | null {
  if (!enabled) return null;
  if (id === "longsword" || id === "forged_sword" || id === "matriarch_edge" || id === "cinderfang_blade" || id === "crownkeeper_blade")
    return { style: "crescent", range: 4.6, travelMs: 160, pierce: 3, splashRadius: 0, bonusDamage: 0 };
  if (id === "bow" || id === "forged_bow")
    return { style: "arrow", range: 11, travelMs: 110, pierce: 1, splashRadius: 0, bonusDamage: 1 };
  if (id === "magic_focus" || id === "forged_focus")
    return { style: "orb", range: 8.5, travelMs: 250, pierce: 1, splashRadius: 1.8, bonusDamage: 0 };
  return null;
}

export function fastWorldAttackTiming<T extends { durationMs: number; impactMs: number }>(timing: T, enabled: boolean, haste = 0): T {
  if (!enabled) return timing;
  const scale = FAST_WORLD_ATTACK_SCALE * Math.max(.55, Math.pow(.9, haste));
  return { ...timing, durationMs: Math.max(135, Math.round(timing.durationMs * scale)),
    impactMs: Math.max(55, Math.round(timing.impactMs * scale)) };
}
