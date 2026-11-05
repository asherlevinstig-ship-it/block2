import { describe, expect, it } from "vitest";
import { townNpcProgressionCopy, townVictoryAnimation } from "./town-npc-progression.js";

describe("town NPC progression reactions", () => {
  it("changes every service NPC after the Crownkeeper clear", () => {
    const tower = { highestFloorCleared: 1, clearedFloors: [1] };
    expect(townNpcProgressionCopy("smith-brom", tower, false).progress).toContain("signature forging unlocked");
    expect(townNpcProgressionCopy("healer-lyra", tower, false).line).toContain("Crownkeeper");
    expect(townNpcProgressionCopy("guild-steward-elin", tower, false).line).toContain("Chronicle");
  });

  it("recognises returning visitors instead of repeating an introduction", () => {
    const tower = { highestFloorCleared: 2, clearedFloors: [1, 2] };
    expect(townNpcProgressionCopy("smith-brom", tower, true).line).toContain("Back again");
    expect(townNpcProgressionCopy("healer-lyra", tower, true).line).toContain("remember");
    expect(townNpcProgressionCopy("guild-steward-elin", tower, true).line).toContain("last visit");
  });

  it("gives each role a readable victory performance", () => {
    expect(townVictoryAnimation("resident", 1)).toBe("Cheer");
    expect(townVictoryAnimation("smith", 1)).toContain("Chop");
    expect(townVictoryAnimation("healer", 2)).toBe("Spellcasting");
    expect(townVictoryAnimation("guard", 2)).toBe("Cheer");
  });
});
