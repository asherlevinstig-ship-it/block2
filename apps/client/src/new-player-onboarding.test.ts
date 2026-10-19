import { describe, expect, it } from "vitest";
import { advanceOnboarding, ONBOARDING_DONE, ONBOARDING_STEPS, onboardingStorageKey,
  legacyOnboardingStorageKey, migrateLegacyOnboardingStep, parseOnboardingStep, shouldPromptTownDeparture,
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
    expect(starterInventoryLesson(2, false)).toBe("open_pack");
    expect(starterInventoryLesson(2, true)).toBe("equip_sword");
    expect(starterInventoryLesson(3, true)).toBe("hidden");
    expect(starterInventoryLesson(ONBOARDING_DONE, false, true)).toBe("open_pack");
    expect(starterInventoryLesson(ONBOARDING_DONE, true, true)).toBe("equip_sword");
    expect(starterInventoryLesson(2, true, true, "forged_sword")).toBe("hidden");
    expect(starterInventoryLesson(ONBOARDING_DONE, false, true, "forged_sword")).toBe("hidden");
    expect(advanceOnboarding(2, "picked_loot")).toBe(2);
    expect(advanceOnboarding(2, "equipped_starter")).toBe(3);
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
    expect(advanceOnboarding(3, "left_town")).toBe(4);
    expect(advanceOnboarding(4, "defeated_first_enemy")).toBe(4);
    expect(advanceOnboarding(4, "switched_combat")).toBe(5);
    expect(advanceOnboarding(5, "defeated_first_enemy")).toBe(ONBOARDING_DONE);
  });

  it("persists separately for each character and ignores invalid saved state", () => {
    expect(onboardingStorageKey("guest_a")).not.toBe(onboardingStorageKey("guest_b"));
    expect(parseOnboardingStep("2")).toBe(2);
    expect(parseOnboardingStep(String(ONBOARDING_DONE))).toBe(ONBOARDING_DONE);
    expect(parseOnboardingStep(null)).toBeNull();
    expect(parseOnboardingStep("999")).toBeNull();
    expect(parseOnboardingStep("not-a-step")).toBeNull();
    expect(legacyOnboardingStorageKey("guest_a")).not.toBe(onboardingStorageKey("guest_a"));
    expect(migrateLegacyOnboardingStep("4")).toBe(4);
    expect(migrateLegacyOnboardingStep("5")).toBe(ONBOARDING_DONE);
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
