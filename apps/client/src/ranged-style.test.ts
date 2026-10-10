import { describe, expect, it } from "vitest";
import { WEAPON_ATTACK_DEFINITIONS as attacks, SPECIAL_DEFINITIONS } from "@blockcraft/protocol";
import { rangedStyle } from "./ranged-style.js";
describe("ranged weapon identity", () => {
  it("gives bows a quicker draw and faster flight than the focuses", () => {
    for (const focus of [attacks.magic_focus, attacks.acid_gland_focus, attacks.venom_focus]) {
      expect(attacks.bow.projectileTravelMs).toBeLessThan(focus.projectileTravelMs);
    }
    expect(attacks.bow.attacks[0].impactMs).toBeLessThan(attacks.acid_gland_focus.attacks[0].impactMs);
    expect(attacks.bow.attacks[0].durationMs).toBeLessThan(attacks.acid_gland_focus.attacks[0].durationMs);
    expect(attacks.forged_bow.projectileTravelMs).toBe(attacks.bow.projectileTravelMs);
    expect(attacks.forged_bow.attacks[0].durationMs).toBe(attacks.bow.attacks[0].durationMs);
  });
  it("keeps acid heavier and slower, without changing damage or venom fan", () => {
    expect(attacks.acid_gland_focus.projectileTravelMs).toBeGreaterThan(attacks.venom_focus.projectileTravelMs);
    expect(attacks.acid_gland_focus.attacks[0].damage).toBe(2);
    expect(attacks.venom_focus.attacks[0].damage).toBe(2);
    expect(SPECIAL_DEFINITIONS.venom_fan.offsets).toEqual([-18, 0, 18]);
  });
  it("uses distinct low-cost shapes, colors and impact cues", () => {
    const bow = rangedStyle("bow"), acid = rangedStyle("acid_gland_focus"), venom = rangedStyle("venom_focus");
    expect(bow.shape).toBe("box"); expect(acid.shape).toBe("sphere");
    expect(acid.scale[0]).toBeGreaterThan(venom.scale[0]!);
    expect(acid.color).not.toEqual(venom.color);
    expect(acid.hitSound).not.toBe(venom.hitSound);
    expect(rangedStyle("forged_bow")).toEqual(bow);
  });
});
