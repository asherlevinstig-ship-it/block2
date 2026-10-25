import { describe, expect, it } from "vitest";
import { firstPersonActionPose, firstPersonWeaponKind } from "./first-person-action.js";

describe("first-person action presentation", () => {
  it("returns every weapon to its rest pose without snapping at the end of an action", () => {
    for (const weaponKind of ["unarmed", "sword", "dagger", "bow", "focus", "hammer"] as const) {
      const input = { timeSeconds: 0, moving: false, weaponKind, attackElapsedMs: null,
        attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 };
      const idle = firstPersonActionPose(input);
      const ended = firstPersonActionPose({ ...input, attackElapsedMs: 500 });
      for (const key of ["leftX", "leftY", "leftZ", "rightX", "rightY", "rightZ", "rightPitch", "rightYaw", "rightRoll"] as const)
        expect(ended[key], `${weaponKind} ${key}`).toBeCloseTo(idle[key], 6);
    }
  });

  it("raises the guard and opens the casting hand while retaining the weapon grip", () => {
    const input = { timeSeconds: 0, moving: false, weaponKind: "sword" as const, attackElapsedMs: null,
      attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 };
    const idle = firstPersonActionPose(input), guard = firstPersonActionPose({ ...input, guarding: 1 });
    const cast = firstPersonActionPose({ ...input, castElapsedMs: 300 });
    expect(guard.leftY).toBeGreaterThan(idle.leftY);
    expect(guard.rightY).toBeGreaterThan(idle.rightY);
    expect(cast.leftCurl).toBeLessThan(.1);
    expect(cast.rightCurl).toBeGreaterThan(.8);
  });
  it("maps every carried main-hand family to a recognizable viewmodel", () => {
    expect(firstPersonWeaponKind("forged_sword")).toBe("sword");
    expect(firstPersonWeaponKind("fang_dagger")).toBe("dagger");
    expect(firstPersonWeaponKind("forged_bow")).toBe("bow");
    expect(firstPersonWeaponKind("venom_focus")).toBe("focus");
    expect(firstPersonWeaponKind("rootbound_hammer")).toBe("hammer");
    expect(firstPersonWeaponKind("unarmed")).toBe("unarmed");
  });

  it("moves the weapon through the centre during an attack instead of only bobbing", () => {
    const idle = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "sword",
      attackElapsedMs: null, attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 });
    const strike = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "sword",
      attackElapsedMs: 330, attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 });
    expect(Math.abs(strike.rightYaw - idle.rightYaw)).toBeGreaterThan(20);
    expect(strike.rightZ).toBeLessThan(idle.rightZ);
  });

  it("brings both hands forward and exposes magic strength while casting", () => {
    const cast = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "focus",
      attackElapsedMs: null, attackDurationMs: 500, comboStep: 0, castElapsedMs: 300, castDurationMs: 600 });
    expect(cast.magicStrength).toBeGreaterThan(.9);
    expect(cast.leftZ).toBeLessThan(-.7);
    expect(cast.rightZ).toBeLessThan(-.7);
  });
});
