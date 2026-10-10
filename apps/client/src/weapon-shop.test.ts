import { describe, expect, it } from "vitest";
import { equipmentForItem } from "@blockcraft/protocol";
import { primaryActionPose } from "./character-animation.js";
import { weaponComparison } from "./loot-comparison.js";

describe("forged shop weapons", () => {
  it("shows damage, speed and range for all three inventory weapons", () => {
    expect(weaponComparison("forged_sword").damage).toBe("2 / 2 / 3");
    expect(weaponComparison("forged_bow")).toMatchObject({ damage: "2", speed: "640 ms", range: "9.00 blocks" });
    expect(weaponComparison("forged_focus")).toMatchObject({ damage: "2", speed: "470 ms", range: "7.00 blocks" });
    for (const id of ["forged_sword", "forged_bow", "forged_focus"]) expect(equipmentForItem(id)).toBe(id);
  });
  it("keeps matching ranged animations and does not double-stack the old sword upgrade", () => {
    expect(primaryActionPose(100, 1, "forged_bow")).toEqual(primaryActionPose(100, 1, "bow"));
    expect(primaryActionPose(100, 1, "forged_focus")).toEqual(primaryActionPose(100, 1, "magic_focus"));
    expect(weaponComparison("forged_sword", true).damage).toBe("2 / 2 / 3");
  });
});
