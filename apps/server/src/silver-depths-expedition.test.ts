import { describe, expect, it } from "vitest";
import { advanceSilverDepths, isInsideSilverDepths } from "./silver-depths-expedition.js";

describe("The Silver Depths expedition", () => {
  it("advances only the expected seven-stage sequence", () => {
    const events = ["briefed", "entered_depths", "mined_moonstone", "defeated_guards", "defeated_matriarch", "claimed_moonstone", "returned_to_blacksmith"] as const;
    let stage = 0;
    for (const event of events) stage = advanceSilverDepths(stage, event);
    expect(stage).toBe(7);
    expect(advanceSilverDepths(2, "defeated_matriarch")).toBe(2);
  });
  it("recognises only the authored deep route", () => {
    expect(isInsideSilverDepths({ x: 64, y: 1, z: 9 })).toBe(true);
    expect(isInsideSilverDepths({ x: 58, y: 1, z: 9 })).toBe(false);
    expect(isInsideSilverDepths({ x: 64, y: 8, z: 9 })).toBe(false);
  });
});
