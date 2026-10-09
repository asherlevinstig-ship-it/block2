import { describe, expect, it } from "vitest";
import { Block, generateChunk, getBlock, worldToChunk } from "@blockcraft/voxel-world";
import { applyWorldDeltasToChunk, parseWorldDelta, parseWorldDeltas, worldDeltaField, worldDeltaHashKey } from "../src/world-save.js";

describe("persistent world deltas", () => {
  it("preserves renewable ore deadlines and rejects corrupt deadlines", () => {
    expect(parseWorldDelta("35,7,-5", '{"block":0,"regrowAt":123000}')).toEqual({ x: 35, y: 7, z: -5, block: Block.Air, regrowAt: 123000 });
    expect(parseWorldDelta("35,7,-5", '{"block":0,"regrowAt":-1}')).toBeNull();
    expect(parseWorldDelta("35,7,-5", '{"block":200,"regrowAt":123000}')).toBeNull();
  });
  it("uses a seed-specific storage key and stable coordinate fields", () => {
    expect(worldDeltaHashKey("shared world/01")).toBe("blockcraft:world-deltas:v1:shared%20world%2F01");
    expect(worldDeltaField(-2, 7, 19)).toBe("-2,7,19");
  });

  it("parses valid edits and ignores corrupt stored values", () => {
    expect(parseWorldDelta("18,7,8", String(Block.Air))).toEqual({ x: 18, y: 7, z: 8, block: Block.Air });
    expect(parseWorldDelta("18,99,8", String(Block.Air))).toBeNull();
    expect(parseWorldDelta("bad", String(Block.Air))).toBeNull();
    expect(parseWorldDelta("18,7,8", "200")).toBeNull();
    expect(parseWorldDeltas({ "18,7,8": "0", corrupt: "5" })).toHaveLength(1);
  });

  it("reapplies only the edits belonging to a generated chunk", () => {
    const chunk = generateChunk("test-seed", 1, 0);
    const target = worldToChunk(18, 12);
    expect(getBlock(chunk, target.localX, 7, target.localZ)).not.toBe(Block.Air);
    const applied = applyWorldDeltasToChunk(chunk, [
      { x: 18, y: 7, z: 12, block: Block.Air },
      { x: -2, y: 7, z: 8, block: Block.Air },
    ]);
    expect(applied).toBe(1);
    expect(getBlock(chunk, target.localX, 7, target.localZ)).toBe(Block.Air);
  });
});
