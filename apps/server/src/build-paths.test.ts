import { describe, expect, it } from "vitest";
import { buildPathAffinities, buildPathRank, chooseBuildPath, grantBuildPathXp, parseBuildPathState } from "./build-paths.js";

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
    expect(parseBuildPathState({ selectedPathId: "cheat", xp: { mage: 14.9, tank: -2 } })).toEqual({ selectedPathId: null, xp: { mage: 14 } });
  });
});
