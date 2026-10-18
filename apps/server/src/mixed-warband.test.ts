import { describe, expect, it } from "vitest";
import { warbandCrawlerYaw, warbandCrossfireSite, warbandFormationState, warbandTactic, warbandTacticStats } from "./mixed-warband.js";

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

  it("gives regions fixed tactics rather than scaling them from the party", () => {
    expect(warbandTactic("stone-brute")).toBe("surround");
    expect(warbandTactic("mistfen-behemoth")).toBe("venom-lock");
    expect(warbandTactic("south-quarrymaster")).toBe("breach");
    expect(warbandTacticStats("mistfen-behemoth").poolDurationMs).toBe(4_500);
    expect(warbandTacticStats("stone-brute").crawlerDistance).toBe(1.4);
    expect(warbandTacticStats("south-quarrymaster").poolTravelMs).toBe(850);
  });
});
