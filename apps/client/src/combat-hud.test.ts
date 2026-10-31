import { describe, expect, it } from "vitest";
import { cooldownState, starterWeaponArtwork, visibleCallingAbilities, visibleCallingAugments } from "./combat-hud.js";

describe("reactive combat HUD", () => {
  it.each(["tank", "mage", "assassin", "thief", "ranger", "healer"] as const)("keeps %s Specials out of the G picker", path => {
    expect(visibleCallingAbilities(path, 4).every(option => option.category !== "Utility")).toBe(true);
  });
  it("clamps cooldown bars and formats their countdown", () => {
    expect(cooldownState(2500, 5000, "READY · R")).toEqual({ percent: 50, label: "2.5s", ready: false });
    expect(cooldownState(-10, 5000, "READY · R")).toEqual({ percent: 0, label: "READY · R", ready: true });
    expect(cooldownState(8000, 5000, "READY · R").percent).toBe(100);
  });

  it("allows authoritative blocked states to override the timer", () => {
    expect(cooldownState(0, 5000, "READY · R", "SERVER UPDATE")).toEqual({ percent: 0, label: "SERVER UPDATE", ready: false });
  });

  it("progressively reveals Calling choices instead of showing future locked systems", () => {
    expect(visibleCallingAbilities("assassin", 0).map(option => option.name)).toEqual(["Stealth"]);
    expect(visibleCallingAbilities("assassin", 2).map(option => option.name)).toEqual(["Stealth"]);
    expect(visibleCallingAbilities("assassin", 3).map(option => option.name)).toEqual(["Stealth", "Blade Dance"]);
    expect(visibleCallingAugments("assassin_vanish", 1)).toHaveLength(0);
    expect(visibleCallingAugments("assassin_vanish", 2)).toHaveLength(2);
  });

  it("shows Calling-specific starter weapon artwork", () => {
    expect(starterWeaponArtwork("forged_sword", "tank")).toBe("starter-tank");
    expect(starterWeaponArtwork("forged_bow", "ranger")).toBe("starter-ranger");
    expect(starterWeaponArtwork("fang_dagger", "assassin")).toBe("starter-assassin");
    expect(starterWeaponArtwork("fang_dagger", "thief")).toBe("starter-thief");
    expect(starterWeaponArtwork("forged_focus", "mage")).toBe("starter-mage");
    expect(starterWeaponArtwork("forged_focus", "healer")).toBe("starter-healer");
  });
});
