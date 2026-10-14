import { describe, expect, it } from "vitest";
import { completeHuntMastery, emptyHuntMastery, huntDifficultyLives, huntDifficultyStatTier,
  huntDifficultyUnlocked, parseHuntMastery, serializeHuntMastery } from "./hunt-mastery.js";

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
});
