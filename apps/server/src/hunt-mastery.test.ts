import { describe, expect, it } from "vitest";
import { completeHuntMastery, emptyHuntMastery, huntDifficultyLives, huntDifficultyStatTier,
  huntDifficultyUnlocked, huntEquipmentRewards, parseHuntMastery, serializeHuntMastery } from "./hunt-mastery.js";

describe("Hunt Mastery", () => {
  it("unlocks Veteran at rank one and Ascendant at rank three", () => {
    expect(huntDifficultyUnlocked(0, "normal")).toBe(true);
    expect(huntDifficultyUnlocked(0, "veteran")).toBe(false);
    expect(huntDifficultyUnlocked(1, "veteran")).toBe(true);
    expect(huntDifficultyUnlocked(2, "ascendant")).toBe(false);
    expect(huntDifficultyUnlocked(3, "ascendant")).toBe(true);
  });
  it("records ranks and only improves best times", () => {
    let progress = completeHuntMastery(emptyHuntMastery(), "fang", "normal", 30_000);
    progress = completeHuntMastery(progress, "fang", "veteran", 45_000);
    progress = completeHuntMastery(progress, "fang", "normal", 35_000);
    expect(progress.fang).toEqual({ rank: 4, bestTimesMs: { normal: 30_000, veteran: 45_000 } });
    expect(parseHuntMastery(serializeHuntMastery(progress))).toEqual(progress);
  });
  it("gives Ascendant three lives and four additional stat tiers", () => {
    expect(huntDifficultyLives("ascendant")).toBe(3);
    expect(huntDifficultyStatTier("ascendant")).toBe(4);
    expect(huntDifficultyLives("veteran")).toBe(0);
  });
  it("builds clear, path-specific champion cache guarantees", () => {
    expect(huntEquipmentRewards("fang", "normal", false, 0)).toEqual(["fang_dagger"]);
    expect(huntEquipmentRewards("venom", "veteran", false, .99)).toEqual(["acid_gland_focus", "venomweave_mantle"]);
    expect(huntEquipmentRewards("venom", "veteran", true, .34)).toEqual(["acid_gland_focus", "venomweave_mantle"]);
    expect(huntEquipmentRewards("venom", "veteran", true, .35)).toEqual(["acid_gland_focus"]);
    expect(huntEquipmentRewards("crusher", "ascendant", true, .99)).toEqual([
      "stone_core_hammer", "worldsplitter_plate", "crusher_forgemark",
    ]);
  });
});
