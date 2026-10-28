import { describe, expect, it } from "vitest";
import { effectiveWeaponRange, fastWorldWeaponProfile, weaponFiresProjectile } from "./index.js";

describe("shared fast weapon identity", () => {
  it.each(["longsword", "forged_sword", "matriarch_edge", "cinderfang_blade"] as const)("keeps %s a 4.6m piercing crescent", id => {
    expect(fastWorldWeaponProfile(id, true)).toMatchObject({ style: "crescent", range: 4.6, pierce: 3 });
    expect(effectiveWeaponRange(id, true)).toBe(4.6); expect(weaponFiresProjectile(id, true)).toBe(true);
    expect(fastWorldWeaponProfile(id, false)).toBeNull();
  });
  it("retains close-range dagger and hammer identities", () => {
    for (const id of ["fang_dagger", "stone_core_hammer", "rootbound_hammer"] as const)
      expect(weaponFiresProjectile(id, true)).toBe(false);
    expect(effectiveWeaponRange("forged_sword", false)).toBe(2.1);
  });
});
