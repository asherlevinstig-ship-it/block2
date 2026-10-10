import { describe, expect, it } from "vitest";
import { meleeSlotsFull, meleeWaitingGoal } from "../src/melee-coordination.js";
const active = (id: string) => ({ id, alive: true, health: 8, archetype: "moss_crawler", combatState: "windup", targetId: "p" });
describe("melee attack coordination", () => {
  it("limits preparation and delivery together to two attackers per player", () => {
    expect(meleeSlotsFull("p", [active("a")])).toBe(false);
    expect(meleeSlotsFull("p", [active("a"), { ...active("b"), combatState: "strike" }])).toBe(true);
    expect(meleeSlotsFull("other", [active("a"), active("b")])).toBe(false);
  });
  it("immediately releases slots on death, stagger, cancellation or recovery", () => {
    for (const change of [{ alive: false }, { health: 0 }, { combatState: "stagger" }, { combatState: "recover" }, { targetId: "" }]) {
      expect(meleeSlotsFull("p", [active("a"), { ...active("b"), ...change }])).toBe(false);
    }
    expect(meleeSlotsFull("p", [active("a"), { ...active("b"), archetype: "cave_spitter" }])).toBe(false);
  });
  it("assigns distinct stable waiting sectors independent of iteration order", () => {
    const target = { x: 100, y: 1, z: 100 };
    const ids = ["a", "b", "c", "d"];
    const goals = ids.map(id => meleeWaitingGoal(id, target, ids, 3.2));
    expect(new Set(goals.map(g => `${g.x},${g.z}`)).size).toBe(4);
    for (let i = 0; i < ids.length; i++) {
      expect(Math.hypot(goals[i]!.x - target.x, goals[i]!.z - target.z)).toBeCloseTo(3.2);
      expect(meleeWaitingGoal(ids[i]!, target, [...ids].reverse(), 3.2)).toEqual(goals[i]);
    }
  });
});
