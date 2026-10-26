import { describe, expect, it } from "vitest";
import { FAST_WORLD_COLLISION_QUERY } from "./index.js";
import { TOWER_FLOOR_ONE, TOWER_FLOOR_ONE_BOSS_ID, TOWER_FLOOR_ONE_SPAWNS,
  TOWER_FLOOR_ONE_WARDENS, isInsideTowerFloorOne, towerFloorOneEncounterAllows,
  towerFloorOneGroundHeight } from "./tower-floor-one.js";

describe("tower floor one manifest", () => {
  it("keeps the sanctuary, encounters and boss on a sealed playable island", () => {
    expect(isInsideTowerFloorOne(TOWER_FLOOR_ONE.entry.x, TOWER_FLOOR_ONE.entry.z, 1)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_ONE.entry.x, 7, TOWER_FLOOR_ONE.entry.z)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_ONE.entry.x, 8, TOWER_FLOOR_ONE.entry.z)).toBe(false);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_ONE.bounds.maxX + 2, 8, 106)).toBe(true);
  });

  it("authors real elevation for the sanctuary, wardens and crown court", () => {
    expect(towerFloorOneGroundHeight(306, 106)).toBeCloseTo(9, 4);
    expect(towerFloorOneGroundHeight(329, 106)).toBeGreaterThan(8);
    expect(towerFloorOneGroundHeight(350, 80)).toBeCloseTo(8.68, 4);
    expect(towerFloorOneGroundHeight(375, 106)).toBeCloseTo(9.55, 4);
    expect(towerFloorOneGroundHeight(320, 65)).toBe(8);
  });

  it("requires two wardens before the single final boss can be awakened", () => {
    expect(TOWER_FLOOR_ONE_WARDENS).toHaveLength(2);
    expect(TOWER_FLOOR_ONE_SPAWNS.filter(spawn => spawn.floorBoss).map(spawn => spawn.id)).toEqual([TOWER_FLOOR_ONE_BOSS_ID]);
    for (const spawn of TOWER_FLOOR_ONE_SPAWNS)
      expect(towerFloorOneEncounterAllows(spawn.id, spawn)).toBe(true);
  });
});
