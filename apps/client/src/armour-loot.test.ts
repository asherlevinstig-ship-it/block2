import { describe, expect, it } from "vitest";
import { armourForItem, isEquipmentItem, equipmentForItem } from "@blockcraft/protocol";
import { armourComparison } from "./loot-comparison.js";
describe("armour loot comparisons", () => {
  it("recognizes armour as inspectable equipment, not a weapon", () => {
    for (const id of ["leather_armour", "iron_armour"]) {
      expect(armourForItem(id)).toBe(id); expect(isEquipmentItem(id)).toBe(true); expect(equipmentForItem(id)).toBeNull();
    }
    expect(isEquipmentItem("fang_dagger")).toBe(true);
    for (const id of ["none", "iron_ore", "unknown", "toString"]) expect(isEquipmentItem(id)).toBe(false);
  });
  it("compares protection and movement against the armour slot, including no armour", () => {
    expect(armourComparison("none")).toMatchObject({ reduction: "0 damage", speed: "100%" });
    expect(armourComparison("leather_armour")).toMatchObject({ reduction: "1 damage", speed: "100%" });
    expect(armourComparison("iron_armour")).toMatchObject({ reduction: "2 damage", speed: "92%", minimum: "1 damage per hit" });
  });
});
