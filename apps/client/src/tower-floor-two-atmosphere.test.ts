import { describe, expect, it } from "vitest";
import { TOWER_FLOOR_TWO_ATMOSPHERE } from "./tower-floor-two-atmosphere.js";

describe("Floor 2 atmosphere", () => {
  it("uses a dark, cool sky while retaining enough ambient light for navigation", () => {
    expect(Math.max(...TOWER_FLOOR_TWO_ATMOSPHERE.skyTint)).toBeLessThan(.3);
    expect(TOWER_FLOOR_TWO_ATMOSPHERE.skyTint[2]).toBeGreaterThan(TOWER_FLOOR_TWO_ATMOSPHERE.skyTint[0]);
    expect(TOWER_FLOOR_TWO_ATMOSPHERE.ambient[0]).toBeGreaterThan(.08);
    expect(TOWER_FLOOR_TWO_ATMOSPHERE.sun).toBeLessThan(.25);
    expect(TOWER_FLOOR_TWO_ATMOSPHERE.fogEnd).toBeGreaterThan(50);
  });
});
