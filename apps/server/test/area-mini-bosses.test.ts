import { describe, expect, it } from "vitest";
import { AREA_LEADER_FOLLOWERS, AREA_MINI_BOSSES, areaLeaderPattern, areaMainMobDefinition, areaMiniBossDefinition, isAreaMiniBoss, leaderForFollower } from "../src/area-mini-bosses.js";

describe("area mini-bosses", () => {
  it("assigns one unique persistent leader id per authored area", () => {
    expect(AREA_MINI_BOSSES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(AREA_MINI_BOSSES.map(boss => boss.id)).size).toBe(AREA_MINI_BOSSES.length);
    expect(AREA_MINI_BOSSES.every(boss => boss.name.length > 0)).toBe(true);
  });

  it("finds named area leaders without treating normal followers as bosses", () => {
    expect(areaMiniBossDefinition("wild-crawler")?.name).toBe("Greenwood Broodmother");
    expect(isAreaMiniBoss("frontier-spitter")).toBe(true);
    expect(isAreaMiniBoss("greenwood-briar")).toBe(false);
    expect(areaMainMobDefinition("frontier-brute-west")?.name).toBe("Frontier Stone Champion");
    expect(isAreaMiniBoss("frontier-brute-west")).toBe(false);
  });

  it("gives every new leader a distinctive guaranteed reward identity", () => {
    expect(AREA_MINI_BOSSES.every(definition => Boolean(definition.rewardLabel))).toBe(true);
    expect(new Set(AREA_MINI_BOSSES.map(definition => definition.rewardLabel)).size).toBe(AREA_MINI_BOSSES.length);
  });

  it("gives crawler, spitter and brute leaders recognizable attack rhythms", () => {
    expect(areaLeaderPattern("moss_crawler", 3)).toBe("rush");
    expect([0, 1, 2, 3].map(sequence => areaLeaderPattern("cave_spitter", sequence))).toEqual(["fan", "pool", "aimed", "fan"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("stone_brute", sequence))).toEqual(["rocks", "slam", "rocks"]);
  });

  it("links authored followers to the leader opening they create", () => {
    expect(leaderForFollower("greenwood-briar")).toBe("wild-crawler");
    expect(leaderForFollower("frontier-support-spitter")).toBe("frontier-brute-east");
    expect(leaderForFollower("not-a-follower")).toBeNull();
    expect(Object.values(AREA_LEADER_FOLLOWERS).flat().length).toBeGreaterThan(0);
  });
});
