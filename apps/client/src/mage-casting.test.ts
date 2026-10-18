import { describe, expect, it } from "vitest";
import { mageCastDuration, mageCastPose, type MageAbilityId } from "./mage-casting.js";

describe("Mage hand-casting animation", () => {
  it.each(["mage_arcane_surge", "mage_mana_shield", "mage_overload"] as MageAbilityId[])
  ("blends %s in and back to a neutral pose", abilityId => {
    const start = mageCastPose(abilityId, 0);
    const middle = mageCastPose(abilityId, mageCastDuration(abilityId) * .5);
    const end = mageCastPose(abilityId, mageCastDuration(abilityId));
    expect(start.leftArmPitch).toBe(-18);
    expect(end.leftArmPitch).toBe(-18);
    expect(middle.leftArmPitch).toBeLessThan(-60);
    expect(Math.abs(middle.leftArmRoll)).toBeGreaterThan(10);
  });

  it("gives Surge, Shield, and Overload recognisably different gestures", () => {
    const surge = mageCastPose("mage_arcane_surge", 450);
    const shield = mageCastPose("mage_mana_shield", 550);
    const overload = mageCastPose("mage_overload", 625);
    expect(shield.leftArmRoll).toBeLessThan(surge.leftArmRoll);
    expect(overload.leftArmRoll).toBeGreaterThan(0);
    expect(overload.rightArmRoll).toBeLessThan(0);
    expect(overload.torsoYaw).toBeGreaterThan(surge.torsoYaw);
  });
});
