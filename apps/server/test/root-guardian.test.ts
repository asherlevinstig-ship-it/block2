import { describe, expect, it } from "vitest";
import { guardianCoverHit, rootLaneHazards } from "../src/root-guardian.js";

describe("Root Guardian encounter", () => {
  it("creates four readable lanes while leaving diagonal safe gaps", () => {
    const roots = rootLaneHazards({ x: 187.5, y: 8, z: 165.5 });
    expect(roots).toHaveLength(12);
    expect(roots.filter(root => root.x === 187.5)).toHaveLength(6);
    expect(roots.filter(root => root.z === 165.5)).toHaveLength(6);
    expect(roots.some(root => root.x !== 187.5 && root.z !== 165.5)).toBe(false);
  });

  it("only selects authored room-three cover crossed by a charge", () => {
    expect(guardianCoverHit({ x: 187.5, y: 8, z: 165.5 }, -149, 6.5)?.x).toBe(184);
    expect(guardianCoverHit({ x: 187.5, y: 8, z: 165.5 }, 0, 4)).toBeNull();
  });
});
