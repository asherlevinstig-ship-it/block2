import { describe, expect, it } from "vitest";
import { FAST_WORLD_COLLISION_QUERY } from "./index.js";
import { TOWER_FLOOR_ONE, TOWER_FLOOR_ONE_BOSS_ID, TOWER_FLOOR_ONE_CROWNKEEPER_COMBAT, TOWER_FLOOR_ONE_SPAWNS,
  TOWER_FLOOR_ONE_FORTRESS_COLLIDERS, TOWER_FLOOR_ONE_NORTH_ATTENDANTS,
  TOWER_FLOOR_ONE_NORTH_WARDEN_COMBAT, TOWER_FLOOR_ONE_SOUTH_ATTENDANTS,
  TOWER_FLOOR_ONE_SOUTH_WARDEN_COMBAT, TOWER_FLOOR_ONE_WARDENS, isInsideTowerFloorOne,
  towerFloorOneCrownkeeperPattern, towerFloorOneEncounterAllows, towerFloorOneGroundHeight, towerFloorOneNorthWardenAttackTiming,
  towerFloorOneNorthWardenPattern, towerFloorOneSouthWardenPattern,
  towerFloorOneSouthWardenWindup } from "./tower-floor-one.js";

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

  it("collides with both joined fortress walls while preserving the gate and court lane", () => {
    expect(TOWER_FLOOR_ONE_FORTRESS_COLLIDERS).toHaveLength(2);
    for (const collider of TOWER_FLOOR_ONE_FORTRESS_COLLIDERS) {
      expect(collider.minX).toBeCloseTo(362.1, 4);
      expect(collider.maxX).toBeCloseTo(384.9, 4);
      expect(collider.minY).toBeLessThanOrEqual(towerFloorOneGroundHeight(362.1, 99.5));
      expect(collider.maxY).toBeGreaterThan(17);
    }
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(370, 10, 99.5)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(370, 10, 112.5)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(370, 10, 99.5)?.id)
      .toBe("floor1-fortress-wall-north");
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(370, 10, 112.5)?.id)
      .toBe("floor1-fortress-wall-south");
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(360, 10, 106)).toBe(false);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(370, 10, 106)).toBe(false);
  });

  it("requires two wardens before the single final boss can be awakened", () => {
    expect(TOWER_FLOOR_ONE_WARDENS).toHaveLength(2);
    expect(TOWER_FLOOR_ONE_SPAWNS.filter(spawn => spawn.floorBoss).map(spawn => spawn.id)).toEqual([TOWER_FLOOR_ONE_BOSS_ID]);
    for (const spawn of TOWER_FLOOR_ONE_SPAWNS)
      expect(towerFloorOneEncounterAllows(spawn.id, spawn)).toBe(true);
  });

  it("gives the North Root Warden two attendants and a fixed interrupt lesson", () => {
    expect(TOWER_FLOOR_ONE_NORTH_ATTENDANTS).toHaveLength(2);
    for (const id of TOWER_FLOOR_ONE_NORTH_ATTENDANTS)
      expect(TOWER_FLOOR_ONE_SPAWNS.some(spawn => spawn.id === id)).toBe(true);
    expect([0, 1, 2, 3, 4, 5].map(sequence => towerFloorOneNorthWardenPattern(sequence)))
      .toEqual(["smash", "smash", "root-slam", "smash", "smash", "root-slam"]);
    expect(towerFloorOneNorthWardenPattern(2, true)).toBe("smash");
    expect(towerFloorOneNorthWardenAttackTiming("root-slam").windupMs)
      .toBeGreaterThan(towerFloorOneNorthWardenAttackTiming("smash").windupMs);
    expect(TOWER_FLOOR_ONE_NORTH_WARDEN_COMBAT.exposedMs).toBe(3_200);
  });

  it("makes the South Root Warden a fixed ranged-control lesson", () => {
    expect(TOWER_FLOOR_ONE_SOUTH_ATTENDANTS).toHaveLength(2);
    for (const id of TOWER_FLOOR_ONE_SOUTH_ATTENDANTS)
      expect(TOWER_FLOOR_ONE_SPAWNS.some(spawn => spawn.id === id)).toBe(true);
    expect([0, 1, 2, 3, 4, 5].map(sequence => towerFloorOneSouthWardenPattern(sequence)))
      .toEqual(["aimed", "fan", "venom-ring", "aimed", "fan", "venom-ring"]);
    expect(towerFloorOneSouthWardenWindup("venom-ring"))
      .toBeGreaterThan(towerFloorOneSouthWardenWindup("fan"));
    expect(TOWER_FLOOR_ONE_SOUTH_WARDEN_COMBAT.exposedMs).toBe(3_200);
  });

  it("gives the Crownkeeper a tougher fixed three-phase finale", () => {
    expect(TOWER_FLOOR_ONE_CROWNKEEPER_COMBAT.health).toBeGreaterThan(34);
    expect([0, 1, 2, 3].map(sequence => towerFloorOneCrownkeeperPattern(sequence, 1)))
      .toEqual(["smash", "slam", "smash", "rocks"]);
    expect([0, 1, 2, 3].map(sequence => towerFloorOneCrownkeeperPattern(sequence, 2)))
      .toEqual(["charge", "rocks", "smash", "slam"]);
    expect([0, 1, 2, 3].map(sequence => towerFloorOneCrownkeeperPattern(sequence, 3)))
      .toEqual(["warden-barrage", "charge", "smash", "rocks"]);
  });
});
