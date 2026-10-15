import { describe, expect, it } from "vitest";
import { bossLootIdentity, equipmentCallingFit } from "./boss-loot-identity.js";

describe("boss loot identity", () => {
  it("shows the Crystal Matriarch reward and recognises a matching Calling", () => {
    expect(bossLootIdentity("crystal-matriarch", "Crystal Matriarch", "cave_spitter", "assassin"))
      .toMatchObject({ itemId: "matriarch_edge", fitLabel: "YOUR ASSASSIN CALLING", dropLabel: "SIGNATURE CHANCE" });
  });

  it("uses the enemy archetype for area leader equipment", () => {
    expect(bossLootIdentity("moss-crawler", "Mossback Alpha", "moss_crawler", "tank"))
      .toMatchObject({ itemId: "fang_dagger", fitLabel: "BEST FOR ASSASSIN / THIEF", dropLabel: "LEADER CACHE" });
    expect(bossLootIdentity("stone-brute", "Stonehide Crusher", "stone_brute", "tank").fitLabel)
      .toBe("YOUR TANK CALLING");
  });

  it("explains an equipment discovery without claiming it is unusable", () => {
    expect(equipmentCallingFit("acid_gland_focus", "assassin")).toBe("Build path: Mage / Ranger");
    expect(equipmentCallingFit("forged_sword", "assassin")).toBe("Flexible equipment");
  });
});
