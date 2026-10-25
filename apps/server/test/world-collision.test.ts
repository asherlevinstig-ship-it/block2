import { describe, expect, it } from "vitest";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { FAST_WORLD_COLLISION_QUERY } from "@blockcraft/protocol";
import { hasCombatLineOfSight, projectileImpact } from "../src/combat-impact.js";
import { moveMobSafely } from "../src/mob-navigation.js";
import { FAST_WORLD_BLOCK_READER, legacyCollisionReader } from "../src/world-collision.js";

describe("Fast World obstacle queries", () => {
  it("registers buildings, cliffs, trees and encounter cover explicitly", () => {
    expect(new Set(FAST_WORLD_COLLISION_QUERY.obstacles.map(obstacle => obstacle.kind)))
      .toEqual(new Set(["building", "cliff", "tree", "encounter-cover"]));
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(45, 9, 72)?.id).toBe("founders-hall");
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(118, 9, 89)?.kind).toBe("tree");
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(128, 8.7, 117)?.kind).toBe("encounter-cover");
  });

  it("blocks mob sight and projectiles behind Fast World scenery", () => {
    const treeFront = { x: 116.5, y: 8, z: 89 };
    const treeBack = { x: 119.5, y: 8, z: 89 };
    expect(hasCombatLineOfSight(treeFront, treeBack, FAST_WORLD_BLOCK_READER)).toBe(false);
    expect(projectileImpact({ x: 116.5, y: 8.72, z: 89 }, { x: 120, y: 8.72, z: 89 }, [
      { id: "player", x: 119.5, y: 8, z: 89 },
    ], FAST_WORLD_BLOCK_READER)?.kind).toBe("terrain");
  });

  it("makes Sunken Coast wrecks and rocks authoritative combat cover", () => {
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(51, 8.8, 158)?.id).toBe("coast-wreck-brine-landing");
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(67, 8.8, 162)?.id).toBe("coast-rock-shoal");
    expect(hasCombatLineOfSight({ x: 47.5, y: 8, z: 158 }, { x: 55, y: 8, z: 158 }, FAST_WORLD_BLOCK_READER)).toBe(false);
    expect(projectileImpact({ x: 47.5, y: 8.72, z: 158 }, { x: 55, y: 8.72, z: 158 }, [],
      FAST_WORLD_BLOCK_READER)?.kind).toBe("terrain");
  });

  it("makes Quarry boulders and mining supports block shots and pursuit", () => {
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(161, 8.8, 153)?.id).toBe("quarry-boulder-scree");
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(194, 9, 168)?.id).toBe("quarry-support-pit");
    expect(hasCombatLineOfSight({ x: 160, y: 8, z: 156 }, { x: 168, y: 8, z: 156 },
      FAST_WORLD_BLOCK_READER)).toBe(false);
    const moved = moveMobSafely({ x: 160, y: 8, z: 156 }, { x: 8, z: 0 }, FAST_WORLD_BLOCK_READER);
    expect(moved.x).toBeLessThan(162.1);
  });

  it("prevents mobs navigating through Fast World cover", () => {
    const start = { x: 116.5, y: 8, z: 89 };
    const moved = moveMobSafely(start, { x: 3, z: 0 }, FAST_WORLD_BLOCK_READER);
    expect(moved.x).toBeLessThan(117.6);
    expect(playerCollides(FAST_WORLD_BLOCK_READER, moved.x, moved.y, moved.z)).toBe(false);
  });

  it("preserves the archived voxel reader without Fast World scenery", () => {
    const voxel: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
    const legacy = legacyCollisionReader(voxel);
    expect(legacy(118, 9, 89)).toBe(Block.Air);
    expect(legacy(118, 0, 89)).toBe(Block.Stone);
  });
});
