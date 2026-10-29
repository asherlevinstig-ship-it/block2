import { describe, expect, it } from "vitest";
import { fastWorldCoastShorelineZ, fastWorldGroundHeight } from "./fast-world-elevation.js";

describe("fast world elevation", () => {
  it("gives Sunken Coast readable dunes and a falling shoreline", () => {
    expect(fastWorldGroundHeight(75, 153)).toBeGreaterThan(8.5);
    expect(fastWorldGroundHeight(66, 187)).toBeLessThan(7.8);
    expect(fastWorldGroundHeight(70.5, 174.5)).toBeCloseTo(8, 4);
  });

  it("keeps unrelated open ground at the shared baseline", () => {
    expect(fastWorldGroundHeight(145, 130)).toBe(8);
  });

  it("authors three readable Town of Beginnings elevations", () => {
    expect(fastWorldGroundHeight(46.5, 73)).toBeCloseTo(9.45, 2);
    expect(fastWorldGroundHeight(67, 106)).toBe(8);
    expect(fastWorldGroundHeight(99, 92)).toBeCloseTo(7.28, 2);
    expect(fastWorldGroundHeight(99, 120)).toBeCloseTo(7.28, 2);
    expect(fastWorldGroundHeight(99.5, 106.5)).toBe(8);
  });

  it("feathers Town terraces into traversable ramps", () => {
    const founders = [52, 54, 56, 58, 60, 62, 64, 66].map(x => fastWorldGroundHeight(x, 73));
    const northMarket = [76, 78, 80, 82, 84, 86, 88].map(x => fastWorldGroundHeight(x, 92));
    for (const samples of [founders, northMarket]) for (let index = 1; index < samples.length; index++)
      expect(Math.abs(samples[index]! - samples[index - 1]!)).toBeLessThan(.45);
  });

  it("slopes below the shared waterline beyond the beach without flooding the road", () => {
    const shoreline = fastWorldCoastShorelineZ(66);
    expect(fastWorldGroundHeight(66, shoreline + 7)).toBeLessThan(fastWorldGroundHeight(66, shoreline));
    expect(fastWorldGroundHeight(100, 170)).toBeCloseTo(8, 4);
  });
});
