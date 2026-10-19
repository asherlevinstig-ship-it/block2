import { describe, expect, it } from "vitest";
import { advanceOnboarding, ONBOARDING_DONE, ONBOARDING_STEPS, onboardingStorageKey,
  legacyOnboardingStorageKey, migrateLegacyOnboardingStep, parseOnboardingStep, shouldPromptTownDeparture } from "./new-player-onboarding.js";

describe("first-play onboarding", () => {
  it("advances only on the current real-world action", () => {
    expect(advanceOnboarding(0, "landed_hit")).toBe(0);
    let step = 0;
    for (const action of ONBOARDING_STEPS) step = advanceOnboarding(step, action.event);
    expect(step).toBe(ONBOARDING_DONE);
    expect(advanceOnboarding(step, "opened_pack")).toBe(ONBOARDING_DONE);
  });

  it("requires a Combat switch after leaving town before the first fight counts", () => {
    expect(advanceOnboarding(3, "left_town")).toBe(4);
    expect(advanceOnboarding(4, "landed_hit")).toBe(4);
    expect(advanceOnboarding(4, "switched_combat")).toBe(5);
    expect(advanceOnboarding(5, "landed_hit")).toBe(ONBOARDING_DONE);
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
