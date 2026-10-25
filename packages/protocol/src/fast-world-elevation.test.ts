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

  it("slopes below the shared waterline beyond the beach without flooding the road", () => {
    const shoreline = fastWorldCoastShorelineZ(66);
    expect(fastWorldGroundHeight(66, shoreline + 7)).toBeLessThan(fastWorldGroundHeight(66, shoreline));
    expect(fastWorldGroundHeight(100, 170)).toBeCloseTo(8, 4);
  });
});
