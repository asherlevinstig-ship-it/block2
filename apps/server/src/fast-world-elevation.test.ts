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

  it("keeps replay and dodges aligned with the town edge", () => {
    const start = { x: 95, y: 8, z: 106 };
    const dash = resolveSweptHorizontalMotion(start, { x: 20, z: 0 }, reader);
    let replay = start;
    for (let i = 0; i < 100; i++) replay = resolvePlayerMotion(replay, { x: .2, y: 0, z: 0 }, reader);
    expect(Math.abs(dash.x - replay.x)).toBeLessThan(.05);
    expect(dash.x).toBeLessThan(FAST_WORLD_TOWN_BOUNDS.maxX);
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
