import { describe, expect, it } from "vitest";
import { MOB_ARCHETYPES } from "../src/mob-archetypes.js";
import { DANGER_BANDS, MOB_TOWN_MINIMUM_RADIUS, dangerBandAt, isInsideTownSafeZone, keepMobOutsideTown, radiusFromSafeCenter, scaledMobStats } from "../src/radial-difficulty.js";

describe("radial danger progression", () => {
  it("raises underground danger by depth without changing town protection", () => {
    expect(dangerBandAt({ x: 39.5, y: 3, z: 6.5 }).tier).toBe(2);
    expect(dangerBandAt({ x: 48.5, y: 1, z: 10.5 }).tier).toBe(3);
    expect(dangerBandAt({ x: 8.5, y: 1, z: 8.5 }).tier).toBe(0);
  });
  it("increases the danger band as players travel from the safe centre", () => {
    expect(dangerBandAt({ x: 8.5, z: 8.5 }).tier).toBe(0);
    expect(dangerBandAt({ x: 14.5, z: 8.5 }).tier).toBe(0);
    expect(dangerBandAt({ x: 31.5, z: 8.5 }).tier).toBe(1);
    expect(dangerBandAt({ x: 43.5, z: 8.5 }).tier).toBe(2);
    expect(dangerBandAt({ x: 55.5, z: 8.5 }).tier).toBe(3);
    expect(radiusFromSafeCenter({ x: 11.5, z: 12.5 })).toBe(5);
    expect(isInsideTownSafeZone({ x: 15.5, z: 8.5 })).toBe(true);
    expect(isInsideTownSafeZone({ x: 17.5, z: 8.5 })).toBe(true);
    expect(isInsideTownSafeZone({ x: 31.5, z: 8.5 })).toBe(false);
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

  it("keeps every archetype spawn and a pursuing mob outside the town buffer", () => {
    for (const archetype of Object.values(MOB_ARCHETYPES)) {
      expect(radiusFromSafeCenter(archetype.spawn)).toBeGreaterThanOrEqual(MOB_TOWN_MINIMUM_RADIUS);
    }
    const approaching = keepMobOutsideTown({ x: 18, z: 8.5 });
    expect(radiusFromSafeCenter(approaching)).toBeCloseTo(MOB_TOWN_MINIMUM_RADIUS);
    expect(approaching.x).toBeGreaterThan(18);
    expect(keepMobOutsideTown({ x: 40, z: 8.5 })).toEqual({ x: 40, z: 8.5 });
  });
});
