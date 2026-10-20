import { describe, expect, it } from "vitest";
import { advanceAutoQuality, initialAutoQualityTier, parseGraphicsQualityMode, type AutoQualityState } from "./graphics-quality.js";

describe("graphics quality", () => {
  it("defaults unknown saved values to automatic quality", () => {
    expect(parseGraphicsQualityMode(null)).toBe("auto");
    expect(parseGraphicsQualityMode("ultra")).toBe("auto");
    expect(parseGraphicsQualityMode("low")).toBe("low");
  });

  it("starts high on ordinary desktop screens and medium on constrained devices", () => {
    expect(initialAutoQualityTier(false, 1_500_000)).toBe("high");
    expect(initialAutoQualityTier(true, 1_500_000)).toBe("medium");
    expect(initialAutoQualityTier(false, 2_100_000)).toBe("medium");
  });

  it("requires sustained slow frames and a cooldown before lowering quality", () => {
    let state: AutoQualityState = { tier: "high", slowSamples: 0, fastSamples: 0, changedAt: 0 };
    for (let sample = 1; sample <= 3; sample++) state = advanceAutoQuality(state, 45, 9_000 + sample * 500);
    expect(state.tier).toBe("high");
    state = advanceAutoQuality(state, 45, 11_000);
    expect(state.tier).toBe("medium");
  });

  it("restores quality only after a long stable recovery", () => {
    let state: AutoQualityState = { tier: "low", slowSamples: 0, fastSamples: 0, changedAt: 0 };
    for (let sample = 1; sample <= 23; sample++) state = advanceAutoQuality(state, 16, 9_000 + sample * 500);
    expect(state.tier).toBe("low");
    state = advanceAutoQuality(state, 16, 21_000);
    expect(state.tier).toBe("medium");
  });

  it("resets streaks when frame pacing crosses the threshold", () => {
    const state = advanceAutoQuality({ tier: "high", slowSamples: 3, fastSamples: 0, changedAt: 0 }, 28, 10_000);
    expect(state.slowSamples).toBe(0);
    expect(state.tier).toBe("high");
  });

});
