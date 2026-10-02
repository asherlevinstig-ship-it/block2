import { describe, expect, it } from "vitest";
import { PARRY_WINDOW_MS, isAttackInGuardArc, resolveDefense } from "../src/defense-rules.js";

describe("Defense rules", () => {
  it("only guards attacks arriving from the player's front", () => {
    const player = { x: 0, z: 0, yaw: 0 };
    expect(isAttackInGuardArc(player, { x: 0, z: 2 })).toBe(true);
    expect(isAttackInGuardArc(player, { x: 0, z: -2 })).toBe(false);
  });

  it("parries during the opening window and blocks afterwards", () => {
    expect(resolveDefense(2, true, 1000, 1000 + PARRY_WINDOW_MS, true)).toEqual({ damage: 0, guarded: true, parried: true });
    expect(resolveDefense(2, true, 1000, 1000 + PARRY_WINDOW_MS + 1, true)).toEqual({ damage: 1, guarded: true, parried: false });
  });

  it("does not mitigate attacks outside the guard arc", () => {
    expect(resolveDefense(2, true, 1000, 1100, false)).toEqual({ damage: 2, guarded: false, parried: false });
  });
});
