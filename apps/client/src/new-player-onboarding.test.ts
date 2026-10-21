import { describe, expect, it } from "vitest";
import { advanceOnboarding, ONBOARDING_DONE, ONBOARDING_STAGE, ONBOARDING_STEPS, onboardingStorageKey,
  callingFirstOnboardingStorageKey, legacyOnboardingStorageKey, migrateLegacyOnboardingStep,
  migrateOldestOnboardingStep, oldestOnboardingStorageKey, parseOnboardingStep,
  shouldDeferOnboardingForCalling, shouldPromptTownDeparture, shouldStartCallingFirstJourney,
  starterEquipmentRequired, starterEquipmentStorageKey, starterInventoryLesson } from "./new-player-onboarding.js";

describe("first-play onboarding", () => {
  it("advances only on the current real-world action", () => {
    expect(advanceOnboarding(0, "defeated_first_enemy")).toBe(0);
    let step = 0;
    for (const action of ONBOARDING_STEPS) step = advanceOnboarding(step, action.event);
    expect(step).toBe(ONBOARDING_DONE);
    expect(advanceOnboarding(step, "equipped_starter")).toBe(ONBOARDING_DONE);
  });

  it("requires the I-key lesson and the actual starter sword equip", () => {
    expect(starterInventoryLesson(ONBOARDING_STAGE.equipSword, false)).toBe("open_pack");
    expect(starterInventoryLesson(ONBOARDING_STAGE.equipSword, true)).toBe("equip_sword");
    expect(starterInventoryLesson(ONBOARDING_STAGE.headSouth, true)).toBe("hidden");
    expect(starterInventoryLesson(ONBOARDING_DONE, false, true)).toBe("open_pack");
    expect(starterInventoryLesson(ONBOARDING_DONE, true, true)).toBe("equip_sword");
    expect(starterInventoryLesson(ONBOARDING_STAGE.equipSword, true, true, "forged_sword")).toBe("hidden");
    expect(starterInventoryLesson(ONBOARDING_DONE, false, true, "forged_sword")).toBe("hidden");
    expect(advanceOnboarding(ONBOARDING_STAGE.equipSword, "picked_loot")).toBe(ONBOARDING_STAGE.equipSword);
    expect(advanceOnboarding(ONBOARDING_STAGE.equipSword, "equipped_starter")).toBe(ONBOARDING_STAGE.headSouth);
  });

  it("holds brand-new and interrupted characters at Calling selection before movement lessons", () => {
    expect(shouldDeferOnboardingForCalling(true, null, null)).toBe(true);
    expect(shouldDeferOnboardingForCalling(false, "pending", null)).toBe(true);
    expect(shouldDeferOnboardingForCalling(false, null, null)).toBe(false);
    expect(shouldDeferOnboardingForCalling(true, "pending", 0)).toBe(false);
    expect(shouldStartCallingFirstJourney(null, 1)).toBe(true);
    expect(shouldStartCallingFirstJourney(null, 2)).toBe(true);
    expect(shouldStartCallingFirstJourney(null, 3)).toBe(false);
    expect(shouldStartCallingFirstJourney(0, 1)).toBe(false);
    expect(callingFirstOnboardingStorageKey("guest_a")).not.toBe(callingFirstOnboardingStorageKey("guest_b"));
  });

  it("ties the forced equipment lesson to the starter sword, even when numbered onboarding drifted", () => {
    expect(starterEquipmentRequired("required", 10, 0, "unarmed")).toBe(true);
    expect(starterEquipmentRequired(null, 1, 1, "unarmed")).toBe(true);
    expect(starterEquipmentRequired(null, 2, 1, "unarmed")).toBe(true);
    expect(starterEquipmentRequired(null, 3, 1, "unarmed")).toBe(false);
    expect(starterEquipmentRequired("complete", 1, 1, "unarmed")).toBe(false);
    expect(starterEquipmentRequired("required", 1, 1, "forged_sword")).toBe(false);
    expect(starterEquipmentStorageKey("guest_a")).not.toBe(starterEquipmentStorageKey("guest_b"));
  });

  it("requires a Combat switch after leaving town before the first fight counts", () => {
    expect(advanceOnboarding(ONBOARDING_STAGE.headSouth, "left_town")).toBe(ONBOARDING_STAGE.chooseMode);
    expect(advanceOnboarding(ONBOARDING_STAGE.chooseMode, "defeated_first_enemy")).toBe(ONBOARDING_STAGE.chooseMode);
    expect(advanceOnboarding(ONBOARDING_STAGE.chooseMode, "switched_combat")).toBe(ONBOARDING_STAGE.firstCombat);
    expect(advanceOnboarding(ONBOARDING_STAGE.firstCombat, "defeated_first_enemy")).toBe(ONBOARDING_DONE);
  });

  it("completes the authoritative Calling-to-first-victory journey in order", () => {
    expect(shouldStartCallingFirstJourney(null, 1)).toBe(true);
    let step: number = ONBOARDING_STAGE.collectGear;
    expect(starterInventoryLesson(step, false)).toBe("hidden");
    step = advanceOnboarding(step, "picked_loot");
    expect(step).toBe(ONBOARDING_STAGE.equipSword);
    expect(starterInventoryLesson(step, false)).toBe("open_pack");
    expect(advanceOnboarding(step, "left_town")).toBe(step);
    step = advanceOnboarding(step, "equipped_starter");
    expect(step).toBe(ONBOARDING_STAGE.headSouth);
    step = advanceOnboarding(step, "left_town");
    expect(step).toBe(ONBOARDING_STAGE.chooseMode);
    step = advanceOnboarding(step, "switched_combat");
    expect(step).toBe(ONBOARDING_STAGE.firstCombat);
    step = advanceOnboarding(step, "defeated_first_enemy");
    expect(step).toBe(ONBOARDING_DONE);
    expect(starterInventoryLesson(step, false, true, "forged_sword")).toBe("hidden");
  });

  it("persists separately for each character and ignores invalid saved state", () => {
    expect(onboardingStorageKey("guest_a")).not.toBe(onboardingStorageKey("guest_b"));
    expect(parseOnboardingStep("2")).toBe(2);
    expect(parseOnboardingStep(String(ONBOARDING_DONE))).toBe(ONBOARDING_DONE);
    expect(parseOnboardingStep(null)).toBeNull();
    expect(parseOnboardingStep("999")).toBeNull();
    expect(parseOnboardingStep("not-a-step")).toBeNull();
    expect(legacyOnboardingStorageKey("guest_a")).not.toBe(onboardingStorageKey("guest_a"));
    expect(oldestOnboardingStorageKey("guest_a")).not.toBe(legacyOnboardingStorageKey("guest_a"));
    expect(migrateLegacyOnboardingStep("0")).toBe(ONBOARDING_STAGE.collectGear);
    expect(migrateLegacyOnboardingStep("1")).toBe(ONBOARDING_STAGE.collectGear);
    expect(migrateLegacyOnboardingStep("4")).toBe(ONBOARDING_STAGE.chooseMode);
    expect(migrateLegacyOnboardingStep("5")).toBe(ONBOARDING_STAGE.firstCombat);
    expect(migrateLegacyOnboardingStep("6")).toBe(ONBOARDING_DONE);
    expect(migrateOldestOnboardingStep("4")).toBe(ONBOARDING_STAGE.chooseMode);
    expect(migrateOldestOnboardingStep("5")).toBe(ONBOARDING_DONE);
    expect(migrateLegacyOnboardingStep("not-a-step")).toBeNull();
  });

  it("prompts every genuine low-level departure, but not an outside spawn or veteran", () => {
    expect(shouldPromptTownDeparture(true, true, 1)).toBe(true);
    expect(shouldPromptTownDeparture(true, true, 2)).toBe(true);
    expect(shouldPromptTownDeparture(false, true, 1)).toBe(false);
    expect(shouldPromptTownDeparture(true, false, 1)).toBe(false);
    expect(shouldPromptTownDeparture(true, true, 3)).toBe(false);
  });
});
