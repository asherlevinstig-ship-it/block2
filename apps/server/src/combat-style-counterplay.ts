export type CounterplayTactic = "press-ranged" | "break-cover" | "punish-healer" | "break-guard" | "search-stealth";

export const RANGED_PRESSURE_DELAY_MS = 1_500;
export const HARD_RANGED_PRESSURE_MS = 4_000;
export const HELD_GUARD_BREAK_MS = 1_400;

const RANGED_HANDS = new Set([
  "bow", "forged_bow", "magic_focus", "forged_focus", "acid_gland_focus",
  "venom_focus", "echo_prism", "emberheart_focus",
]);

export function isRangedCombatHand(mainHandId: string): boolean {
  return RANGED_HANDS.has(mainHandId);
}

/** Modest movement pressure closes a fight without granting teleporting or homing. */
export function antiCampSpeedMultiplier(distance: number, stopDistance: number,
  pressureStartedAt: number, now: number): number {
  if (distance <= stopDistance + 2.5 || pressureStartedAt <= 0) return 1;
  const elapsed = now - pressureStartedAt;
  return elapsed >= HARD_RANGED_PRESSURE_MS ? 1.3
    : elapsed >= RANGED_PRESSURE_DELAY_MS ? 1.16 : 1;
}

export function heldGuardBreak(defending: boolean, defenseStartedAt: number, now: number): {
  active: boolean;
  extraStaminaDamage: number;
} {
  const active = defending && defenseStartedAt > 0 && now - defenseStartedAt >= HELD_GUARD_BREAK_MS;
  return { active, extraStaminaDamage: active ? 8 : 0 };
}

export function canPressureHealer(input: {
  restored: number;
  distance: number;
  sameElevation: boolean;
  visible: boolean;
  concealed: boolean;
  challenged: boolean;
}): boolean {
  return input.restored > 0 && input.distance <= 14 && input.sameElevation
    && input.visible && !input.concealed && !input.challenged;
}
