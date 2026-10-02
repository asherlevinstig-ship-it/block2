import { describe, expect, it } from "vitest";
import { MOB_ARCHETYPES } from "../src/mob-archetypes.js";
import { DANGER_BANDS, dangerBandAt, radiusFromSafeCenter, scaledMobStats } from "../src/radial-difficulty.js";

describe("radial danger progression", () => {
  it("increases the danger band as players travel from the safe centre", () => {
    expect(dangerBandAt({ x: 8.5, z: 8.5 }).tier).toBe(0);
    expect(dangerBandAt({ x: 14.5, z: 8.5 }).tier).toBe(1);
    expect(dangerBandAt({ x: 20.5, z: 8.5 }).tier).toBe(2);
    expect(dangerBandAt({ x: 28.5, z: 8.5 }).tier).toBe(3);
    expect(radiusFromSafeCenter({ x: 11.5, z: 12.5 })).toBe(5);
  });

  it("makes frontier mobs tougher, faster and more rewarding", () => {
    const normal = scaledMobStats(MOB_ARCHETYPES.moss_crawler, DANGER_BANDS[1]!);
    const frontier = scaledMobStats(MOB_ARCHETYPES.moss_crawler, DANGER_BANDS[3]!);
    expect(frontier.maxHealth).toBeGreaterThan(normal.maxHealth);
    expect(frontier.damage).toBeGreaterThan(normal.damage);
    expect(frontier.armor).toBeGreaterThan(normal.armor);
    expect(frontier.speedMultiplier).toBeGreaterThan(normal.speedMultiplier);
    expect(frontier.rewardMultiplier).toBeGreaterThan(normal.rewardMultiplier);
  });
});
