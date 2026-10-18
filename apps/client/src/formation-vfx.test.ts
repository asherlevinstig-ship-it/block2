import { describe, expect, it } from "vitest";
import { formationLanePoints, formationMarkerPoints, formationRingPoints, formationTargetStyle, formationVfxStyle } from "./formation-vfx.js";

describe("formation battlefield VFX", () => {
  it("gives each authored regional tactic a distinct visual motif", () => {
    expect(formationVfxStyle("surround").motif).toBe("roots");
    expect(formationVfxStyle("venom-lock").motif).toBe("bubbles");
    expect(formationVfxStyle("breach").motif).toBe("cracks");
    const tactics = ["surround", "venom-lock", "breach"] as const;
    expect(new Set(tactics.map(tactic => formationVfxStyle(tactic).pulseHz)).size).toBe(3);
  });

  it("gives each committed enemy role a distinct compact target marker", () => {
    expect(formationTargetStyle("brute").sides).toBe(4);
    expect(formationTargetStyle("crawler").sides).toBe(3);
    expect(formationTargetStyle("spitter").sides).toBe(8);
    expect(new Set(["brute", "crawler", "spitter"].map(role =>
      formationTargetStyle(role as "brute" | "crawler" | "spitter").color.join(","))).size).toBe(3);
    expect(formationMarkerPoints({ x: 0, y: 8, z: 0 }, .4, 3)).toHaveLength(3);
  });

  it("samples readable lanes and a closed impact ring", () => {
    const lane = formationLanePoints({ x: 2, y: 8, z: 3 }, 90, 5);
    expect(lane.length).toBeGreaterThan(5);
    expect(lane.at(-1)!.x).toBeCloseTo(7);
    expect(lane.at(-1)!.z).toBeCloseTo(3);
    const ring = formationRingPoints({ x: 4, y: 8, z: 4 }, 1.3, 16);
    expect(ring).toHaveLength(16);
    for (const point of ring) expect(Math.hypot(point.x - 4, point.z - 4)).toBeCloseTo(1.3);
  });
});
