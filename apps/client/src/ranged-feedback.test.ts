import { describe, expect, it } from "vitest";
import { confirmedRangedHit, projectileImpactCue } from "./ranged-feedback.js";
describe("ranged hit feedback", () => {
  it("confirms only local ranged damage, never firing, misses or blocked damage", () => {
    expect(confirmedRangedHit("venom_focus", 2, true)).toBe(true);
    expect(confirmedRangedHit("bow", 1, true)).toBe(true);
    expect(confirmedRangedHit("venom_focus", 0, true)).toBe(false);
    expect(confirmedRangedHit("venom_focus", 2, false)).toBe(false);
    expect(confirmedRangedHit("longsword", 2, true)).toBe(false);
  });
  it("distinguishes enemy and terrain impacts without treating enemy shots as player shots", () => {
    expect(projectileImpactCue("weapon:a:1", "hit")).toBe("enemy");
    expect(projectileImpactCue("venom:a:2", "terrain")).toBe("terrain");
    expect(projectileImpactCue("weapon:a:3", "miss")).toBeNull();
    expect(projectileImpactCue("cave-spitter:1", "hit")).toBeNull();
  });
});
