import { describe, expect, it } from "vitest";
import { TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS } from "./tower-floor-one-layout.js";

describe("Floor 1 encounter composition", () => {
  it("matches visual courts to the authoritative gameplay terraces", () => {
    expect(TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS).toEqual({
      sanctuary: 13.5,
      openingCourt: 15,
      wardenCourt: 15.5,
      crownCourt: 19.5,
    });
  });

  it("preserves negative space between combat courts", () => {
    const openingToNorth = Math.hypot(350 - 329, 80 - 106)
      - TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS.openingCourt
      - TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS.wardenCourt;
    const openingToCrown = 375 - 329
      - TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS.openingCourt
      - TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS.crownCourt;
    const wardenSeparation = 132 - 80 - TOWER_FLOOR_ONE_VISUAL_FOOTPRINTS.wardenCourt * 2;
    expect(openingToNorth).toBeGreaterThan(2);
    expect(openingToCrown).toBeGreaterThan(10);
    expect(wardenSeparation).toBeGreaterThan(20);
  });
});
