import { describe, expect, it } from "vitest";
import { FAST_WORLD_SIMULATION_RANGE, MOB_SIMULATION_RANGE, fastWorldMobSimulationActive, mobSimulationActive } from "../src/mob-activation.js";

describe("mob simulation interest management", () => {
  const mob = { x: 0, y: 8, z: 0 };

  it("keeps full AI active for a living player inside the fixed radius", () => {
    expect(mobSimulationActive(mob, [{ x: MOB_SIMULATION_RANGE, y: 8, z: 0, health: 5 }])).toBe(true);
  });

  it("sleeps mobs outside the regional radius", () => {
    expect(mobSimulationActive(mob, [{ x: MOB_SIMULATION_RANGE + .01, y: 8, z: 0, health: 5 }])).toBe(false);
  });

  it("keeps vertically separated encounters patrolling while their encounter rules prevent targeting", () => {
    expect(mobSimulationActive(mob, [{ x: 0, y: -20, z: 0, health: 5 }])).toBe(true);
  });

  it("does not wake mobs for defeated players", () => {
    expect(mobSimulationActive(mob, [{ x: 1, y: 8, z: 1, health: 0 }])).toBe(false);
  });

  it("uses a tighter fixed radius for the Fast World without changing difficulty", () => {
    expect(FAST_WORLD_SIMULATION_RANGE).toBe(56);
    expect(fastWorldMobSimulationActive(mob, [{ x: 55, y: 8, z: 0, health: 5 }])).toBe(true);
    expect(fastWorldMobSimulationActive(mob, [{ x: 57, y: 8, z: 0, health: 5 }])).toBe(false);
    expect(mobSimulationActive(mob, [{ x: 57, y: 8, z: 0, health: 5 }])).toBe(true);
  });
});
