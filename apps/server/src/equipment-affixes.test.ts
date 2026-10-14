import { describe, expect, it } from "vitest";
import { keepBetterAffix, parseEquipmentAffixes, rollEquipmentAffix } from "./equipment-affixes.js";

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
});
