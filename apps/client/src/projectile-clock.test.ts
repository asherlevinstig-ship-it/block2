import { describe, expect, it } from "vitest";
import { WEAPON_ATTACK_DEFINITIONS, SPECIAL_DEFINITIONS } from "@blockcraft/protocol";
import { projectilePresentation } from "./projectile-clock.js";
describe("authoritative projectile presentation", () => {
  it.each([150, 300, 600])("matches server flight at %s ms RTT for every ranged weapon and venom fan", rtt => {
    const release = 1_000_000, offset = 999_000, arrival = 1000 + rtt / 2;
    for (const travel of [WEAPON_ATTACK_DEFINITIONS.bow.projectileTravelMs, WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.projectileTravelMs,
      WEAPON_ATTACK_DEFINITIONS.venom_focus.projectileTravelMs, SPECIAL_DEFINITIONS.venom_fan.travelMs]) {
      const shot = projectilePresentation(release, offset, arrival, travel);
      expect(shot.startedAt).toBe(1000);
      expect(shot.progress).toBe(Math.min(1, rtt / 2 / travel));
      expect(shot.expired).toBe(rtt / 2 >= travel);
    }
  });
  it("does not replay a shot received after a tab resumes", () => {
    expect(projectilePresentation(10_000, 9000, 5000, 160).expired).toBe(true);
  });
  it("supports legacy timestamps and clamps skew rather than holding a shot in the future", () => {
    expect(projectilePresentation(undefined, 9000, 1000, 160).startedAt).toBe(1000);
    expect(projectilePresentation(NaN, 9000, 1000, 160).startedAt).toBe(1000);
    expect(projectilePresentation(10_010, 9000, 1000, 160).progress).toBe(0);
  });
});
