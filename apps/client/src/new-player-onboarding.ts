export type OnboardingEvent = "left_town" | "defeated_first_enemy" | "picked_loot" | "equipped_starter";

export const ONBOARDING_STAGE = {
  collectGear: 0,
  equipSword: 1,
  headSouth: 2,
  firstCombat: 3,
} as const;

export const ONBOARDING_STEPS = [
  { title: "Collect your starter gear", detail: "Follow the gold dots to your personal bag. Hold E to take your Calling weapon and robes.", event: "picked_loot" },
  { title: "Equip your first weapon", detail: "Press I to open your inventory, select your Calling weapon, then choose EQUIP.", event: "equipped_starter" },
  { title: "Head south", detail: "Follow the gold dots around the tavern and through the south gate. Stay on the road.", event: "left_town" },
  { title: "Defeat your first enemy", detail: "Follow the gold trail to the Southroad Crawler. Your weapon is always ready; press J or attack to strike.", event: "defeated_first_enemy" },
] as const satisfies readonly { title: string; detail: string; event: OnboardingEvent }[];

export const ONBOARDING_DONE = ONBOARDING_STEPS.length;
export const onboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v5:${profileToken}`;
export const buildModeOnboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v4:${profileToken}`;
export const legacyOnboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v3:${profileToken}`;
export const oldestOnboardingStorageKey = (profileToken: string): string => `blockcraft.onboarding.v2:${profileToken}`;
// v2 deliberately records only a confirmed starter-bag pickup. The old key could be
// set merely because an inventory sync reported an owned sword, which skipped the bag
// lesson and left returning characters trapped behind the equipment prompt.
export const starterEquipmentStorageKey = (profileToken: string): string => `blockcraft.starter-equipment.v2:${profileToken}`;
export const callingFirstOnboardingStorageKey = (profileToken: string): string => `blockcraft.calling-first.v1:${profileToken}`;

export function shouldDeferOnboardingForCalling(
  characterCreationRequired: boolean,
  savedState: string | null,
  onboardingStep: number | null,
): boolean {
  return onboardingStep === null && (characterCreationRequired || savedState === "pending");
}

export function migrateLegacyOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  if (!Number.isInteger(step) || step < 0 || step > 6) return null;
  if (step <= 1) return ONBOARDING_STAGE.collectGear;
  if (step >= 6) return ONBOARDING_DONE;
  if (step >= 4) return ONBOARDING_STAGE.firstCombat;
  return step - 1;
}

/** v4 contained a Build/Combat choice that no longer exists. */
export function migrateBuildModeOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  if (!Number.isInteger(step) || step < 0 || step > 5) return null;
  if (step >= 5) return ONBOARDING_DONE;
  if (step >= 3) return ONBOARDING_STAGE.firstCombat;
  return step;
}

export function migrateOldestOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  if (!Number.isInteger(step) || step < 0 || step > 5) return null;
  if (step === 5) return ONBOARDING_DONE;
  if (step <= 1) return ONBOARDING_STAGE.collectGear;
  if (step >= 4) return ONBOARDING_STAGE.firstCombat;
  return step - 1;
}

export function parseOnboardingStep(value: string | null): number | null {
  if (value === null) return null;
  const step = Number(value);
  return Number.isInteger(step) && step >= 0 && step <= ONBOARDING_DONE ? step : null;
}

export function advanceOnboarding(step: number, event: OnboardingEvent): number {
  return ONBOARDING_STEPS[step]?.event === event ? step + 1 : step;
}

/** A low-level character with no journey state must resolve its Calling before any field tutorial. */
export function shouldStartCallingFirstJourney(step: number | null, level: number, fastModeNewPath = false): boolean {
  return step === null && (level <= 2 || fastModeNewPath);
}

export type StarterInventoryLesson = "hidden" | "open_pack" | "equip_sword";

export function starterInventoryLesson(
  step: number | null,
  packOpenedWithKeyboard: boolean,
  equipmentRequired = false,
  mainHandId = "unarmed",
  starterWeaponId = "forged_sword",
): StarterInventoryLesson {
  if (mainHandId === starterWeaponId) return "hidden";
  // The starter bag must be collected before any inventory instruction appears.
  // A saved requirement can survive a reload, but it must never overtake the
  // current collect-gear step.
  if (step === ONBOARDING_STAGE.collectGear) return "hidden";
  if (step !== ONBOARDING_STAGE.equipSword && !equipmentRequired) return "hidden";
  return packOpenedWithKeyboard ? "equip_sword" : "open_pack";
}

export function starterEquipmentRequired(savedState: string | null, _level: number, _weaponOwned: number,
  mainHandId: string, starterWeaponId = "forged_sword"): boolean {
  if (savedState === "complete" || mainHandId === starterWeaponId) return false;
  return savedState === "required";
}

export function shouldPromptTownDeparture(wasInsideTown: boolean, isBeyondTown: boolean, level: number): boolean {
  return wasInsideTown && isBeyondTown && level >= 1 && level <= 2;
}

export function shouldShowKeyboardCameraHint(input: {
  worldReady: boolean;
  inTown: boolean;
  level: number;
  coarsePointer: boolean;
  dialogOpen: boolean;
  competingNoticeOpen: boolean;
}): boolean {
  return input.worldReady && input.inTown && input.level === 1 && !input.coarsePointer
    && !input.dialogOpen && !input.competingNoticeOpen;
}
