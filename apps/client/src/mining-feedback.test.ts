import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { miningAvailability, miningProgress, miningReach, miningDurationMs, MINING_WINDUP_MS } from "./mining-feedback.js";
describe("mining presentation", () => {
  it("keeps mineral timing consistent and silver harder than iron", () => {
    expect(miningDurationMs(Block.SilverOre)).toBe(1200);
    expect(miningDurationMs(Block.IronOre)).toBe(850);
    expect(miningDurationMs(Block.Stone)).toBe(600);
    expect(miningDurationMs(Block.Dirt)).toBe(300);
    expect(miningProgress(1000, 1600, miningDurationMs(Block.SilverOre))).toBe(0.5);
    expect(miningProgress(1000, 2200, miningDurationMs(Block.SilverOre))).toBe(1);
  });
  const cell = { x: 35, y: 7, z: -5, block: Block.IronOre };
  it("uses three-dimensional reach, including vertical separation", () => {
    expect(miningReach({ x: 35.5, y: 7.5, z: -4.5 }, cell)).toBe(0);
    expect(miningAvailability({ x: 35.5, y: 2, z: -4.5 }, cell)).toBe("far");
    expect(miningAvailability({ x: 35.5, y: 8, z: -4.5 }, cell)).toBe("ready");
  });
  it("distinguishes protected town blocks and unbreakable bedrock", () => {
    expect(miningAvailability({ x: 8.5, y: 8, z: 8.5 }, { ...cell, x: 8, z: 8 })).toBe("protected");
    expect(miningAvailability({ x: 35.5, y: 8, z: -4.5 }, { ...cell, block: Block.Bedrock })).toBe("unbreakable");
  });
  it("fills exactly once and clamps frame stalls and early samples", () => {
    expect(miningProgress(1000, 900)).toBe(0);
    expect(miningProgress(1000, 1000 + MINING_WINDUP_MS / 2)).toBe(0.5);
    expect(miningProgress(1000, 1000 + MINING_WINDUP_MS)).toBe(1);
    expect(miningProgress(1000, 9000)).toBe(1);
  });
});
