import { describe, expect, it } from "vitest";
import { defeatDuration, mobDefeatPose, lootSourceMob, lootMarkerScale } from "./mob-defeat.js";
describe("enemy defeat presentation", () => {
  it("gives the brute a delayed heavy fall and the smaller enemies distinct crumples", () => {
    expect(defeatDuration("stone_brute")).toBeGreaterThan(defeatDuration("cave_spitter"));
    expect(mobDefeatPose("stone_brute", 80).collapse).toBe(0);
    expect(mobDefeatPose("stone_brute", 800).pitch).toBeGreaterThan(40);
    expect(mobDefeatPose("cave_spitter", 600).roll).toBeGreaterThan(mobDefeatPose("moss_crawler", 500).roll);
  });
  it.each(["stone_brute", "cave_spitter", "moss_crawler"])("%s settles continuously, never scales negative, and then disappears", kind => {
    let previous = 0;
    for (let elapsed = 0; elapsed <= defeatDuration(kind); elapsed += 10) {
      const pose = mobDefeatPose(kind, elapsed);
      expect(pose.collapse).toBeGreaterThanOrEqual(previous); previous = pose.collapse;
      expect(pose.height).toBeGreaterThan(0);
    }
    expect(mobDefeatPose(kind, defeatDuration(kind)).visible).toBe(false);
    expect(mobDefeatPose(kind, 0).height).toBe(1);
  });
  it("gives the Root Guardian a longer, heavier unique collapse", () => {
    expect(defeatDuration("root_guardian")).toBeGreaterThan(defeatDuration("stone_brute"));
    const guardian = mobDefeatPose("root_guardian", 1200);
    const brute = mobDefeatPose("stone_brute", 800);
    expect(guardian.pitch).toBeGreaterThan(brute.pitch);
    expect(guardian.width).toBeGreaterThan(brute.width);
  });
  it("keeps pack IDs intact and reveals a steady, non-pulsing marker", () => {
    expect(lootSourceMob("wilds-east-pack:0:10000:2")).toBe("wilds-east-pack:0");
    expect(lootSourceMob("frontier-brute:10000:1")).toBe("frontier-brute");
    expect(lootSourceMob("recovery-bag")).toBeNull();
    expect(lootMarkerScale(1000, 1000)).toBe(.65);
    expect(lootMarkerScale(1200, 1000)).toBe(1);
    expect(lootMarkerScale(5000, 1000)).toBe(1);
  });
});
