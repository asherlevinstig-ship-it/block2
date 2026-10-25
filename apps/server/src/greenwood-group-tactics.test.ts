import { describe, expect, it } from "vitest";
import { elderthornGuardGoal, greenwoodRegroupGoal, greenwoodRegroupState, isGreenwoodCombatant } from "./greenwood-group-tactics.js";

describe("Greenwood group tactics", () => {
  it("only opts authored Greenwood combatants into the regional behavior", () => {
    expect(isGreenwoodCombatant("greenwood-briar-east")).toBe(true);
    expect(isGreenwoodCombatant("mistfen-briar-east")).toBe(false);
  });

  it("opens a short wounded retreat with a longer re-trigger cooldown", () => {
    expect(greenwoodRegroupState(4, 10, 1_000)).toBeUndefined();
    const state = greenwoodRegroupState(3, 10, 1_000)!;
    expect(state).toEqual({ until: 2_250, cooldownUntil: 7_000 });
    expect(greenwoodRegroupState(2, 10, 3_000, state)).toBe(state);
  });

  it("regroups behind an ally instead of retreating through the player", () => {
    expect(greenwoodRegroupGoal({ x: 2, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 4, y: 1, z: 0 }))
      .toEqual({ x: 4.9, y: 1, z: 0 });
  });

  it("places escorts in two shielding lanes between Elderthorn and the player", () => {
    const left = elderthornGuardGoal({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 8 }, 0);
    const right = elderthornGuardGoal({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 8 }, 1);
    expect(left.z).toBeCloseTo(1.15);
    expect(right.z).toBeCloseTo(1.15);
    expect(left.x).toBeCloseTo(.62);
    expect(right.x).toBeCloseTo(-.62);
  });
});
