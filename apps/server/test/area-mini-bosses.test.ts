import { describe, expect, it } from "vitest";
import { AREA_LEADER_RELIC_IDS, ITEM_DEFINITIONS } from "@blockcraft/protocol";
import { AREA_LEADER_FOLLOWERS, AREA_MINI_BOSSES, areaLeaderPattern, areaLeaderPhase, areaMainMobDefinition, areaMiniBossDefinition, isAreaMiniBoss, leaderForFollower } from "../src/area-mini-bosses.js";
import { spitterChampionShots } from "../src/frontier-champion.js";

describe("area mini-bosses", () => {
  it("assigns one unique persistent leader id per authored area", () => {
    expect(AREA_MINI_BOSSES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(AREA_MINI_BOSSES.map(boss => boss.id)).size).toBe(AREA_MINI_BOSSES.length);
    expect(AREA_MINI_BOSSES.every(boss => boss.name.length > 0)).toBe(true);
  });

  it("finds named area leaders without treating normal followers as bosses", () => {
    expect(areaMiniBossDefinition("wild-crawler")?.name).toBe("Greenwood Broodmother");
    expect(areaMiniBossDefinition("south-quarrymaster")?.name).toBe("Redstone Quarrymaster");
    expect(isAreaMiniBoss("frontier-spitter")).toBe(true);
    expect(isAreaMiniBoss("greenwood-briar")).toBe(false);
    expect(areaMainMobDefinition("frontier-brute-west")?.name).toBe("Frontier Stone Champion");
    expect(isAreaMiniBoss("frontier-brute-west")).toBe(false);
  });

  it("gives every new leader a distinctive guaranteed reward identity", () => {
    expect(AREA_MINI_BOSSES.every(definition => Boolean(definition.rewardLabel))).toBe(true);
    expect(new Set(AREA_MINI_BOSSES.map(definition => definition.rewardLabel)).size).toBe(AREA_MINI_BOSSES.length);
    expect(new Set(AREA_MINI_BOSSES.map(definition => definition.rewardItemId)).size).toBe(AREA_MINI_BOSSES.length);
    expect(AREA_MINI_BOSSES.every(definition => ITEM_DEFINITIONS[definition.rewardItemId].name.length > 0)).toBe(true);
    expect(AREA_LEADER_RELIC_IDS).toContain(areaMainMobDefinition("frontier-brute-west")!.rewardItemId);
  });

  it("gives crawler, spitter and brute leaders recognizable attack rhythms", () => {
    expect(areaLeaderPattern("moss_crawler", 3)).toBe("rush");
    expect([0, 1, 2, 3].map(sequence => areaLeaderPattern("cave_spitter", sequence))).toEqual(["aimed", "fan", "aimed", "fan"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("stone_brute", sequence))).toEqual(["rocks", "slam", "rocks"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("cave_spitter", sequence, 3))).toEqual(["venom-ring", "fan", "pool"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("stone_brute", sequence, 3))).toEqual(["warden-barrage", "smash", "rocks"]);
    expect([0, 1].map(sequence => areaLeaderPattern("moss_crawler", sequence, 3))).toEqual(["alpha-rush", "pack-rush"]);
    expect([0, 1].map(sequence => areaLeaderPattern("stone_brute", sequence, 1, "mistfen-behemoth"))).toEqual(["bog-charge", "slam"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("stone_brute", sequence, 2, "mistfen-behemoth"))).toEqual(["toxic-eruption", "bog-charge", "smash"]);
    expect([0, 1, 2].map(sequence => areaLeaderPattern("stone_brute", sequence, 3, "mistfen-behemoth"))).toEqual(["toxic-eruption", "bog-charge", "warden-barrage"]);
  });

  it("advances through a long learning phase and short final stand", () => {
    expect(areaLeaderPhase(10, 10)).toBe(1);
    expect(areaLeaderPhase(6, 10)).toBe(2);
    expect(areaLeaderPhase(3, 10)).toBe(2);
    expect(areaLeaderPhase(2, 10)).toBe(3);
    expect(areaLeaderPhase(0, 10)).toBe(3);
  });

  it("turns the final spitter phase into a readable eight-lane ring", () => {
    const shots = spitterChampionShots({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 5 }, "venom-ring");
    expect(shots).toHaveLength(8);
    expect(shots.every(shot => Math.hypot(shot.x, shot.z) > 9.9)).toBe(true);
  });

  it("links authored followers to the leader opening they create", () => {
    expect(leaderForFollower("greenwood-briar")).toBe("wild-crawler");
    expect(leaderForFollower("frontier-support-spitter")).toBe("frontier-brute-east");
    expect(leaderForFollower("mistfen-spitter")).toBe("mistfen-behemoth");
    expect(leaderForFollower("south-pit-spitter")).toBe("south-quarrymaster");
    expect(leaderForFollower("not-a-follower")).toBeNull();
    expect(Object.values(AREA_LEADER_FOLLOWERS).flat().length).toBeGreaterThan(0);
  });
});
