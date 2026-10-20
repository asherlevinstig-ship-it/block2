import { describe, expect, it } from "vitest";
import { GREENWOOD_DYNAMIC_EVENTS, greenwoodEventFollowers, greenwoodEventForSequence, greenwoodEventScale } from "./greenwood-events.js";

describe("Greenwood dynamic regional events", () => {
  it("rotates through migration, root nest and alpha ambush", () => {
    expect([0, 1, 2, 3].map(index => greenwoodEventForSequence(index).kind)).toEqual([
      "crawler-migration", "root-nest", "alpha-ambush", "crawler-migration",
    ]);
  });

  it("uses a fixed Greenwood profile instead of scaling to the arriving party", () => {
    expect(greenwoodEventScale("crawler-migration")).toMatchObject({
      players: 2, level: 4, followerCount: 2, healthMultiplier: 1, damageBonus: 0, rewardMultiplier: 1,
    });
    expect(greenwoodEventScale("alpha-ambush").followerCount).toBe(4);
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
