import { describe, expect, it } from "vitest";
import { WARDEN_LOOT_BEAM_MS, WARDEN_VICTORY_TRANSFORM_MS, wardenVictoryActive, wardenVictoryPulse } from "./warden-victory-effects.js";

describe("Realm Warden victory presentation", () => {
  it("keeps the arena transformation and personal loot beams visible for fifteen seconds", () => {
    expect(WARDEN_VICTORY_TRANSFORM_MS).toBe(15_000);
    expect(WARDEN_LOOT_BEAM_MS).toBe(15_000);
    expect(wardenVictoryActive(14_999, 15_000)).toBe(true);
    expect(wardenVictoryActive(15_000, 15_000)).toBe(false);
  });

  it("uses a restrained positive light pulse", () => {
    for (const now of [0, 250, 1_000, 5_000]) expect(wardenVictoryPulse(now)).toBeGreaterThan(1.5);
  });
});
