import { describe, expect, it } from "vitest";
import { EQUIPMENT_RARITY, ITEM_RARITIES, itemRarity } from "@blockcraft/protocol";

describe("fixed equipment rarity", () => {
  it("gives every equipment rarity definition a valid ordered tier", () => {
    for (const rarity of Object.values(EQUIPMENT_RARITY)) expect(ITEM_RARITIES[rarity]).toBeDefined();
    expect(ITEM_RARITIES.common.order).toBeLessThan(ITEM_RARITIES.legendary.order);
  });

  it("keeps boss relics legendary and ordinary resources common", () => {
    expect(itemRarity("matriarch_edge")).toBe("legendary");
    expect(itemRarity("venom_focus")).toBe("legendary");
    expect(itemRarity("iron_ore")).toBe("common");
  });
});
