import { describe, expect, it } from "vitest";
import { forestCacheFeaturedReward, forestCacheRewardLabel } from "../src/forest-dungeon-rewards.js";

describe("Forest Dungeon replay rewards", () => {
  it("progresses through fixed equipment before repeat supplies", () => {
    const owned = new Map<string, number>();
    const reward = () => forestCacheFeaturedReward(id => owned.get(id) ?? 0);
    expect(reward()).toBe("rootbound_hammer");
    owned.set("rootbound_hammer", 1); expect(reward()).toBe("rootguard_armour");
    owned.set("rootguard_armour", 1); expect(reward()).toBe("silver_ore");
    expect(forestCacheRewardLabel(reward())).toContain("Veteran supplies");
  });
});
