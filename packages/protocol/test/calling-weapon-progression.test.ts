import { describe, expect, it } from "vitest";
import {
  BUILD_PATHS,
  CALLING_WEAPON_PROGRESSION,
  callingWeaponCompatible,
  callingWeaponDamageBonus,
  callingWeaponHealAmount,
  callingWeaponPulseInterval,
  callingWeaponStage,
  callingWeaponStaggerBonus,
  nextCallingWeaponStage,
  type BuildPathId,
} from "../src/index.js";

describe("Calling weapon progression", () => {
  it("gives every Calling five named stages in rank order", () => {
    for (const pathId of Object.keys(BUILD_PATHS) as BuildPathId[]) {
      expect(CALLING_WEAPON_PROGRESSION[pathId]).toHaveLength(5);
      expect(CALLING_WEAPON_PROGRESSION[pathId].map(stage => stage.rank)).toEqual([0, 1, 2, 3, 4]);
      expect(callingWeaponStage(pathId, 99)).toEqual(CALLING_WEAPON_PROGRESSION[pathId][4]);
      expect(nextCallingWeaponStage(pathId, 4)).toBeNull();
    }
  });

  it("keeps progression active on compatible replacement weapons", () => {
    expect(callingWeaponCompatible("tank", "crownkeeper_blade")).toBe(true);
    expect(callingWeaponCompatible("ranger", "forged_bow")).toBe(true);
    expect(callingWeaponCompatible("mage", "emberheart_focus")).toBe(true);
    expect(callingWeaponCompatible("healer", "fang_dagger")).toBe(false);
    expect(callingWeaponCompatible("assassin", "unarmed")).toBe(false);
  });

  it("scales each offensive Calling's distinct combat opening", () => {
    expect(callingWeaponDamageBonus("tank", 1, "forged_sword", { windup: true })).toBe(1);
    expect(callingWeaponDamageBonus("tank", 3, "forged_sword", { windup: true })).toBe(2);
    expect(callingWeaponDamageBonus("mage", 4, "forged_focus", { pulseReady: true })).toBe(2);
    expect(callingWeaponDamageBonus("assassin", 3, "fang_dagger", { markedOrWeakened: true })).toBe(2);
    expect(callingWeaponDamageBonus("thief", 1, "fang_dagger", { distracted: true })).toBe(1);
    expect(callingWeaponDamageBonus("ranger", 4, "forged_bow")).toBe(2);
    expect(callingWeaponDamageBonus("ranger", 4, "forged_focus")).toBe(0);
  });

  it("accelerates Mage and Healer pulses and upgrades their master effects", () => {
    expect(callingWeaponPulseInterval("mage", 1)).toBe(4);
    expect(callingWeaponPulseInterval("mage", 2)).toBe(3);
    expect(callingWeaponPulseInterval("healer", 4)).toBe(3);
    expect(callingWeaponHealAmount("healer", 1, "forged_focus")).toBe(1);
    expect(callingWeaponHealAmount("healer", 4, "forged_focus")).toBe(2);
    expect(callingWeaponStaggerBonus("tank", 2, "forged_sword", true)).toBe(250);
    expect(callingWeaponStaggerBonus("tank", 4, "forged_sword", true)).toBe(450);
  });
});
