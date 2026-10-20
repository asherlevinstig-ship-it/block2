import { describe, expect, it } from "vitest";
import { REGIONAL_PACK_SWIFT_CLEAR_MS, regionalPackRewardDefeat, regionalPackRewardItems,
  regionalPackRewardNotice } from "../src/regional-pack-rewards.js";

describe("regional roaming-pack rewards", () => {
  it("rewards a veteran-first formation break and preserves the timed cycle", () => {
    const result = regionalPackRewardDefeat("greenwood-south-pack", true, 2, 10_000, undefined);
    expect(result.rewards).toEqual(["veteran", "formation-break"]);
    expect(result.cycle).toEqual({ firstDefeatedAt: 10_000, veteranFirst: true });
    expect(regionalPackRewardItems("greenwood-south-pack", result.rewards)).toEqual([
      { itemId: "moss_fibre", quantity: 2 }, { itemId: "crawler_fang", quantity: 1 },
      { itemId: "moss_fibre", quantity: 1 },
    ]);
  });

  it("does not award formation break when a follower falls first", () => {
    const follower = regionalPackRewardDefeat("mistfen-west-pack", false, 2, 10_000, undefined);
    const veteran = regionalPackRewardDefeat("mistfen-west-pack", true, 1, 12_000, follower.cycle!);
    expect(veteran.rewards).toEqual(["veteran"]);
    expect(regionalPackRewardItems("mistfen-west-pack", veteran.rewards)).toContainEqual(
      { itemId: "acid_gland", quantity: 2 });
  });

  it("adds a better personal reward for a complete clear inside twenty seconds", () => {
    const result = regionalPackRewardDefeat("ashen-east-pack", false, 0,
      10_000 + REGIONAL_PACK_SWIFT_CLEAR_MS, { firstDefeatedAt: 10_000, veteranFirst: true });
    expect(result.cycle).toBeNull();
    expect(result.rewards).toEqual(["swift-clear"]);
    expect(regionalPackRewardItems("ashen-east-pack", result.rewards)).toEqual([
      { itemId: "ember_ore", quantity: 2 }, { itemId: "healing_potion", quantity: 1 },
    ]);
    expect(regionalPackRewardNotice("Ashen Furnace Patrol", result.rewards)).toContain("SWIFT PACK CLEAR");
  });

  it("gives no swift bonus after the fixed window and ignores legacy roaming packs", () => {
    const late = regionalPackRewardDefeat("stoneheart-west-pack", false, 0,
      10_001 + REGIONAL_PACK_SWIFT_CLEAR_MS, { firstDefeatedAt: 10_000, veteranFirst: true });
    expect(late.rewards).toEqual([]);
    expect(regionalPackRewardDefeat("outskirts-west-pack", true, 2, 10_000, undefined).rewards).toEqual([]);
  });
});
