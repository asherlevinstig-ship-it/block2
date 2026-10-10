import { describe, expect, it } from "vitest";
import { matriarchBodyPose, matriarchRecoil } from "./matriarch-art.js";
describe("Matriarch art timing", () => {
  it("recoils at each actual volley, not between releases or for stale attacks", () => {
    expect(matriarchRecoil(-1, true)).toBe(0);
    expect(matriarchRecoil(130, true)).toBeCloseTo(1);
    expect(matriarchRecoil(400, true)).toBe(0);
    expect(matriarchRecoil(630, true)).toBeCloseTo(1);
    expect(matriarchRecoil(630, false)).toBe(0);
    expect(matriarchRecoil(1000, true)).toBe(0);
  });
  it("has a broad silhouette and a clamped flattened defeat pose", () => {
    const standing = matriarchBodyPose(0, 0), dead = matriarchBodyPose(1, 0);
    expect(standing.width).toBeGreaterThan(1.25);
    expect(standing.length).toBeGreaterThan(standing.width);
    expect(dead.height).toBeLessThan(standing.height * .4);
    expect(dead.roll).toBe(24);
    expect(matriarchBodyPose(2, 0)).toEqual(dead);
  });
});
