import { describe, expect, it } from "vitest";
import { floorDefeatTip, type FloorAttemptSummary } from "@blockcraft/protocol";
import { floorAttemptSummaryCopy } from "./floor-attempt-summary.js";
const summary: FloorAttemptSummary = {
  id: "one", floor: 1, calling: "assassin", wardensDefeated: 2, picked: ["assassin_flank", "assassin_cloak"], unusedChoices: 0,
  boss: { health: 12, maxHealth: 52 }, kept: { level: 5, experience: 19, gold: 44, crownFragments: 3 },
  cause: { name: "The Crownkeeper", pattern: "smash", kind: "melee" }, tip: floorDefeatTip("smash", "melee"),
};
describe("compact defeat summary copy", () => {
  it("names the actual chosen upgrades and preserved progress", () => {
    const copy = floorAttemptSummaryCopy(summary);
    expect(copy.upgrades).toBe("Backstab + Patient Shadow"); expect(copy.boss).toContain("12/52 HP remaining");
    expect(copy.kept).toContain("44 gold"); expect(copy.kept).toContain("3 Crown Fragments");
    expect(copy.log).toContain("2/2 Warden victories"); expect(copy.log).toContain("kept");
  });
  it("handles early death, unused choices and last-seen boss information", () => {
    const copy = floorAttemptSummaryCopy({ ...summary, picked: [], unusedChoices: 1, boss: null });
    expect(copy.boss).toContain("not reached"); expect(copy.upgrades).toBe("No Warden upgrades chosen"); expect(copy.unused).toBe("1 unused choice");
    expect(floorAttemptSummaryCopy({ ...summary, boss: { health: 25, maxHealth: 52, lastSeen: true } }).boss).toContain("last seen");
    expect(floorAttemptSummaryCopy({ ...summary, boss: { health: 0, maxHealth: 52 } }).boss).toContain("defeated");
  });
  it("handles maximum level without showing a misleading 0/0 XP bar", () => {
    const copy = floorAttemptSummaryCopy({ ...summary, kept: { ...summary.kept, level: 20, experience: 0, crownFragments: 1 } });
    expect(copy.kept).toContain("MAX LEVEL"); expect(copy.kept).not.toContain("/0"); expect(copy.kept).toContain("1 Crown Fragment");
  });
  it.each(["smash", "slam", "charge", "rocks", "warden-barrage", "venom-ring", "unknown"])("offers one actionable tip for %s", pattern => {
    const tip = floorDefeatTip(pattern, pattern === "rocks" ? "projectile" : "melee");
    expect(tip.length).toBeGreaterThan(20); expect(tip.length).toBeLessThan(150);
    expect(tip).not.toContain("[C]"); expect(tip).not.toContain("[SPACE]");
  });
});
