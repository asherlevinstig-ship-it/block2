import { describe, expect, it } from "vitest";
import { validateTownNpcInteraction } from "./town-npcs.js";

describe("authoritative Town NPC interactions", () => {
  it("accepts Brom's blacksmith service only inside the shared anchor", () => {
    expect(validateTownNpcInteraction({ x: 79, y: 8, z: 137 }, "smith-brom", "blacksmith")).toEqual({
      ok: true, npcId: "smith-brom", service: "blacksmith",
    });
    expect(validateTownNpcInteraction({ x: 70, y: 8, z: 136 }, "smith-brom", "blacksmith"))
      .toEqual({ ok: false, reason: "too-far" });
  });

  it("rejects services the NPC does not provide", () => {
    expect(validateTownNpcInteraction({ x: 79, y: 8, z: 136 }, "smith-brom", "guild"))
      .toEqual({ ok: false, reason: "unknown-service" });
  });

  it("validates Mara at the correct anchor for each room", () => {
    expect(validateTownNpcInteraction({ x: -5.5, y: 9.5, z: -1.5 }, "mara", "tavern", "tavern").ok).toBe(true);
    expect(validateTownNpcInteraction({ x: -5.5, y: 9.5, z: -1.5 }, "mara", "tavern", "town"))
      .toEqual({ ok: false, reason: "too-far" });
    expect(validateTownNpcInteraction({ x: 5.1, y: 8, z: 23 }, "mara", "healing", "town").ok).toBe(true);
  });

  it("allows Lyra's care but not unrelated commerce", () => {
    expect(validateTownNpcInteraction({ x: 51, y: 8, z: 109 }, "healer-lyra", "healing").ok).toBe(true);
    expect(validateTownNpcInteraction({ x: 51, y: 8, z: 109 }, "healer-lyra", "blacksmith"))
      .toEqual({ ok: false, reason: "unknown-service" });
  });

  it("authorizes guild administration only beside Elin", () => {
    expect(validateTownNpcInteraction({ x: 56, y: 9.45, z: 73 }, "guild-steward-elin", "guild").ok).toBe(true);
    expect(validateTownNpcInteraction({ x: 67, y: 8, z: 106 }, "guild-steward-elin", "guild"))
      .toEqual({ ok: false, reason: "too-far" });
  });
});

