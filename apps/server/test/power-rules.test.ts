import { describe, expect, it } from "vitest";
import { POWER_DEFINITIONS } from "@blockcraft/protocol";
import { isPowerCompatible, lineFractureColumns, powerDirection, selectLinePowerTargets } from "../src/power-rules.js";

describe("Power rules", () => {
  it("resolves facing direction from yaw", () => {
    expect(powerDirection(90).x).toBeCloseTo(1);
    expect(powerDirection(90).z).toBeCloseTo(0);
  });

  it("enforces weapon compatibility", () => {
    expect(isPowerCompatible(POWER_DEFINITIONS.seismic_cleave, "melee")).toBe(true);
    expect(isPowerCompatible(POWER_DEFINITIONS.seismic_cleave, "ranged")).toBe(false);
  });

  it("selects only living targets inside the forward line", () => {
    const targets = selectLinePowerTargets({ x: 0, y: 8, z: 0 }, 0, [
      { id: "near", x: 0.4, y: 8, z: 2, alive: true },
      { id: "wide", x: 1.2, y: 8, z: 2, alive: true },
      { id: "behind", x: 0, y: 8, z: -1, alive: true },
      { id: "dead", x: 0, y: 8, z: 3, alive: false },
    ], 5.2, 1.45);
    expect(targets.map(target => target.id)).toEqual(["near"]);
  });

  it("creates unique fracture columns along the line", () => {
    expect(lineFractureColumns({ x: 8.5, y: 8, z: 8.5 }, 0, 5.2)).toEqual([
      { x: 8, z: 9 },
      { x: 8, z: 10 },
      { x: 8, z: 11 },
      { x: 8, z: 12 },
      { x: 8, z: 13 },
    ]);
  });
});
