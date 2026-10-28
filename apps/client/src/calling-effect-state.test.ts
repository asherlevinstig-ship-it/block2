import { describe, expect, it } from "vitest";
import { CallingEffectState } from "./calling-effect-state.js";
import type { CallingAbilityEffect, CallingStateUpdate } from "@blockcraft/protocol";

const shield: CallingStateUpdate = { playerId: "hero", pathId: "mage", abilityId: "mage_mana_shield", phase: "active", label: "BARRIER", charges: 3 };
const overload: CallingStateUpdate = { ...shield, abilityId: "mage_overload", label: "PRIMED", activeUntil: 1000 };
const effect: CallingAbilityEffect = { casterId: "hero", pathId: "mage", abilityId: "mage_overload", x: 4, y: 8, z: 9, yaw: 90, effectId: "cast-1" };
describe("Calling effect ownership", () => {
  it("retains F after G clears and returns the remaining state to the HUD", () => {
    const state = new CallingEffectState(); state.update(shield); state.update(overload);
    expect(state.latest("hero", 500)?.abilityId).toBe("mage_overload");
    state.update({ ...overload, phase: "clear" });
    expect(state.latest("hero", 500)).toEqual(shield);
  });
  it("expires only the timed ability and keeps other players separate", () => {
    const state = new CallingEffectState(); state.update(shield); state.update(overload);
    state.update({ ...overload, playerId: "ally" });
    expect(state.latest("hero", 1000)).toEqual(shield);
    expect(state.latest("ally", 1000)).toBeNull();
  });
  it("deduplicates a broadcast and direct copy without suppressing another fast cast", () => {
    const state = new CallingEffectState();
    expect(state.accept(effect)).toBe(true); expect(state.accept(effect)).toBe(false);
    expect(state.accept({ ...effect, effectId: "cast-2" })).toBe(true);
    expect(state.accept({ ...effect, casterId: "ally" })).toBe(true);
  });
  it("keeps simultaneous G and F effects distinct even if their request timestamps match", () => {
    const state = new CallingEffectState(); expect(state.accept(effect)).toBe(true);
    expect(state.accept({ ...effect, abilityId: "mage_mana_shield" })).toBe(true);
  });
  it("bounds event history and clears it on reconnection", () => {
    const state = new CallingEffectState();
    for (let i = 0; i < 300; i++) expect(state.accept({ ...effect, effectId: `cast-${i}` })).toBe(true);
    expect(state.accept({ ...effect, effectId: "cast-299" })).toBe(false);
    state.update(shield); state.clear();
    expect(state.latest("hero", 0)).toBeNull(); expect(state.accept(effect)).toBe(true);
  });
  it("removes a defeated player's effects without touching a teammate's shield", () => {
    const state = new CallingEffectState(); state.update(shield); state.update({ ...shield, playerId: "ally" });
    state.removePlayer("hero"); expect(state.latest("hero", 0)).toBeNull();
    expect(state.latest("ally", 0)?.charges).toBe(3);
  });
});
