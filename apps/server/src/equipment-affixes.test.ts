import { describe, expect, it } from "vitest";
import { attunementDustCost, attunementDustYield, keepBetterAffix, parseEquipmentAffixes, parseEquipmentAffixOffers,
  rollEquipmentAffix, rollEquipmentAffixOptions } from "./equipment-affixes.js";

describe("equipment affixes", () => {
  it("favours the active Calling while retaining off-build possibilities", () => {
    expect(rollEquipmentAffix("ranger", 2, () => 0)).toEqual({ affixId: "piercing", tier: 2 });
    expect(rollEquipmentAffix("tank", 9, () => .99).tier).toBe(3);
  });
  it("keeps stronger existing rolls and sanitizes saved data", () => {
    expect(keepBetterAffix({ affixId: "fortified", tier: 3 }, { affixId: "volatile", tier: 2 })).toEqual({ affixId: "fortified", tier: 3 });
    expect(parseEquipmentAffixes({ fang_dagger: { affixId: "precise", tier: 2 }, cheat: { affixId: "bad", tier: 9 } }))
      .toEqual({ fang_dagger: { affixId: "precise", tier: 2 } });
  });
  it("creates three unique boss choices and validates stored offers", () => {
    const choices = rollEquipmentAffixOptions("mage", 3, 3, () => 0);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map(choice => choice.affixId)).size).toBe(3);
    expect(choices.every(choice => choice.tier === 3)).toBe(true);
    expect(parseEquipmentAffixOffers({ echo_prism: ["echoing", "volatile", "bad"] })).toEqual({ echo_prism: ["echoing", "volatile"] });
  });
  it("awards more dust for stronger gear and applies the Calling discount", () => {
    expect([1, 2, 3].map(attunementDustYield)).toEqual([1, 3, 6]);
    expect(attunementDustCost("reroll", 3, false)).toBe(10);
    expect(attunementDustCost("reroll", 3, true)).toBe(8);
    expect(attunementDustCost("upgrade", 2, true)).toBe(10);
  });
});
