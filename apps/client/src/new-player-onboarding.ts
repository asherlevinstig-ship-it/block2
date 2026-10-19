export type OnboardingEvent = "moved" | "left_town" | "switched_combat" | "defeated_first_enemy" | "picked_loot" | "equipped_starter";

export const ONBOARDING_STEPS = [
  { title: "Move around", detail: "WASD or left stick to walk. Drag or use arrows to look around.", event: "moved" },
  { title: "Collect your starter gear", detail: "Follow the gold dots to your personal bag. Hold E to take the sword and robes.", event: "picked_loot" },
  { title: "Equip your first sword", detail: "Press I to open your inventory, select the Forged Sword, then choose EQUIP.", event: "equipped_starter" },
  { title: "Head south", detail: "Follow the gold dots around the tavern and through the south gate. Stay on the road.", event: "left_town" },
  { title: "Switch to Combat", detail: "Press Q or select COMBAT in the hotbar. Q switches between Build and Combat.", event: "switched_combat" },
  { title: "Defeat your first enemy", detail: "Follow the gold trail to the Southroad Crawler. Defeat it to complete your combat lesson.", event: "defeated_first_enemy" },
] as const satisfies readonly { title: string; detail: string; event: OnboardingEvent }[];

export const ONBOARDING_DONE = ONBOARDING_STEPS.length;
export const onboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v3:${profileToken}`;
export const legacyOnboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v2:${profileToken}`;
export const starterEquipmentStorageKey = (profileToken: string): string => `blockcraft.starter-equipment.v1:${profileToken}`;

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

export type StarterInventoryLesson = "hidden" | "open_pack" | "equip_sword";

export function starterInventoryLesson(step: number | null, packOpenedWithKeyboard: boolean, equipmentRequired = false): StarterInventoryLesson {
  if (step !== 2 && !equipmentRequired) return "hidden";
  return packOpenedWithKeyboard ? "equip_sword" : "open_pack";
}

export function starterEquipmentRequired(savedState: string | null, level: number, swordOwned: number, mainHandId: string): boolean {
  if (savedState === "complete" || mainHandId === "forged_sword") return false;
  return savedState === "required" || level <= 2 && swordOwned > 0;
}

export function shouldPromptTownDeparture(wasInsideTown: boolean, isBeyondTown: boolean, level: number): boolean {
  return wasInsideTown && isBeyondTown && level >= 1 && level <= 2;
}
