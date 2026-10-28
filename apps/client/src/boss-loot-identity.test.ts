import { describe, expect, it } from "vitest";
import { bossLootIdentity, equipmentCallingFit } from "./boss-loot-identity.js";

describe("boss loot identity", () => {
  it("shows Crowncleaver and both ways to earn it for any Calling", () => {
    expect(bossLootIdentity("floor1-crownkeeper", "The Crownkeeper", "stone_brute", "healer"))
      .toMatchObject({ itemId: "crownkeeper_blade", itemName: "Crowncleaver",
        fitLabel: "WORKS WITH ANY CALLING", dropLabel: "10% CHANCE · 5-FRAGMENT FORGE" });
  });
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
