import { describe, expect, it } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { attackRejectionReason, miningRejectionReason, movementRejectionReason, nextComboStep, selectAttackTarget } from "../src/action-rules.js";

describe("authoritative action rules", () => {
  it("accepts small movement steps and rejects teleports", () => {
    const player = { x: 8.5, y: 10, z: 8.5 };
    expect(movementRejectionReason(player, { sequence: 1, strafe: 1, forward: 0, yaw: 0 })).toBeNull();
    expect(movementRejectionReason(player, { sequence: 2, strafe: 1, forward: 1, yaw: 0 })).toBe("range");
  });

  it("rejects mining inside spawn protection", () => {
    expect(miningRejectionReason({ x: 8.5, y: 8, z: 8.5 }, { requestId: "one", expectedRevision: 0, x: 8, y: 7, z: 7 }, Block.Stone, 0)).toBe("protected");
  });

  it("rejects distant, empty, and bedrock targets", () => {
    const player = { x: 20.5, y: 8, z: 20.5 };
    expect(miningRejectionReason(player, { requestId: "far", expectedRevision: 0, x: 30, y: 7, z: 20 }, Block.Stone, 0)).toBe("range");
    expect(miningRejectionReason(player, { requestId: "air", expectedRevision: 0, x: 20, y: 7, z: 20 }, Block.Air, 0)).toBe("missing");
    expect(miningRejectionReason({ x: 20.5, y: 1.5, z: 20.5 }, { requestId: "base", expectedRevision: 0, x: 20, y: 0, z: 20 }, Block.Bedrock, 0)).toBe("missing");
  });

  it("accepts a nearby wilderness stone voxel", () => {
    const player = { x: 20.5, y: 8, z: 20.5 };
    expect(miningRejectionReason(player, { requestId: "valid", expectedRevision: 2, x: 20, y: 7, z: 19 }, Block.Stone, 2)).toBeNull();
  });

  it("rejects a mining request based on an old chunk revision", () => {
    const player = { x: 20.5, y: 8, z: 20.5 };
    expect(miningRejectionReason(player, { requestId: "stale", expectedRevision: 1, x: 20, y: 7, z: 19 }, Block.Stone, 2)).toBe("stale");
  });

  it("rate limits combat swings without blocking the next animation", () => {
    expect(attackRejectionReason(undefined, 1000)).toBeNull();
    expect(attackRejectionReason(1000, 1200)).toBe("rate");
    expect(attackRejectionReason(1000, 1300)).toBeNull();
  });

  it("advances and resets the three-hit combo inside its chain window", () => {
    expect(nextComboStep(1, 1500, 1400)).toBe(2);
    expect(nextComboStep(2, 1500, 1400)).toBe(3);
    expect(nextComboStep(3, 1500, 1400)).toBe(1);
    expect(nextComboStep(2, 1500, 1501)).toBe(1);
  });

  it("hits the nearest living mob inside the melee cone", () => {
    const targets = [
      { id: "behind", x: 8, y: 8, z: 6, alive: true },
      { id: "far", x: 8, y: 8, z: 12, alive: true },
      { id: "crawler", x: 8.5, y: 8, z: 10, alive: true },
    ];
    expect(selectAttackTarget({ x: 8, y: 8, z: 8 }, 0, targets)?.id).toBe("crawler");
    expect(selectAttackTarget({ x: 8, y: 8, z: 8 }, 180, targets)?.id).toBe("behind");
  });

  it("does not hit dead, distant, or side-on mobs", () => {
    expect(selectAttackTarget({ x: 0, y: 8, z: 0 }, 0, [
      { id: "dead", x: 0, y: 8, z: 1, alive: false },
      { id: "side", x: 2, y: 8, z: 0, alive: true },
      { id: "far", x: 0, y: 8, z: 4, alive: true },
    ])).toBeNull();
  });
});
