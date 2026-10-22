import { describe, expect, it } from "vitest";
import { REGIONAL_PACK_DISRUPTION_MS, regionalPackCooldownMultiplier, regionalPackCue,
  regionalPackGoal, regionalPackSpeedMultiplier } from "../src/regional-pack-tactics.js";

const target = { x: 10, y: 8, z: 10 };
const leader = { x: 10, y: 8, z: 0 };

describe("static regional roaming-pack tactics", () => {
  it("gives each region a distinct fixed combat role", () => {
    expect(regionalPackCue("greenwood-south-pack", "moss_crawler", 1)).toBe("FLANKING");
    expect(regionalPackCue("mistfen-south-pack", "fen_bloater", 0)).toBe("BLOCKING ESCAPE");
    expect(regionalPackCue("northwatch-ascent-pack", "ridge_stalker", 0)).toBe("HOLDING PASS");
    expect(regionalPackCue("northwatch-ascent-pack", "shard_sentry", 1)).toBe("COVERING FIRE");
    expect(regionalPackCue("stoneheart-east-pack", "cave_spitter", 1)).toBe("COVERING FIRE");
    expect(regionalPackCue("ashen-west-pack", "ember_hound", 1)).toBe("PINCER RUSH");
    expect(regionalPackCue("outskirts-west-pack", "moss_crawler", 0)).toBeNull();
  });

  it("places flankers on opposite sides and ranged support behind the pressure line", () => {
    const west = regionalPackGoal("greenwood-south-pack", "moss_crawler", 1, target, leader)!;
    const east = regionalPackGoal("greenwood-south-pack", "briar_crawler", 2, target, leader)!;
    expect((west.x - target.x) * (east.x - target.x)).toBeLessThan(0);
    const support = regionalPackGoal("stoneheart-east-pack", "cave_spitter", 1, target, leader)!;
    expect(support.z).toBeLessThan(target.z - 4);
    const blocker = regionalPackGoal("mistfen-south-pack", "fen_bloater", 0, target, leader)!;
    expect(blocker.z).toBeGreaterThan(target.z);
  });

  it("briefly slows and delays followers after their veteran falls", () => {
    expect(REGIONAL_PACK_DISRUPTION_MS).toBe(3_500);
    expect(regionalPackSpeedMultiplier("ashen-west-pack", "ember_hound", true)).toBeLessThan(1);
    expect(regionalPackCooldownMultiplier(true)).toBeGreaterThan(1);
    expect(regionalPackSpeedMultiplier("ashen-west-pack", "ember_hound", false)).toBeGreaterThan(1);
  });
});
