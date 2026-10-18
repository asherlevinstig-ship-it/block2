import { describe, expect, it } from "vitest";
import { formationLanePoints, formationRingPoints, formationVfxStyle } from "./formation-vfx.js";

describe("formation battlefield VFX", () => {
  it("gives each authored regional tactic a distinct visual motif", () => {
    expect(formationVfxStyle("surround").motif).toBe("roots");
    expect(formationVfxStyle("venom-lock").motif).toBe("bubbles");
    expect(formationVfxStyle("breach").motif).toBe("cracks");
    const tactics = ["surround", "venom-lock", "breach"] as const;
    expect(new Set(tactics.map(tactic => formationVfxStyle(tactic).pulseHz)).size).toBe(3);
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
