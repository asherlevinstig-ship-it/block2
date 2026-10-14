import { describe, expect, it } from "vitest";
import { GREENWOOD_DYNAMIC_EVENTS, greenwoodEventFollowers, greenwoodEventForSequence, greenwoodEventScale } from "./greenwood-events.js";

describe("Greenwood dynamic regional events", () => {
  it("rotates through migration, root nest and alpha ambush", () => {
    expect([0, 1, 2, 3].map(index => greenwoodEventForSequence(index).kind)).toEqual([
      "crawler-migration", "root-nest", "alpha-ambush", "crawler-migration",
    ]);
  });

  it("scales pressure with level and party size without uncapped mobs", () => {
    const solo = greenwoodEventScale("crawler-migration", 1, 3);
    const party = greenwoodEventScale("crawler-migration", 12, 20);
    expect(solo).toMatchObject({ players: 1, level: 3, followerCount: 2, damageBonus: 0 });
    expect(party.players).toBe(6);
    expect(party.level).toBe(20);
    expect(party.followerCount).toBe(3);
    expect(party.healthMultiplier).toBeGreaterThan(solo.healthMultiplier);
    expect(party.rewardMultiplier).toBeGreaterThan(solo.rewardMultiplier);
  });

  it("surrounds the event with the configured elite followers", () => {
    for (const event of GREENWOOD_DYNAMIC_EVENTS) {
      const followers = greenwoodEventFollowers(event.kind, event.followerCount, { x: 43.5, y: 8, z: 18.5 });
      expect(followers).toHaveLength(event.followerCount);
      expect(new Set(followers.map(follower => follower.id)).size).toBe(event.followerCount);
      expect(followers.every(follower => Math.hypot(follower.x - 43.5, follower.z - 18.5) >= 3.7)).toBe(true);
    }
  });
});
