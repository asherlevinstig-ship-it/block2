import { describe, expect, it } from "vitest";
import { callingLevelGuide, statChoiceDisabled } from "./progression-guidance.js";

describe("level-up guidance", () => {
  it("keeps earned points selectable after a pending request resolves", () => {
    expect(statChoiceDisabled(2, 0, false, 5)).toBe(false);
    expect(statChoiceDisabled(2, 0, true, 5)).toBe(true);
    expect(statChoiceDisabled(2, 5, false, 5)).toBe(true);
    expect(statChoiceDisabled(0, 0, false, 5)).toBe(true);
  });

  it("explains that level six abilities require a Calling, not a stat point", () => {
    expect(callingLevelGuide(6, null, true)).toContain("Choose a Calling below");
    expect(callingLevelGuide(6, null, false)).toContain("Choose a Calling in Town");
    expect(callingLevelGuide(6, { name: "Mage", power: "Arcane Surge", special: "Mana Shield" }, true))
      .toContain("G: Arcane Surge · F: Mana Shield");
  });
});
