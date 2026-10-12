import { describe, expect, it } from "vitest";
import { EQUIPMENT_COLLECTION, collectionProgress, equipmentCollectionLabel, equipmentProgressionText, equipmentSlot } from "./equipment-progression.js";
import type { ItemId } from "@blockcraft/protocol";

describe("equipment progression", () => {
  it("classifies collection slots", () => {
    expect(equipmentSlot("matriarch_edge")).toBe("weapon");
    expect(equipmentSlot("bastion_plate")).toBe("armour");
    expect(equipmentSlot("reinforced_pickaxe")).toBe("tool");
    expect(equipmentSlot("iron_ore")).toBeNull();
  });

  it("counts only discovered collection entries", () => {
    const owned = new Map<ItemId, number>([["forged_sword", 1], ["iron_armour", 0], ["miners_lantern", 2]]);
    expect(collectionProgress(owned)).toEqual({ found: 2, total: EQUIPMENT_COLLECTION.length });
  });

  it("keeps locked rarity secret and explains the next reforge", () => {
    expect(equipmentCollectionLabel("matriarch_edge", false, 0)).toBe("UNDISCOVERED");
    expect(equipmentCollectionLabel("matriarch_edge", true, 2)).toBe("LEGENDARY · RANK II");
    expect(equipmentProgressionText("forged_sword", 0)).toContain("18 gold + 3 Iron Ore");
    expect(equipmentProgressionText("forged_sword", 3)).toContain("fully upgraded");
    expect(equipmentProgressionText("venom_focus", 2)).toContain("Venom Bloom: Three hits within 4s burst for 4 bonus damage");
  });
});
