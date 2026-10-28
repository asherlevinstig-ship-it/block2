import { describe, expect, it } from "vitest";
import { crownkeeperAttackCue, crownkeeperCounterDuration } from "./crownkeeper-combat.js";
import { towerFloorOneCrownkeeperPattern } from "./tower-floor-one.js";

describe("Crownkeeper counter contract", () => {
  it.each([
    ["smash", "strike", "parry", 2000], ["slam", "windup", "interrupt", 2500],
    ["charge", "strike", "evade", 2500], ["charge", "recover", "guard", 3500],
  ] as const)("%s rewards its intended response", (pattern, state, response, duration) => {
    expect(crownkeeperCounterDuration(pattern, state, response)).toBe(duration);
  });
  it.each([
    ["slam", "strike", "interrupt"], ["smash", "windup", "parry"], ["rocks", "recover", "parry"],
    ["warden-barrage", "strike", "interrupt"], ["charge", "idle", "guard"], ["smash", "stagger", "parry"],
  ] as const)("does not award an opening for %s in %s", (pattern, state, response) => {
    expect(crownkeeperCounterDuration(pattern, state, response)).toBe(0);
  });
  it("explains the right response and includes keyboard hints only for keyboard players", () => {
    expect(crownkeeperAttackCue("smash", "windup").label).toContain("PARRY [C]");
    expect(crownkeeperAttackCue("slam", "windup").label).toContain("INTERRUPT");
    expect(crownkeeperAttackCue("slam", "strike").label).not.toContain("INTERRUPT");
    expect(crownkeeperAttackCue("charge", "windup").label).toContain("SPACE / C");
    expect(crownkeeperAttackCue("warden-barrage", "windup", true).label).toContain("FIND GAPS");
    expect(crownkeeperAttackCue("smash", "windup", true).label).not.toContain("[C]");
    expect(crownkeeperAttackCue("slam", "recover").response).toBe("none");
  });
  it("keeps all phases deterministic, with a cleave counter in every phase", () => {
    for (const phase of [1, 2, 3] as const) {
      const rotation = Array.from({ length: 4 }, (_, index) => towerFloorOneCrownkeeperPattern(index, phase));
      expect(rotation).toContain("smash");
      expect(Array.from({ length: 4 }, (_, index) => towerFloorOneCrownkeeperPattern(index + 4, phase))).toEqual(rotation);
    }
  });
});
