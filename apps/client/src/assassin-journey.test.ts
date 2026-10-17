import { describe, expect, it } from "vitest";
import { assassinJourney } from "./assassin-journey.js";
import type { BuildPathUpdate } from "@blockcraft/protocol";

const update = (overrides: Partial<BuildPathUpdate> = {}): BuildPathUpdate => ({
  selectedPathId: "assassin", rank: 0, xp: 0, nextRankXp: 10, selectedCallingAbilityId: "assassin_vanish",
  selectedCallingAugmentId: null, callingAugmentProgress: {}, masteredCallingAugments: [],
  selectedSpecializationId: null, candidates: [], canChoose: true, canSpecialize: false,
  masterTrial: null, inTown: true, message: "", ...overrides,
});

describe("Assassin progression summary", () => {
  it("separates character-level controls from Path Mastery choices", () => {
    expect(assassinJourney(update(), 1).next).toContain("CHARACTER LV 2");
    expect(assassinJourney(update(), 2).next).toContain("CHARACTER LV 4");
    expect(assassinJourney(update(), 4).next).toContain("PATH RANK 2");
  });
  it("shows one relevant ability trial, then the specialization trial", () => {
    const adept = update({ rank: 2, xp: 30, callingAugmentProgress: { vanish_killing_intent: 6 } });
    expect(assassinJourney(adept, 4).trial).toContain("Killing Intent · 6/12");
    const veteran = update({ rank: 3, xp: 70, selectedSpecializationId: "executioner",
      masterTrial: { name: "Executioner", description: "Land 15 empowered killing blows.", progress: 4,
        target: 15, complete: false, capstone: "DEATHBLOW" } });
    expect(assassinJourney(veteran, 4).trial).toContain("Executioner trial · 4/15");
  });
});
