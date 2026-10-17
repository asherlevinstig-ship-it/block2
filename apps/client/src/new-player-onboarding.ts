export type OnboardingEvent = "moved" | "left_town" | "landed_hit" | "picked_loot" | "opened_pack";

export const ONBOARDING_STEPS = [
  { title: "Move around", detail: "WASD or left stick to walk. Drag or use arrows to look around.", event: "moved" },
  { title: "Collect your starter gear", detail: "Follow the gold dots to your personal bag. Hold E to take the sword and robes.", event: "picked_loot" },
  { title: "Check your pack", detail: "Press I or click PACK, then equip your new sword and robes.", event: "opened_pack" },
  { title: "Head south", detail: "Follow the gold dots around the tavern and through the south gate. Stay on the road.", event: "left_town" },
  { title: "Try your first fight", detail: "Press Q for Combat, then click or press J to attack. Space dodges danger.", event: "landed_hit" },
] as const satisfies readonly { title: string; detail: string; event: OnboardingEvent }[];

export const ONBOARDING_DONE = ONBOARDING_STEPS.length;
export const onboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v2:${profileToken}`;

export function parseOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 && step <= ONBOARDING_DONE ? step : null;
}

export function advanceOnboarding(step: number, event: OnboardingEvent): number {
  return ONBOARDING_STEPS[step]?.event === event ? step + 1 : step;
}
