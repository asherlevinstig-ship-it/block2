import { describe, expect, it } from "vitest";
import { decodeLootBagItems, encodeLootBagItems, lootBagRepresentative, lootBagTierForItems } from "./index.js";

describe("loot bags", () => {
  it("maps materials and equipment to readable RotMG-style bag tiers", () => {
    expect(lootBagTierForItems([{ itemId: "moss_fibre", quantity: 1 }])).toBe("brown");
    expect(lootBagTierForItems([{ itemId: "fang_dagger", quantity: 1 }])).toBe("blue");
    expect(lootBagTierForItems([{ itemId: "stone_core_hammer", quantity: 1 }])).toBe("purple");
    expect(lootBagTierForItems([{ itemId: "matriarch_edge", quantity: 1 }])).toBe("white");
  });

  it("combines duplicate stacks and chooses the rarest item as the bag representative", () => {
    const encoded = encodeLootBagItems([
      { itemId: "stone_core", quantity: 1 },
      { itemId: "stone_core", quantity: 2 },
      { itemId: "rootguard_armour", quantity: 1 },
    ]);
    const items = decodeLootBagItems(encoded);
    expect(items).toEqual([{ itemId: "stone_core", quantity: 3 }, { itemId: "rootguard_armour", quantity: 1 }]);
    expect(lootBagRepresentative(items)).toEqual({ itemId: "rootguard_armour", quantity: 1 });
  });
});
