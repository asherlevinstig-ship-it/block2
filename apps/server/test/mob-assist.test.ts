import { describe, expect, it } from "vitest";
import { mobAssistants } from "../src/mob-assist.js";
const victim = { x: 100, y: 1, z: 100 };
const peer = (id: string, x: number) => ({ id, ...victim, x, alive: true, health: 8, available: true });
describe("bounded mob assist", () => {
  it("recruits only the three nearest direct witnesses within five blocks", () => {
    expect(mobAssistants("victim", victim, [peer("far", 106), peer("d", 104), peer("b", 102), peer("a", 101), peer("c", 103)], () => true).map(p => p.id)).toEqual(["a", "b", "c"]);
  });
  it("excludes the victim, other floors, dead, busy and occluded mobs", () => {
    expect(mobAssistants("victim", victim, [peer("victim", 100), { ...peer("dead", 101), alive: false },
      { ...peer("zero", 101), health: 0 }, { ...peer("busy", 101), available: false }, { ...peer("upstairs", 101), y: 3 }, peer("blocked", 101)], candidate => candidate.id !== "blocked")).toEqual([]);
  });
});
