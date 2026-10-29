import { describe, expect, it } from "vitest";
import { FAST_WORLD_TOWN_BOUNDS, fastWorldGroundHeight as height, rapidPracticeCollisionCellSolid } from "@blockcraft/protocol";
import { Block, resolvePlayerMotion, resolveSweptHorizontalMotion, stepPlayerNetcode, voxelRaycast,
  type WorldBlockReader } from "@blockcraft/voxel-world";
import { findLootLanding } from "./loot-placement.js";
import { moveMobSafely, walkableMobSpawn } from "./mob-navigation.js";

const reader: WorldBlockReader = Object.assign(
  (x: number, y: number, z: number) => rapidPracticeCollisionCellSolid(x, y, z) ? Block.Stone : Block.Air,
  { groundHeight: height },
);

describe("Town of Beginnings shared collision", () => {
  it("keeps the town walkable and the removed wilderness closed", () => {
    expect(height(65, 106)).toBe(8);
    expect(rapidPracticeCollisionCellSolid(65, 8, 106)).toBe(false);
    expect(rapidPracticeCollisionCellSolid(130, 8, 106)).toBe(true);
  });

  it("walks across the civic centre without changing horizontal speed", () => {
    let pose = { x: 60, y: height(60, 106), z: 106, verticalVelocity: 0 };
    for (let i = 0; i < 200; i++) {
      const before = pose;
      pose = stepPlayerNetcode(pose, { strafe: 1, forward: 0 }, 5.8, 1 / 60, reader);
      expect(pose.x - before.x).toBeCloseTo(5.8 / 60, 8);
      expect(pose.y).toBeCloseTo(height(pose.x, pose.z), 8);
    }
  });

  it("walks the Founders and market ramps without snagging or desyncing", () => {
    for (const route of [
      { start: { x: 66, z: 73 }, strafe: -1, steps: 105 },
      { start: { x: 75, z: 92 }, strafe: 1, steps: 210 },
      { start: { x: 75, z: 120 }, strafe: 1, steps: 210 },
    ]) {
      let pose = { x: route.start.x, y: height(route.start.x, route.start.z), z: route.start.z, verticalVelocity: 0 };
      for (let index = 0; index < route.steps; index++) {
        const before = pose;
        pose = stepPlayerNetcode(pose, { strafe: route.strafe, forward: 0 }, 5.8, 1 / 60, reader);
        expect(Math.abs(pose.x - before.x), `${JSON.stringify(route)} stopped at ${JSON.stringify(pose)}`)
          .toBeCloseTo(5.8 / 60, 6);
        expect(pose.y).toBeCloseTo(height(pose.x, pose.z), 6);
      }
    }
  });

  it("keeps terrace edges solid while their broad approaches stay open", () => {
    for (const wall of [
      { x: 58, z: 67.7 }, { x: 58, z: 78.3 },
      { x: 81.8, z: 86 }, { x: 81.8, z: 126 },
    ]) expect(rapidPracticeCollisionCellSolid(wall.x, height(wall.x, wall.z), wall.z)).toBe(true);
    for (const route of [
      { x: 58, z: 73 }, { x: 82, z: 92.5 }, { x: 82, z: 120 },
    ]) expect(rapidPracticeCollisionCellSolid(route.x, height(route.x, route.z), route.z)).toBe(false);
  });

  it("keeps replay and dodges aligned with the town edge", () => {
    const start = { x: 95, y: 8, z: 106 };
    const dash = resolveSweptHorizontalMotion(start, { x: 20, z: 0 }, reader);
    let replay = start;
    for (let i = 0; i < 100; i++) replay = resolvePlayerMotion(replay, { x: .2, y: 0, z: 0 }, reader);
    expect(Math.abs(dash.x - replay.x)).toBeLessThan(.05);
    expect(dash.x).toBeLessThan(FAST_WORLD_TOWN_BOUNDS.maxX);
  });

  it("stops walking and dodging at every side of the visible force field", () => {
    const approaches = [
      { start: { x: 43, z: 118 }, delta: { x: -8, z: 0 }, staysInside: (x: number, _z: number) => x > 40.1 },
      { start: { x: 105, z: 106 }, delta: { x: 8, z: 0 }, staysInside: (x: number, _z: number) => x < 108.9 },
      { start: { x: 74, z: 69 }, delta: { x: 0, z: -8 }, staysInside: (_x: number, z: number) => z > 66.1 },
      { start: { x: 60, z: 143 }, delta: { x: 0, z: 8 }, staysInside: (_x: number, z: number) => z < 146.9 },
    ];
    for (const approach of approaches) for (const y of [8, 13]) {
      const start = { ...approach.start, y };
      const walk = resolvePlayerMotion(start, { ...approach.delta, y: 0 }, reader);
      const dodge = resolveSweptHorizontalMotion(start, approach.delta, reader);
      expect(approach.staysInside(walk.x, walk.z), `walk ${JSON.stringify(start)} -> ${JSON.stringify(walk)}`).toBe(true);
      expect(approach.staysInside(dodge.x, dodge.z), `dodge ${JSON.stringify(start)} -> ${JSON.stringify(dodge)}`).toBe(true);
    }
    expect(rapidPracticeCollisionCellSolid(130, 20, 106)).toBe(true);
  });

  it("keeps airborne actors airborne and grounds mobs and loot", () => {
    const airborne = resolvePlayerMotion({ x: 65, y: 12, z: 100 }, { x: .1, y: -.1, z: 0 }, reader);
    expect(airborne.y).toBeCloseTo(11.9);
    expect(airborne.grounded).toBe(false);
    const spawn = walkableMobSpawn({ x: 65, y: 8, z: 100 }, reader);
    expect(spawn.y).toBeCloseTo(height(spawn.x, spawn.z));
    const mob = moveMobSafely(spawn, { x: 2, z: 0 }, reader);
    const loot = findLootLanding(mob, { ...mob, x: mob.x + .85 }, reader);
    expect(loot.y).toBeCloseTo(height(loot.x, loot.z));
  });

  it("hits the town ground with a downward ray", () => {
    const hit = voxelRaycast({ x: 65, y: 14, z: 100 }, { x: 0, y: -1, z: 0 }, 20, reader)!;
    expect(hit.distance).toBeCloseTo(6, 3);
  });
});
