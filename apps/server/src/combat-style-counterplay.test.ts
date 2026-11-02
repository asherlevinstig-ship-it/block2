import { describe, expect, it } from "vitest";
import { antiCampSpeedMultiplier, canPressureHealer, heldGuardBreak, isRangedCombatHand } from "./combat-style-counterplay.js";

describe("combat style counterplay", () => {
  it("presses a persistent distant attacker without changing close combat", () => {
    expect(antiCampSpeedMultiplier(12, 2, 1_000, 2_000)).toBe(1);
    expect(antiCampSpeedMultiplier(12, 2, 1_000, 2_500)).toBe(1.16);
    expect(antiCampSpeedMultiplier(12, 2, 1_000, 5_000)).toBe(1.3);
    expect(antiCampSpeedMultiplier(3, 2, 1_000, 5_000)).toBe(1);
  });

  it("recognizes ranged loadouts and only breaks a held guard", () => {
    expect(isRangedCombatHand("forged_bow")).toBe(true);
    expect(isRangedCombatHand("forged_sword")).toBe(false);
    expect(heldGuardBreak(true, 1_000, 2_400)).toEqual({ active: true, extraStaminaDamage: 8 });
    expect(heldGuardBreak(true, 1_000, 2_399).active).toBe(false);
  });

  it("pressures visible involved healers but respects concealment and Challenge", () => {
    const base = { restored: 4, distance: 10, sameElevation: true, visible: true, concealed: false, challenged: false };
    expect(canPressureHealer(base)).toBe(true);
    expect(canPressureHealer({ ...base, concealed: true })).toBe(false);
    expect(canPressureHealer({ ...base, challenged: true })).toBe(false);
    expect(canPressureHealer({ ...base, distance: 14.1 })).toBe(false);
  });
});
