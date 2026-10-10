import { describe, expect, it } from "vitest";
import { turnBruteAim } from "../src/brute-aim.js";
describe("deliberate brute windup tracking", () => {
  it("limits tracking to 120 degrees per second", () => {
    expect(turnBruteAim(0, 90, .033)).toBeCloseTo(3.96);
    expect(turnBruteAim(90, 0, .1)).toBe(78);
  });
  it("takes the shortest arc across wrapping and never overshoots", () => {
    expect(turnBruteAim(359, 1, .1)).toBe(361);
    expect(turnBruteAim(-359, -1, .1)).toBe(-361);
    expect(turnBruteAim(0, 2, .1)).toBe(2);
  });
  it("caps delayed simulation steps and ignores negative time", () => {
    expect(turnBruteAim(0, 90, 2)).toBe(12);
    expect(turnBruteAim(0, 90, -1)).toBe(0);
  });
});
