import { describe, expect, it } from "vitest";
import { buildPathAffinities, buildPathRank, chooseBuildPath, chooseBuildSpecialization, effectiveBuildPathRank, grantBuildPathXp, grantMasterTrialProgress, parseBuildPathState } from "./build-paths.js";

describe("hidden build paths", () => {
  it("reveals affinities from durable build choices", () => {
    const candidates = buildPathAffinities({ mainHandId: "magic_focus", armourId: "none", equippedTrait: "momentum",
      equippedSpecial: "hunters_mark", powerPoints: 3, vitalityPoints: 0, agilityPoints: 1 });
    expect(candidates[0]?.pathId).toBe("mage");
    expect(candidates[0]?.reasons).toContain("focus weapon");
  });
  it("retains progress and ranks up the selected path", () => {
    const selected = chooseBuildPath(parseBuildPathState("{}"), "tank");
    const result = grantBuildPathXp(selected, 10);
    expect(result.rankUp).toBe(true); expect(buildPathRank(result.state.xp.tank ?? 0)).toBe(1);
  });
  it("sanitizes malformed saved state", () => {
    expect(parseBuildPathState({ selectedPathId: "cheat", xp: { mage: 14.9, tank: -2 } })).toEqual({ selectedPathId: null, xp: { mage: 14 }, specializations: {}, trials: {}, mastered: [] });
  });
  it("binds one matching specialization after Veteran rank", () => {
    const veteran = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "ranger"), 70).state;
    const specialized = chooseBuildSpecialization(veteran, "ranger", "trapper");
    expect(specialized.specializations.ranger).toBe("trapper");
    expect(chooseBuildSpecialization(specialized, "ranger", "marksman")).toBe(specialized);
    expect(chooseBuildSpecialization(veteran, "ranger", "guardian")).toBe(veteran);
  });
  it("gates Master rank behind the matching specialization trial", () => {
    let state = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "mage"), 140).state;
    state = chooseBuildSpecialization(state, "mage", "arcanist");
    expect(effectiveBuildPathRank(state, "mage")).toBe(3);
    state = grantMasterTrialProgress(state, "arcanist", 15).state;
    expect(state.mastered).toContain("arcanist");
    expect(effectiveBuildPathRank(state, "mage")).toBe(4);
  });
});
