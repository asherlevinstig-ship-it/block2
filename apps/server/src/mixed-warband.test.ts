import { describe, expect, it } from "vitest";
import { warbandCrawlerYaw, warbandCrossfireSite, warbandFormationState } from "./mixed-warband.js";

describe("mixed warband formation", () => {
  it("alternates its two escape lanes while preserving fixed distances", () => {
    expect(warbandCrawlerYaw(90, 0)).toBe(128);
    expect(warbandCrawlerYaw(90, 1)).toBe(52);
    const first = warbandCrossfireSite({ x: 5, y: 8, z: 5 }, 90, 0);
    const second = warbandCrossfireSite({ x: 5, y: 8, z: 5 }, 90, 1);
    expect(Math.hypot(first.x - 5, first.z - 5)).toBeCloseTo(2.8);
    expect((first.z - 5) * (second.z - 5)).toBeLessThan(0);
    expect(warbandFormationState(false, false)).toBeNull();
  });
});
