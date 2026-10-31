import { describe, expect, it } from "vitest";
import { firstPersonActionPose, firstPersonMeleePresentation, firstPersonSwordVariant, firstPersonWeaponKind } from "./first-person-action.js";

describe("first-person action presentation", () => {
  it("peaks the blade strike at authored contact time and recovers afterward", () => {
    const input = { timeSeconds: 0, moving: false, weaponKind: "sword" as const,
      attackDurationMs: 266, attackImpactMs: 95, comboStep: 1, castElapsedMs: null, castDurationMs: 600 };
    const before = firstPersonActionPose({ ...input, attackElapsedMs: 60 });
    const contact = firstPersonActionPose({ ...input, attackElapsedMs: 95 });
    const recovery = firstPersonActionPose({ ...input, attackElapsedMs: 200 });
    expect(contact.attackStrength).toBeCloseTo(1);
    expect(before.attackStrength).toBeLessThan(contact.attackStrength);
    expect(recovery.attackStrength).toBeLessThan(contact.attackStrength);
    expect(firstPersonActionPose({ ...input, attackElapsedMs: 266 }).attackStrength).toBe(0);
  });
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

  it("keeps progression swords visually distinct from the basic blade", () => {
    expect(firstPersonSwordVariant("longsword")).toBe("plain");
    expect(firstPersonSwordVariant("forged_sword")).toBe("forged");
    expect(firstPersonSwordVariant("matriarch_edge")).toBe("matriarch");
    expect(firstPersonSwordVariant("cinderfang_blade")).toBe("cinderfang");
    expect(firstPersonSwordVariant("crownkeeper_blade")).toBe("crowncleaver");
  });

  it("moves the weapon through the centre during an attack instead of only bobbing", () => {
    const idle = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "sword",
      attackElapsedMs: null, attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 });
    const strike = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "sword",
      attackElapsedMs: 330, attackDurationMs: 500, comboStep: 1, castElapsedMs: null, castDurationMs: 600 });
    expect(Math.abs(strike.rightYaw - idle.rightYaw)).toBeGreaterThan(20);
    expect(strike.rightZ).toBeLessThan(idle.rightZ);
  });

  it("never renders the held melee weapon over its contact slash", () => {
    expect(firstPersonMeleePresentation("sword", 0)).toEqual({ weaponVisible: true, trailVisible: false });
    expect(firstPersonMeleePresentation("sword", .8)).toEqual({ weaponVisible: false, trailVisible: true });
    expect(firstPersonMeleePresentation("dagger", .4)).toEqual({ weaponVisible: false, trailVisible: true });
    expect(firstPersonMeleePresentation("hammer", .4)).toEqual({ weaponVisible: false, trailVisible: true });
    expect(firstPersonMeleePresentation("bow", .8)).toEqual({ weaponVisible: true, trailVisible: false });
    expect(firstPersonMeleePresentation("focus", .8)).toEqual({ weaponVisible: true, trailVisible: false });
  });

  it("brings both hands forward and exposes magic strength while casting", () => {
    const cast = firstPersonActionPose({ timeSeconds: 0, moving: false, weaponKind: "focus",
      attackElapsedMs: null, attackDurationMs: 500, comboStep: 0, castElapsedMs: 300, castDurationMs: 600 });
    expect(cast.magicStrength).toBeGreaterThan(.9);
    expect(cast.leftZ).toBeLessThan(-.7);
    expect(cast.rightZ).toBeLessThan(-.7);
  });

  it("plants the bow hand and pulls the string hand back toward the cheek", () => {
    const input = { timeSeconds: 0, moving: false, weaponKind: "bow" as const,
      attackElapsedMs: null, attackDurationMs: 360, comboStep: 1,
      castElapsedMs: null, castDurationMs: 600, bowDrawing: true };
    const nocked = firstPersonActionPose({ ...input, bowDrawProgress: 0 });
    const fullDraw = firstPersonActionPose({ ...input, bowDrawProgress: 1 });
    expect(fullDraw.leftX).toBeCloseTo(nocked.leftX);
    expect(fullDraw.leftZ).toBeCloseTo(nocked.leftZ);
    expect(fullDraw.rightX).toBeGreaterThan(nocked.rightX + .1);
    expect(fullDraw.rightY).toBeGreaterThan(nocked.rightY + .1);
    expect(fullDraw.rightZ).toBeGreaterThan(nocked.rightZ + .18);
  });
});
