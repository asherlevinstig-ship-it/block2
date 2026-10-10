import { describe, expect, it } from "vitest";
import { CombatContributions } from "../src/combat-contributions.js";
const mob = { x: 100, y: 8, z: 100, maxHealth: 20 };
const player = { ...mob, health: 5 };
describe("kill contributions", () => {
  it("credits meaningful recent damage, not spectators or tiny final hits", () => {
    const credit = new CombatContributions(); credit.record("mob", "a", 15, 1000); credit.record("mob", "b", 2, 1000); credit.record("mob", "last", 1, 1000);
    expect(credit.eligible("mob", mob, [["a", player], ["b", player], ["last", player], ["watcher", player]], 1100)).toEqual(["a", "b"]);
  });
  it("expires individual hits, so tiny fresh hits cannot refresh old damage", () => {
    const credit = new CombatContributions(); credit.record("mob", "a", 10, 1000); credit.record("mob", "a", 1, 21001);
    expect(credit.eligible("mob", mob, [["a", player]], 21001)).toEqual([]);
    credit.record("mob", "a", 1, 21002); expect(credit.eligible("mob", mob, [["a", player]], 21002)).toEqual(["a"]);
  });
  it("excludes defeated, distant, different-floor and disconnected contributors", () => {
    const credit = new CombatContributions(); for (const id of ["dead", "far", "floor", "gone", "a"]) credit.record("mob", id, 4, 1000);
    credit.disconnect("gone");
    expect(credit.eligible("mob", mob, [["dead", { ...player, health: 0 }], ["far", { ...player, x: 123 }], ["floor", { ...player, y: 4 }], ["gone", player], ["a", player]], 1000)).toEqual(["a"]);
    credit.clear("mob"); expect(credit.eligible("mob", mob, [["a", player]], 1000)).toEqual([]);
  });
  it("does not count misses, invalid damage, future hits or other mobs", () => {
    const credit = new CombatContributions(); for (const amount of [0, -1, NaN, Infinity]) credit.record("mob", "a", amount, 1000);
    credit.record("other", "a", 10, 1000); credit.record("mob", "a", 10, 3000);
    expect(credit.eligible("mob", mob, [["a", player]], 1000)).toEqual([]);
  });
});
