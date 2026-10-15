import { describe, expect, it } from "vitest";
import { buildPathAffinities, buildPathRank, chooseBuildPath, chooseBuildSpecialization, chooseCallingAbility, chooseCallingAugment, effectiveBuildPathRank, grantBuildPathXp, grantCallingAugmentProgress, grantMasterTrialProgress, parseBuildPathState, selectedCallingAbility, selectedCallingAugment } from "./build-paths.js";

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
    expect(parseBuildPathState({ selectedPathId: "cheat", xp: { mage: 14.9, tank: -2 } })).toEqual({ selectedPathId: null, xp: { mage: 14 }, specializations: {}, callingAbilities: {}, callingAugments: {}, callingAugmentProgress: {}, masteredCallingAugments: [], trials: {}, mastered: [] });
  });
  it("persists one rank-gated branch upgrade for an equipped ability", () => {
    const adept = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "tank"), 30).state;
    const mastered = grantCallingAugmentProgress(adept, "bulwark_iron_skin", 24).state;
    const upgraded = chooseCallingAugment(mastered, "tank_bulwark", "bulwark_iron_skin");
    expect(selectedCallingAugment(upgraded, "tank_bulwark")).toBe("bulwark_iron_skin");
    expect(parseBuildPathState(JSON.stringify(upgraded)).callingAugments.tank_bulwark).toBe("bulwark_iron_skin");
    expect(upgraded.masteredCallingAugments).toContain("bulwark_iron_skin");
    expect(chooseCallingAugment(parseBuildPathState("{}"), "tank_bulwark", "bulwark_iron_skin")).toEqual(parseBuildPathState("{}"));
  });
  it("persists one rank-gated Calling ability per path", () => {
    let state = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "tank"), 30).state;
    state = chooseCallingAbility(state, "tank", "tank_challenge");
    expect(selectedCallingAbility(state, "tank")).toBe("tank_challenge");
    expect(parseBuildPathState(JSON.stringify(state)).callingAbilities.tank).toBe("tank_challenge");
    expect(chooseCallingAbility(state, "tank", "tank_earthbreaker")).toBe(state);
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
