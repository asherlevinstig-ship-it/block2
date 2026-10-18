import { describe, expect, it } from "vitest";
import { ASHEN_COMBAT_GROUP_IDS } from "./wilderness-encounters.js";
import { ASHEN_CLEAR_WINDOW_MS, ASHEN_RELIQUARY_COOLDOWN_MS, ASHEN_RELIQUARY_OPEN_MS, ASHEN_RELIQUARY_REWARDS, AshenReliquaryCycle, ashenBlueprints, blueprintForReliquaryChoice, withAshenBlueprint } from "./ashen-reliquary.js";

describe("Scorched Reliquary cycle", () => {
  it("opens only after all five distinct Ashen enemies fall inside one clear window", () => {
    const cycle = new AshenReliquaryCycle();
    ASHEN_COMBAT_GROUP_IDS.slice(0, -1).forEach((id, index) => cycle.recordDefeat(id, ["a"], 1_000 + index));
    expect(cycle.snapshot("a", 2_000)).toMatchObject({ phase: "sealed", defeated: 4, required: 5 });
    expect(cycle.recordDefeat(ASHEN_COMBAT_GROUP_IDS.at(-1)!, ["b"], 3_000)).toEqual({ unlocked: true, defeated: 5 });
    expect(cycle.snapshot("a", 3_000)).toMatchObject({ phase: "unlocked", eligible: true, claimed: false, expiresAt: 3_000 + ASHEN_RELIQUARY_OPEN_MS });
    expect(cycle.snapshot("b", 3_000).eligible).toBe(true);
  });

  it("resets an incomplete attempt and enforces one personal claim per cooldown", () => {
    const cycle = new AshenReliquaryCycle();
    cycle.recordDefeat(ASHEN_COMBAT_GROUP_IDS[0], ["a"], 1_000);
    cycle.recordDefeat(ASHEN_COMBAT_GROUP_IDS[1], ["a"], 1_001 + ASHEN_CLEAR_WINDOW_MS);
    expect(cycle.snapshot("a", 1_002 + ASHEN_CLEAR_WINDOW_MS).defeated).toBe(1);
    ASHEN_COMBAT_GROUP_IDS.filter(id => id !== ASHEN_COMBAT_GROUP_IDS[1]).forEach((id, index) =>
      cycle.recordDefeat(id, ["a"], 2_000 + ASHEN_CLEAR_WINDOW_MS + index));
    const unlockedAt = 2_010 + ASHEN_CLEAR_WINDOW_MS;
    expect(cycle.markClaimed("a", unlockedAt)).toBe(true);
    expect(cycle.markClaimed("a", unlockedAt)).toBe(false);
    expect(cycle.snapshot("a", unlockedAt + ASHEN_RELIQUARY_OPEN_MS + 1).phase).toBe("cooldown");
    expect(cycle.snapshot("a", 2_003 + ASHEN_CLEAR_WINDOW_MS + ASHEN_RELIQUARY_COOLDOWN_MS + 1)).toMatchObject({ phase: "sealed", defeated: 0, eligible: false });
  });

  it("offers distinct weapon, armour, and gold choices", () => {
    expect(ASHEN_RELIQUARY_REWARDS.weapon.items).toEqual([{ itemId: "ember_ore", quantity: 3 }, { itemId: "stone_core", quantity: 2 }]);
    expect(ASHEN_RELIQUARY_REWARDS.armour.items).toEqual([{ itemId: "ember_ore", quantity: 2 }, { itemId: "iron_ore", quantity: 4 }]);
    expect(ASHEN_RELIQUARY_REWARDS.gold.gold).toBe(45);
  });

  it("persists one of the three first-clear blueprints without losing other character data", () => {
    const initial = JSON.stringify({ selectedPathId: "mage", xp: { mage: 12 } });
    const weapon = withAshenBlueprint(initial, blueprintForReliquaryChoice("weapon")!);
    const all = withAshenBlueprint(withAshenBlueprint(weapon, "ashguard"), "emberheart");
    expect(ashenBlueprints(all)).toEqual(["cinderfang", "ashguard", "emberheart"]);
    expect(JSON.parse(all)).toMatchObject({ selectedPathId: "mage", xp: { mage: 12 } });
    expect(blueprintForReliquaryChoice("gold")).toBeNull();
  });
});
