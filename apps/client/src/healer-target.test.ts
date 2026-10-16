import { describe, expect, it } from "vitest";
import { fieldMendTarget, type HealCandidate } from "./healer-target.js";

const candidate = (id: string, health: number, x = 0): HealCandidate =>
  ({ id, x, y: 0, z: 0, health, maxHealth: 10 });

describe("Field Mend preview", () => {
  it("prefers an injured ally over the caster, then the lowest health fraction", () => {
    expect(fieldMendTarget("self", candidate("self", 2),
      [candidate("self", 2), candidate("ally-a", 7, 3), candidate("ally-b", 4, 5)], () => true)).toBe("ally-b");
  });

  it("falls back to self when allies are out of range, blocked, or healthy", () => {
    expect(fieldMendTarget("self", candidate("self", 4),
      [candidate("self", 4), candidate("far", 1, 9), candidate("blocked", 2, 3), candidate("healthy", 10, 2)],
      value => value.id !== "blocked")).toBe("self");
  });

  it("shows no target when no eligible player needs healing", () => {
    expect(fieldMendTarget("self", candidate("self", 10), [candidate("self", 10)], () => true)).toBeNull();
  });
});
