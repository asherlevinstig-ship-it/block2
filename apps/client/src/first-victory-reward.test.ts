import { describe, expect, it } from "vitest";
import { firstVictoryCallingFit, firstVictoryItemFromDrop, firstVictoryRewardStorageKey, isFirstVictoryDrop, parseFirstVictoryReward } from "./first-victory-reward.js";

describe("first victory reward handoff", () => {
  it("recognises only the personal first-victory bag", () => {
    expect(isFirstVictoryDrop("first-victory:fang_dagger:player:123:1")).toBe(true);
    expect(firstVictoryItemFromDrop("first-victory:fang_dagger:player:123:1")).toBe("fang_dagger");
    expect(isFirstVictoryDrop("south-causeway-crawler:123:1")).toBe(false);
    expect(firstVictoryItemFromDrop("south-causeway-crawler:123:1")).toBeNull();
  });

  it("restores valid stages and rejects malformed state", () => {
    expect(parseFirstVictoryReward('{"stage":"choose","itemId":"fang_dagger"}')).toEqual({ stage: "choose", itemId: "fang_dagger" });
    expect(parseFirstVictoryReward('{"stage":"again","itemId":"fang_dagger"}')).toBeNull();
    expect(parseFirstVictoryReward("not-json")).toBeNull();
  });

  it("keeps the lesson scoped to the current character and explains Calling fit", () => {
    expect(firstVictoryRewardStorageKey("explorer-2")).toContain("explorer-2");
    expect(firstVictoryCallingFit("assassin", "Fang Dagger")).toBe(
      "Fang Dagger supports your Assassin's fast execution loop. Equip it now or keep it for later.",
    );
  });
});
