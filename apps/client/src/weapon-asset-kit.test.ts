import { describe, expect, it } from "vitest";
import { KAYKIT_WEAPON_ASSET_FILES, KAYKIT_WEAPON_BASE_URL, kayKitTankShieldAsset,
  kayKitWeaponAssetForMainHand } from "./weapon-asset-kit.js";

describe("KayKit weapon asset library", () => {
  it("maps foundational weapon families to authored models", () => {
    expect(kayKitWeaponAssetForMainHand("longsword")).toBe("swordBasic");
    expect(kayKitWeaponAssetForMainHand("forged_sword")).toBe("swordForged");
    expect(kayKitWeaponAssetForMainHand("forged_bow")).toBe("bowForged");
    expect(kayKitWeaponAssetForMainHand("fang_dagger", "assassin")).toBe("daggerAssassin");
    expect(kayKitWeaponAssetForMainHand("fang_dagger", "thief")).toBe("daggerThief");
    expect(kayKitWeaponAssetForMainHand("forged_focus", "mage")).toBe("wandMage");
    expect(kayKitWeaponAssetForMainHand("forged_focus", "healer")).toBe("staffHealer");
    expect(kayKitTankShieldAsset("forged_sword", "tank")).toBe("shieldTank");
    expect(kayKitTankShieldAsset("forged_sword", "mage")).toBeNull();
    expect(kayKitWeaponAssetForMainHand("stone_core_hammer")).toBe("hammerStone");
  });

  it("retains custom models for signature boss weapons", () => {
    for (const id of ["matriarch_edge", "rootbound_hammer", "cinderfang_blade", "crownkeeper_blade"] as const)
      expect(kayKitWeaponAssetForMainHand(id)).toBeNull();
  });

  it("loads only local glTF assets from the licensed pack", () => {
    expect(Object.values(KAYKIT_WEAPON_ASSET_FILES).every(url =>
      url.startsWith(`${KAYKIT_WEAPON_BASE_URL}/`) && url.endsWith(".gltf"))).toBe(true);
  });
});
