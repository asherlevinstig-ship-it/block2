export type OnboardingEvent = "moved" | "left_town" | "switched_combat" | "landed_hit" | "picked_loot" | "opened_pack";

export const ONBOARDING_STEPS = [
  { title: "Move around", detail: "WASD or left stick to walk. Drag or use arrows to look around.", event: "moved" },
  { title: "Collect your starter gear", detail: "Follow the gold dots to your personal bag. Hold E to take the sword and robes.", event: "picked_loot" },
  { title: "Check your pack", detail: "Press I or click PACK, then equip your new sword and robes.", event: "opened_pack" },
  { title: "Head south", detail: "Follow the gold dots around the tavern and through the south gate. Stay on the road.", event: "left_town" },
  { title: "Switch to Combat", detail: "Press Q or select COMBAT in the hotbar. Q switches between Build and Combat.", event: "switched_combat" },
  { title: "Try your first fight", detail: "Click or press J to attack. Space dodges danger; Q returns to Build when you need to mine.", event: "landed_hit" },
] as const satisfies readonly { title: string; detail: string; event: OnboardingEvent }[];

export const ONBOARDING_DONE = ONBOARDING_STEPS.length;
export const onboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v3:${profileToken}`;
export const legacyOnboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v2:${profileToken}`;

export function migrateLegacyOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  if (!Number.isInteger(step) || step < 0 || step > 5) return null;
  return step === 5 ? ONBOARDING_DONE : step;
}

export function parseOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 && step <= ONBOARDING_DONE ? step : null;
}

export function advanceOnboarding(step: number, event: OnboardingEvent): number {
  return ONBOARDING_STEPS[step]?.event === event ? step + 1 : step;
}
