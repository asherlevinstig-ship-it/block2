import { describe, expect, it } from "vitest";
import { FAST_WORLD_COLLISION_QUERY } from "./index.js";
import { TOWER_FLOOR_TWO, TOWER_FLOOR_TWO_COLLIDERS, TOWER_FLOOR_TWO_ROOMS,
  TOWER_FLOOR_TWO_ROUTES, TOWER_FLOOR_TWO_BOSS_ID, TOWER_FLOOR_TWO_ENCOUNTERS,
  TOWER_FLOOR_TWO_FORGEHEART_COMBAT, TOWER_FLOOR_TWO_REGULATORS, TOWER_FLOOR_TWO_SPAWNS,
  TOWER_FLOOR_TWO_VENTS, isInsideTowerFloorTwo, towerFloorTwoEncounterAllows,
  towerFloorTwoEncounterBounds, towerFloorTwoEruptingVentAt, towerFloorTwoForgeheartPattern, towerFloorTwoForgeheartPhase,
  towerFloorTwoGroundHeight, towerFloorTwoVentPhase } from "./tower-floor-two.js";

describe("Floor 2 Emberworks greybox", () => {
  it("is wider than Floor 1 while retaining a clear central route", () => {
    expect(TOWER_FLOOR_TWO.bounds.maxX - TOWER_FLOOR_TWO.bounds.minX).toBe(132);
    expect(TOWER_FLOOR_TWO_ROOMS.map(room => room.id)).toContain("floor2-forgeheart");
    expect(TOWER_FLOOR_TWO_ROUTES.every(route => route.width >= 5)).toBe(true);
  });

  it("raises regulators and the boss through traversable shared terrain", () => {
    expect(towerFloorTwoGroundHeight(416, 106)).toBeCloseTo(8, 1);
    expect(towerFloorTwoGroundHeight(458, 106)).toBeCloseTo(8.35, 2);
    expect(towerFloorTwoGroundHeight(480, 70)).toBeCloseTo(8.65, 2);
    expect(towerFloorTwoGroundHeight(525, 106)).toBeCloseTo(9.25, 2);
  });

  it("keeps portals inside the floor and wall runs away from its route centres", () => {
    expect(isInsideTowerFloorTwo(TOWER_FLOOR_TWO.entry.x, TOWER_FLOOR_TWO.entry.z, 2)).toBe(true);
    expect(isInsideTowerFloorTwo(TOWER_FLOOR_TWO.ascentPortal.x, TOWER_FLOOR_TWO.ascentPortal.z, 2)).toBe(true);
    for (const room of TOWER_FLOOR_TWO_ROOMS) expect(TOWER_FLOOR_TWO_COLLIDERS.some(wall =>
      room.x >= wall.minX && room.x <= wall.maxX && room.z >= wall.minZ && room.z <= wall.maxZ)).toBe(false);
  });

  it("keeps every authored route clear and limits terrain changes to walkable increments", () => {
    for (const route of TOWER_FLOOR_TWO_ROUTES) {
      let previousHeight = towerFloorTwoGroundHeight(route.from[0], route.from[1]);
      const routeLength = Math.hypot(route.to[0] - route.from[0], route.to[1] - route.from[1]);
      const samples = Math.ceil(routeLength);
      for (let index = 0; index <= samples; index++) {
        const t = index / samples;
        const x = route.from[0] + (route.to[0] - route.from[0]) * t;
        const z = route.from[1] + (route.to[1] - route.from[1]) * t;
        const height = towerFloorTwoGroundHeight(x, z);
        expect(Math.abs(height - previousHeight), `${route.id} terrain jump at ${t.toFixed(2)}`).toBeLessThanOrEqual(.25);
        expect(FAST_WORLD_COLLISION_QUERY.cellSolid(x, Math.ceil(height) + .1, z),
          `${route.id} blocked at ${x.toFixed(1)},${z.toFixed(1)}`).toBe(false);
        previousHeight = height;
      }
    }
  });

  it("seals the island, supports its walkable floor and collides with visible walls", () => {
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_TWO.entry.x, 7, TOWER_FLOOR_TWO.entry.z)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_TWO.entry.x, 8, TOWER_FLOOR_TWO.entry.z)).toBe(false);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(430, 9, 92)).toBe(true);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(436, 9, 106)).toBe(false);
    expect(FAST_WORLD_COLLISION_QUERY.cellSolid(TOWER_FLOOR_TWO.bounds.maxX + 2, 8, 106)).toBe(true);
  });

  it("authors a complete regulator-to-boss encounter circuit", () => {
    expect(TOWER_FLOOR_TWO_REGULATORS).toHaveLength(2);
    expect(TOWER_FLOOR_TWO_SPAWNS.filter(spawn => spawn.floorBoss).map(spawn => spawn.id))
      .toEqual([TOWER_FLOOR_TWO_BOSS_ID]);
    for (const encounter of TOWER_FLOOR_TWO_ENCOUNTERS)
      for (const id of encounter.memberIds) expect(TOWER_FLOOR_TWO_SPAWNS.some(spawn => spawn.id === id), id).toBe(true);
    for (const spawn of TOWER_FLOOR_TWO_SPAWNS)
      expect(towerFloorTwoEncounterAllows(spawn.id, spawn), spawn.id).toBe(true);
    const hound = TOWER_FLOOR_TWO_SPAWNS.find(spawn => spawn.id === "floor2-bellows-hound-a")!;
    const bounds = towerFloorTwoEncounterBounds(hound.id)!;
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(20);
    expect(towerFloorTwoEncounterAllows(hound.id, { x: 486, y: towerFloorTwoGroundHeight(486, 86), z: 86 })).toBe(true);
    expect(towerFloorTwoEncounterAllows(hound.id, { x: 500, y: towerFloorTwoGroundHeight(500, 86), z: 86 })).toBe(false);
  });

  it("gives the Forgeheart fixed learnable phases rather than random attacks", () => {
    expect(TOWER_FLOOR_TWO_FORGEHEART_COMBAT.health).toBeGreaterThan(50);
    expect([0, 1, 2].map(index => towerFloorTwoForgeheartPattern(index, 1)))
      .toEqual(["smash", "slam", "rocks"]);
    expect([0, 1, 2, 3].map(index => towerFloorTwoForgeheartPattern(index, 3)))
      .toEqual(["warden-barrage", "charge", "smash", "rocks"]);
    expect(towerFloorTwoForgeheartPhase(77, 78)).toBe(1);
    expect(towerFloorTwoForgeheartPhase(48, 78)).toBe(2);
    expect(towerFloorTwoForgeheartPhase(21, 78)).toBe(3);
  });

  it("shares a readable, non-overlapping factory vent cycle with authority", () => {
    expect(TOWER_FLOOR_TWO_VENTS.filter(vent => vent.group === "boss")).toHaveLength(4);
    expect(towerFloorTwoVentPhase(0, 4_300)).toBe("warning");
    expect(towerFloorTwoVentPhase(0, 5_600)).toBe("erupting");
    expect(towerFloorTwoEruptingVentAt(442, 106, 5_600)?.id).toBe("intake-teaching-vent");
    expect(towerFloorTwoEruptingVentAt(442, 106, 5_600, group => group !== "intake")).toBeUndefined();
  });
});
