import { describe, expect, it } from "vitest";
import { onboardingTrailRoute, sampleTrail } from "./onboarding-trail.js";

const player = { x: 8.5, y: 8, z: 8.5 };

describe("onboarding glow trail", () => {
  it("leads the opening steps along the east-gate road", () => {
    expect(onboardingTrailRoute(0, player, [], []).at(-1)).toEqual({ x: 33.5, y: 8, z: 8.5 });
    expect(sampleTrail(player, onboardingTrailRoute(1, player, [], []))).toHaveLength(18);
  });

  it("selects a nearby ordinary first enemy, not a mini-boss", () => {
    const boss = { x: 30, y: 8, z: 8, alive: true, level: 2, isMiniBoss: true, isElite: false };
    const crawler = { x: 35, y: 8, z: 9, alive: true, level: 2, isMiniBoss: false, isElite: false };
    expect(onboardingTrailRoute(2, player, [boss, crawler], [])).toEqual([crawler]);
  });

  it("follows a nearby drop and vanishes after the tutorial", () => {
    const drop = { x: 36, y: 8, z: 9 };
    expect(onboardingTrailRoute(3, player, [], [drop])).toEqual([drop]);
    expect(onboardingTrailRoute(4, player, [], [drop])).toEqual([]);
    expect(onboardingTrailRoute(5, player, [], [drop])).toEqual([]);
    expect(onboardingTrailRoute(null, player, [], [drop])).toEqual([]);
  });
});
