export type OnboardingEvent = "moved" | "left_town" | "landed_hit" | "picked_loot" | "opened_pack";

export const ONBOARDING_STEPS = [
  { title: "Move around", detail: "WASD or left stick to walk. Drag or use arrows to look around.", event: "moved" },
  { title: "Leave town", detail: "Follow the road out through the east gate. Town is safe; the wilds are not.", event: "left_town" },
  { title: "Win your first fight", detail: "Press Q for Combat, then click or press E to attack. Space dodges danger.", event: "landed_hit" },
  { title: "Pick up a drop", detail: "Walk to a loot bag and press E. Its contents go into your pack.", event: "picked_loot" },
  { title: "Check your pack", detail: "Press I or click PACK to inspect what you collected.", event: "opened_pack" },
] as const satisfies readonly { title: string; detail: string; event: OnboardingEvent }[];

export const ONBOARDING_DONE = ONBOARDING_STEPS.length;
export const onboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v1:${profileToken}`;

export function parseOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 && step <= ONBOARDING_DONE ? step : null;
}

export function advanceOnboarding(step: number, event: OnboardingEvent): number {
  return ONBOARDING_STEPS[step]?.event === event ? step + 1 : step;
}
