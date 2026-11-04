import { describe, expect, it } from "vitest";
import { DUNGEON_MINIMAP_INTERVAL_MS, SURFACE_FAR_CLIP, TOWER_FLOOR_ONE_FAR_CLIP,
  TOWER_FLOOR_TWO_FAR_CLIP, dungeonFarClip, dungeonMinimapUpdateDue } from "./dungeon-performance-policy.js";

describe("dungeon performance policy", () => {
  it("culls beyond the authored tower fog without changing the surface view", () => {
    expect(dungeonFarClip(false, false)).toBe(SURFACE_FAR_CLIP);
    expect(dungeonFarClip(true, false)).toBe(TOWER_FLOOR_ONE_FAR_CLIP);
    expect(dungeonFarClip(false, true)).toBe(TOWER_FLOOR_TWO_FAR_CLIP);
    expect(TOWER_FLOOR_ONE_FAR_CLIP).toBeLessThan(SURFACE_FAR_CLIP);
    expect(TOWER_FLOOR_TWO_FAR_CLIP).toBeLessThan(SURFACE_FAR_CLIP);
  });

  it("limits dungeon minimap redraws to ten Hz", () => {
    expect(dungeonMinimapUpdateDue(1_000, 999, false)).toBe(true);
    expect(dungeonMinimapUpdateDue(1_000, 1_000 - DUNGEON_MINIMAP_INTERVAL_MS + 1, true)).toBe(false);
    expect(dungeonMinimapUpdateDue(1_000, 1_000 - DUNGEON_MINIMAP_INTERVAL_MS, true)).toBe(true);
  });
});
