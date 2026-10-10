import { describe, expect, it } from "vitest";
import { AttackCoordination, allyFireLaneClear } from "./attack-coordination.js";
const origin = { x: 60, y: 8, z: 30 };
describe("local mixed attack coordination", () => {
  it("spaces both starts and releases across different windup lengths", () => {
    const director = new AttackCoordination();
    director.started("brute", "p", origin, 10_000, 11_500);
    expect(director.canStart("spitter", "p", origin, 10_033, 10_933, () => true)).toBe(false);
    // Starts are spaced, but the crawler would otherwise release on top of the brute.
    expect(director.canStart("crawler", "p", origin, 10_800, 11_450, () => true)).toBe(false);
    expect(director.canStart("crawler", "p", origin, 11_800, 12_450, () => true)).toBe(true);
  });
  it("does not pause other players, distant fights or another floor", () => {
    const director = new AttackCoordination(); director.started("brute", "p", origin, 10_000, 11_500);
    expect(director.canStart("spitter", "q", origin, 10_033, 10_933, () => true)).toBe(true);
    expect(director.canStart("spitter", "p", { ...origin, x: 90 }, 10_033, 10_933, () => true)).toBe(true);
    expect(director.canStart("spitter", "p", { ...origin, y: 2 }, 10_033, 10_933, () => true)).toBe(true);
  });
  it("releases cancelled/dead reservations immediately and expires old ones", () => {
    const director = new AttackCoordination(); director.started("brute", "p", origin, 10_000, 11_500);
    expect(director.canStart("spitter", "p", origin, 10_033, 10_933, () => false)).toBe(true);
    director.started("brute", "p", origin, 10_000, 11_500);
    expect(director.canStart("spitter", "p", origin, 12_401, 13_301, () => true)).toBe(true);
  });
  it("holds a spitter's central firing lane behind living allies, not dead or off-lane mobs", () => {
    const aim = { ...origin, z: 36 };
    const brute = { ...origin, z: 33, id: "brute", alive: true, archetype: "stone_brute" };
    expect(allyFireLaneClear("spitter", origin, aim, [brute])).toBe(false);
    expect(allyFireLaneClear("spitter", origin, aim, [{ ...brute, x: 62 }])).toBe(true);
    expect(allyFireLaneClear("spitter", origin, aim, [{ ...brute, alive: false }])).toBe(true);
    expect(allyFireLaneClear("spitter", origin, aim, [{ ...brute, id: "spitter" }])).toBe(true);
  });
});
