import { describe, expect, it } from "vitest";
import { aimedSupportScore, healerGrace, intercessionImpact, isPerfectHealing } from "./healer-combat.js";

describe("Vitalis healer combat", () => {
  it("caps Grace and never permits a negative resource", () => {
    expect(healerGrace(2, 2)).toBe(3);
    expect(healerGrace(1, -4)).toBe(0);
  });

  it("recognises useful healing inside the damage-response window", () => {
    expect(isPerfectHealing(11_250, 11_000, 2)).toBe(true);
    expect(isPerfectHealing(11_250, 11_300, 2)).toBe(false);
    expect(isPerfectHealing(11_250, 11_000, 0)).toBe(false);
  });

  it("rewards a precisely timed Intercession without erasing the whole hit", () => {
    expect(intercessionImpact(5, 10_000, 10_700, 3)).toEqual({ prevented: 3, damage: 2, perfect: true });
    expect(intercessionImpact(5, 10_000, 11_200, 2)).toEqual({ prevented: 2, damage: 3, perfect: false });
  });

  it("scores the ally under the crosshair above an off-angle ally", () => {
    expect(aimedSupportScore({ x: 0, z: 0 }, { x: 0, z: 5 }, 0)).toBeCloseTo(1);
    expect(aimedSupportScore({ x: 0, z: 0 }, { x: 5, z: 0 }, 0)).toBeCloseTo(0);
  });
});
