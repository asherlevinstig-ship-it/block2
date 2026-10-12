import { describe, expect, it } from "vitest";
import { armouredDamage, reforgeArmourReduction, reforgeWeaponDamageBonus } from "@blockcraft/protocol";
import { equipmentReforgeRank, parseReforgeRanks, serializeReforgeRanks, withReforgeRank } from "./equipment-reforge.js";

describe("equipment reforge ranks", () => {
  it("keeps only valid equipment ranks and clamps them to rank III", () => {
    expect(parseReforgeRanks({ fang_dagger: 2, iron_armour: 8, bogus: 3, forged_sword: -1 }))
      .toEqual({ fang_dagger: 2, iron_armour: 3 });
  });

  it("updates one equipment rank without disturbing the others", () => {
    const ranks = withReforgeRank('{"fang_dagger":1}', "iron_armour", 2);
    expect(equipmentReforgeRank(ranks, "fang_dagger")).toBe(1);
    expect(equipmentReforgeRank(ranks, "iron_armour")).toBe(2);
    expect(serializeReforgeRanks(parseReforgeRanks(ranks))).toBe(ranks);
  });

  it("provides deterministic combat bonuses at every rank", () => {
    expect([0, 1, 2, 3].map(reforgeWeaponDamageBonus)).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map(reforgeArmourReduction)).toEqual([0, 1, 1, 2]);
    expect(armouredDamage(6, "leather_armour", "melee", 3)).toBe(3);
  });
});
