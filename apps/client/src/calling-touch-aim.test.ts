import { describe, expect, it } from "vitest";
import { callingAimReleaseCancels, callingTouchAimProfile } from "./calling-touch-aim.js";

describe("calling touch aim", () => {
  it("only gives directional server abilities an aim profile", () => {
    expect(callingTouchAimProfile("assassin_death_mark")).toMatchObject({ kind: "line", range: 8, needsEnemy: true });
    expect(callingTouchAimProfile("assassin_blade_dance")).toMatchObject({ kind: "cone", range: 6 });
    expect(callingTouchAimProfile("mage_overload")).toMatchObject({ kind: "ground", range: 14 });
    expect(callingTouchAimProfile("ranger_disengage")).toMatchObject({ kind: "direction", needsEnemy: false });
    expect(callingTouchAimProfile("ranger_deadeye")).toMatchObject({ kind: "line", range: 18 });
  });

  it("keeps self-cast, radial and healer abilities as immediate taps", () => {
    expect(callingTouchAimProfile("tank_bulwark")).toBeNull();
    expect(callingTouchAimProfile("mage_arcane_surge")).toBeNull();
    expect(callingTouchAimProfile("healer_field_mend")).toBeNull();
    expect(callingTouchAimProfile("healer_resurrection")).toBeNull();
  });

  it("cancels only after a drag returns to the source button", () => {
    const bounds = { left: 100, right: 170, top: 200, bottom: 270 };
    expect(callingAimReleaseCancels(true, { x: 135, y: 235 }, bounds)).toBe(true);
    expect(callingAimReleaseCancels(true, { x: 240, y: 180 }, bounds)).toBe(false);
    expect(callingAimReleaseCancels(false, { x: 135, y: 235 }, bounds)).toBe(false);
  });
});
