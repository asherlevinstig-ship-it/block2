import { describe, expect, it } from "vitest";
import { AREA_LEADER_RELIC_IDS, ITEM_DEFINITIONS } from "@blockcraft/protocol";
import { AREA_LEADER_FOLLOWERS, AREA_MINI_BOSSES, areaLeaderPattern, areaLeaderPhase, areaMainMobDefinition, areaMiniBossDefinition, bruteLeaderArmourSegments, bruteLeaderExposureMs, crawlerPackPattern, crawlerPackRushYawOffsets, isAreaMiniBoss, isCoordinatedBruteLeader, isCoordinatedCrawlerLeader, isCoordinatedSpitterLeader, leaderForFollower, spitterPackPoolSites, spitterRingWithSafeGap } from "../src/area-mini-bosses.js";
import { spitterChampionShots } from "../src/frontier-champion.js";
import { STONE_BRUTE_ARENA_HOME, isInStoneBruteArena } from "@blockcraft/voxel-world";
import { STONE_BRUTE_ESCORTS, WILDERNESS_ENCOUNTERS, isFrontierBruteGroupMob, isStoneBruteGroupMob } from "../src/wilderness-encounters.js";

describe("area mini-bosses", () => {
  it("assigns one unique persistent leader id per authored area", () => {
    expect(AREA_MINI_BOSSES.length).toBeGreaterThanOrEqual(17);
    expect(new Set(AREA_MINI_BOSSES.map(boss => boss.id)).size).toBe(AREA_MINI_BOSSES.length);
    expect(AREA_MINI_BOSSES.every(boss => boss.name.length > 0)).toBe(true);
  });

  it("finds named area leaders without treating normal followers as bosses", () => {
    expect(areaMiniBossDefinition("wild-crawler")?.name).toBe("Greenwood Broodmother");
    expect(areaMiniBossDefinition("greenwood-elderthorn")?.name).toBe("Elderthorn Keeper");
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
    expect([0, 1, 2, 3].map(sequence => areaLeaderPattern("stone_brute", sequence, 2))).toEqual(["charge", "rocks", "smash", "slam"]);
    expect([0, 1, 2, 3].map(sequence => areaLeaderPattern("stone_brute", sequence, 3))).toEqual(["warden-barrage", "charge", "smash", "rocks"]);
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
    expect(leaderForFollower("greenwood-elderthorn-rootguard")).toBe("greenwood-elderthorn");
    expect(leaderForFollower("frontier-support-spitter")).toBe("frontier-brute-east");
    expect(leaderForFollower("mistfen-spitter")).toBe("mistfen-behemoth");
    expect(leaderForFollower("south-pit-spitter")).toBe("south-quarrymaster");
    expect(leaderForFollower("not-a-follower")).toBeNull();
    expect(Object.values(AREA_LEADER_FOLLOWERS).flat().length).toBeGreaterThan(0);
  });

  it("turns brute escorts into static breakable armour and rewards a full clear", () => {
    expect(bruteLeaderArmourSegments(3, 3)).toBe(2);
    expect(bruteLeaderArmourSegments(1, 3)).toBe(1);
    expect(bruteLeaderArmourSegments(0, 3)).toBe(0);
    expect(bruteLeaderExposureMs(1)).toBe(2_500);
    expect(bruteLeaderExposureMs(0)).toBe(4_000);
    expect(isCoordinatedBruteLeader("stone-brute")).toBe(true);
    expect(isCoordinatedBruteLeader("northwatch-watchbreaker")).toBe(false);
  });

  it("turns crawler escorts into attack lanes that disappear as the pack is defeated", () => {
    expect(isCoordinatedCrawlerLeader("wild-crawler")).toBe(true);
    expect(isCoordinatedCrawlerLeader("greenwood-elderthorn")).toBe(true);
    expect(isCoordinatedCrawlerLeader("moss-crawler")).toBe(false);
    expect(crawlerPackPattern("alpha-rush", 2)).toBe("alpha-rush");
    expect(crawlerPackPattern("alpha-rush", 1)).toBe("pack-rush");
    expect(crawlerPackPattern("pack-rush", 0)).toBe("rush");
    expect(crawlerPackRushYawOffsets(2)).toEqual([-30, 30]);
    expect(crawlerPackRushYawOffsets(3)).toEqual([-42, 0, 42]);
  });

  it("opens a visible venom-ring gap and alternates escape-cutting pools when the escort falls", () => {
    expect(isCoordinatedSpitterLeader("frontier-spitter")).toBe(true);
    expect(isCoordinatedSpitterLeader("wild-spitter-west-north")).toBe(false);
    expect(spitterRingWithSafeGap([0, 1, 2, 3, 4, 5, 6, 7], 1, 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(spitterRingWithSafeGap([0, 1, 2, 3, 4, 5, 6, 7], 0, 1)).toEqual([0, 1, 2, 5, 6, 7]);
    expect(spitterPackPoolSites({ x: 0, y: 1, z: 0 }, 0, 0)[1]!.x).toBeCloseTo(2.6);
    expect(spitterPackPoolSites({ x: 0, y: 1, z: 0 }, 0, 1)[1]!.x).toBeCloseTo(-2.6);
  });

  it("gives each overworld brute leader nearby escorts with a clear exposed window", () => {
    const homes = new Map(WILDERNESS_ENCOUNTERS.map(mob => [mob.id, mob]));
    homes.set("stone-brute", { id: "stone-brute", archetype: "stone_brute", ...STONE_BRUTE_ARENA_HOME });
    for (const escort of STONE_BRUTE_ESCORTS) homes.set(escort.id, escort);
    homes.set("frontier-crawler", { id: "frontier-crawler", archetype: "moss_crawler", x: 63.5, y: 8, z: 35.5 });
    homes.set("frontier-support-spitter", { id: "frontier-support-spitter", archetype: "cave_spitter", x: 68.5, y: 8, z: 36.5 });
    for (const id of ["stone-brute", "frontier-brute", "frontier-brute-east", "frontier-brute-west", "mistfen-behemoth", "south-quarrymaster"]) {
      const leader = homes.get(id)!;
      const followers = AREA_LEADER_FOLLOWERS[id] ?? [];
      expect(followers.length, id).toBeGreaterThanOrEqual(2);
      for (const followerId of followers) {
        const follower = homes.get(followerId)!;
        expect(follower, followerId).toBeDefined();
        expect(Math.hypot(follower.x - leader.x, follower.z - leader.z), followerId)
          .toBeLessThanOrEqual(["stone-brute", "frontier-brute", "frontier-brute-west"].includes(id) ? 6 : 10);
        expect(leaderForFollower(followerId)).toBe(id);
        if (id === "stone-brute") expect(isInStoneBruteArena(follower.x, follower.z)).toBe(true);
      }
    }
    expect(isStoneBruteGroupMob("stone-brute-spitter")).toBe(true);
    expect(isFrontierBruteGroupMob("frontier-brute-crawler")).toBe(true);
  });
});
