import { describe, expect, it } from "vitest";
import { compatiblePowerIds } from "./power-loadout.js";

describe("Power loadout compatibility", () => {
  it("keeps universal Powers available for every prototype main hand", () => {
    expect(compatiblePowerIds("longsword")).toEqual(["shockwave", "seismic_cleave", "eruption", "lunge_strike"]);
    expect(compatiblePowerIds("bow")).toEqual(["shockwave", "eruption"]);
    expect(compatiblePowerIds("magic_focus")).toEqual(["shockwave", "eruption"]);
    expect(compatiblePowerIds("fang_dagger")).toEqual(["shockwave", "seismic_cleave", "eruption", "lunge_strike"]);
    expect(compatiblePowerIds("stone_core_hammer")).toEqual(["shockwave", "seismic_cleave", "eruption", "lunge_strike"]);
    expect(compatiblePowerIds("acid_gland_focus")).toEqual(["shockwave", "eruption"]);
  });
});
