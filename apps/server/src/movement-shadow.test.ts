import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { stepShadowMovement } from "./movement-shadow.js";

const floor = (_x: number, y: number, _z: number) => y < 1 ? Block.Stone : Block.Air;

describe("development movement shadow", () => {
  it("uses the real voxel collision solver and a fixed movement step", () => {
    const start = { x: 4.5, y: 1, z: 4.5, verticalVelocity: 0 };
    const moved = stepShadowMovement(start, { strafe: 1, forward: 0 }, 4.2, 1 / 30, floor);
    expect(moved.x).toBeCloseTo(4.64, 3);
    expect(moved.y).toBeGreaterThan(0.9);
    const stopped = stepShadowMovement(moved, { strafe: 0, forward: 0 }, 4.2, 1 / 30, floor);
    expect(stopped.x).toBeCloseTo(moved.x, 3);
  });

  it("cannot pass through a solid block", () => {
    const wall = (x: number, y: number, z: number) => x >= 5 && y >= 1 && z >= 4 ? Block.Stone : floor(x, y, z);
    let pose = { x: 4.4, y: 1, z: 4.5, verticalVelocity: 0 };
    for (let i = 0; i < 20; i += 1) pose = stepShadowMovement(pose, { strafe: 1, forward: 0 }, 4.2, 1 / 30, wall);
    expect(pose.x).toBeLessThan(5);
  });
});
