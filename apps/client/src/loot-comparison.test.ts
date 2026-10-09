import { describe, expect, it } from "vitest";
import { equipmentForItem, WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";
import { weaponComparison } from "./loot-comparison.js";
describe("equipment loot comparisons", () => {
  it("includes the forged sword damage bonus without applying it to dropped weapons", () => {
    expect(weaponComparison("longsword", true)).toMatchObject({ name: "Iron Sword", damage: "2 / 2 / 3" });
    expect(weaponComparison("fang_dagger", true).damage).toBe("1 / 1 / 2");
  });
  it("recognises only owned-item weapons as inspectable equipment", () => {
    expect(equipmentForItem("fang_dagger")).toBe("fang_dagger");
    expect(equipmentForItem("stone_core_hammer")).toBe("stone_core_hammer");
    expect(equipmentForItem("acid_gland_focus")).toBe("acid_gland_focus");
    for (const item of ["moss_fibre", "longsword", "reinforced_pickaxe", "unknown", "toString"]) expect(equipmentForItem(item)).toBeNull();
  });
  it("uses real attack data instead of arbitrary rarity or power ratings", () => {
    for (const id of ["longsword", "bow", "magic_focus", "fang_dagger", "stone_core_hammer", "acid_gland_focus"] as const) {
      const stats = weaponComparison(id); const weapon = WEAPON_ATTACK_DEFINITIONS[id];
      expect(stats.damage).toBe(weapon.attacks.map(step => step.damage).join(" / "));
      expect(stats.speed).toBe(`${weapon.attacks[0].durationMs} ms`);
      expect(stats.range).toBe(`${weapon.range.toFixed(2)} blocks`);
    }
  });
});
