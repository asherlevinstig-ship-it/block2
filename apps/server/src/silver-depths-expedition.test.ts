import { describe, expect, it } from "vitest";
import { advanceSilverDepths, canEnterSilverDepths, canExitSilverDepths, isInsideSilverDepths } from "./silver-depths-expedition.js";

const player = (overrides: Partial<{ health: number; level: number; miningExpeditionStage: number; silverDepthsStage: number; edge: number }> = {}) => {
  const state = { health: 5, level: 7, miningExpeditionStage: 8, silverDepthsStage: 1, edge: 0, ...overrides };
  return { ...state, inventory: { get: (id: string) => id === "matriarch_edge" && state.edge ? { quantity: state.edge } : undefined } };
};

describe("Silver Depths dungeon loop", () => {
  it("gates entry behind level seven and the completed first expedition", () => {
    expect(canEnterSilverDepths(player())).toBe(true);
    expect(canEnterSilverDepths(player({ level: 6 }))).toBe(false);
    expect(canEnterSilverDepths(player({ miningExpeditionStage: 7 }))).toBe(false);
    expect(canEnterSilverDepths(player({ silverDepthsStage: 0 }))).toBe(false);
  });

  it("requires the personal fixed weapon before extraction", () => {
    expect(canExitSilverDepths(player({ silverDepthsStage: 6 }))).toBe(false);
    expect(canExitSilverDepths(player({ silverDepthsStage: 6, edge: 1 }))).toBe(true);
  });

  it("keeps the seven-step encounter sequence authoritative", () => {
    const events = ["briefed", "entered_depths", "mined_moonstone", "defeated_guards", "defeated_matriarch", "claimed_moonstone", "returned_to_blacksmith"] as const;
    expect(events.reduce((stage, event) => advanceSilverDepths(stage, event), 0)).toBe(7);
    expect(advanceSilverDepths(2, "defeated_matriarch")).toBe(2);
  });

  it("recognises only the authored deep route", () => {
    expect(isInsideSilverDepths({ x: 64, y: 1, z: 9 })).toBe(true);
    expect(isInsideSilverDepths({ x: 92, y: 1, z: 17 })).toBe(true);
    expect(isInsideSilverDepths({ x: 58, y: 1, z: 9 })).toBe(false);
    expect(isInsideSilverDepths({ x: 94, y: 1, z: 9 })).toBe(false);
    expect(isInsideSilverDepths({ x: 64, y: 8, z: 9 })).toBe(false);
  });
});
