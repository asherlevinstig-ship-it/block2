import { describe, expect, it } from "vitest";
import { canEquipMainHand } from "../src/equipment-rules.js";
import { WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";

describe("equipment ownership", () => {
  it("keeps starter weapons available", () => {
    expect(canEquipMainHand("longsword", () => 0)).toBe(true);
    expect(canEquipMainHand("bow", () => 0)).toBe(true);
    expect(canEquipMainHand("magic_focus", () => 0)).toBe(true);
  });

  it("requires a dropped weapon before it can be equipped", () => {
    expect(canEquipMainHand("fang_dagger", () => 0)).toBe(false);
    expect(canEquipMainHand("fang_dagger", itemId => itemId === "fang_dagger" ? 1 : 0)).toBe(true);
    expect(canEquipMainHand("stone_core_hammer", itemId => itemId === "stone_core_hammer" ? 1 : 0)).toBe(true);
    expect(canEquipMainHand("acid_gland_focus", itemId => itemId === "acid_gland_focus" ? 1 : 0)).toBe(true);
  });

  it("gives every dropped weapon a fixed combat role without rarity", () => {
    expect(WEAPON_ATTACK_DEFINITIONS.fang_dagger.attacks).toHaveLength(3);
    expect(WEAPON_ATTACK_DEFINITIONS.fang_dagger.attacks[0]?.durationMs).toBeLessThan(300);
    expect(WEAPON_ATTACK_DEFINITIONS.stone_core_hammer.attacks[0]?.damage).toBe(3);
    expect(WEAPON_ATTACK_DEFINITIONS.stone_core_hammer.attacks[0]?.knockback).toBeGreaterThan(1);
    expect(WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.range).toBeGreaterThan(7);
    expect(WEAPON_ATTACK_DEFINITIONS.acid_gland_focus.attacks[0]?.damage).toBe(2);
  });
});
