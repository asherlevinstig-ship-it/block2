import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { miningRejectionReason, movementRejectionReason } from "../src/action-rules.js";

describe("authoritative action rules", () => {
  it("accepts small movement steps and rejects teleports", () => {
    const player = { x: 8.5, y: 10, z: 8.5 };
    expect(movementRejectionReason(player, { x: 9, y: 10, z: 8.5, yaw: 0 })).toBeNull();
    expect(movementRejectionReason(player, { x: 20, y: 10, z: 8.5, yaw: 0 })).toBe("range");
  });

  it("rejects mining inside spawn protection", () => {
    expect(miningRejectionReason({ x: 8.5, y: 8, z: 8.5 }, { requestId: "one", x: 8, y: 7, z: 7 }, Block.Stone)).toBe("protected");
  });

  it("rejects distant, empty, and bedrock targets", () => {
    const player = { x: 20.5, y: 8, z: 20.5 };
    expect(miningRejectionReason(player, { requestId: "far", x: 30, y: 7, z: 20 }, Block.Stone)).toBe("range");
    expect(miningRejectionReason(player, { requestId: "air", x: 20, y: 7, z: 20 }, Block.Air)).toBe("missing");
    expect(miningRejectionReason({ x: 20.5, y: 1.5, z: 20.5 }, { requestId: "base", x: 20, y: 0, z: 20 }, Block.Bedrock)).toBe("missing");
  });

  it("accepts a nearby wilderness stone voxel", () => {
    const player = { x: 20.5, y: 8, z: 20.5 };
    expect(miningRejectionReason(player, { requestId: "valid", x: 20, y: 7, z: 19 }, Block.Stone)).toBeNull();
  });
});
