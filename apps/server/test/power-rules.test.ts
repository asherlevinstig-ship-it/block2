import { describe, expect, it } from "vitest";
import { POWER_DEFINITIONS } from "@blockcraft/protocol";
import { isGroundPowerTargetInRange, isPowerCompatible, lineFractureColumns, mobilityAdvanceDistance, powerDirection, powerEvadeDirection, selectBurstPowerTargets, selectGroundPowerTargets, selectLinePowerTargets, selectMobilityPowerTarget } from "../src/power-rules.js";

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

  it("chooses the shortest lateral escape side from a line", () => {
    const right = powerEvadeDirection({ x: 0, y: 8, z: 0 }, 0, { x: 0.2, y: 8, z: 2 });
    const left = powerEvadeDirection({ x: 0, y: 8, z: 0 }, 0, { x: -0.2, y: 8, z: 2 });
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
    expect(left.x).toBeCloseTo(-1);
    expect(left.z).toBeCloseTo(0);
  });

  it("selects living targets inside a radial burst", () => {
    const targets = selectBurstPowerTargets(
      { x: 5, y: 8, z: 5 },
      [
        { id: "near", x: 6, y: 8, z: 5, alive: true },
        { id: "edge", x: 5, y: 8, z: 8.2, alive: true },
        { id: "far", x: 9, y: 8, z: 5, alive: true },
        { id: "dead", x: 5.5, y: 8, z: 5, alive: false },
      ],
      POWER_DEFINITIONS.shockwave.range,
    );
    expect(targets.map(target => target.id)).toEqual(["near", "edge"]);
  });

  it("resolves ground Power targets around the selected impact point", () => {
    const targets = selectGroundPowerTargets(
      { x: 12, y: 8, z: 10 },
      [
        { id: "center", x: 12.2, y: 8, z: 10.1, alive: true },
        { id: "edge", x: 14.2, y: 8, z: 10, alive: true },
        { id: "outside", x: 14.4, y: 8, z: 10, alive: true },
        { id: "above", x: 12, y: 10, z: 10, alive: true },
      ],
      POWER_DEFINITIONS.eruption.width,
    );
    expect(targets.map(target => target.id)).toEqual(["center", "edge"]);
  });

  it("rejects ground targets outside horizontal or vertical casting range", () => {
    const origin = { x: 8.5, y: 8, z: 8.5 };
    expect(isGroundPowerTargetInRange(origin, { x: 14, y: 8, z: 8.5 }, POWER_DEFINITIONS.eruption.range)).toBe(true);
    expect(isGroundPowerTargetInRange(origin, { x: 16, y: 8, z: 8.5 }, POWER_DEFINITIONS.eruption.range)).toBe(false);
    expect(isGroundPowerTargetInRange(origin, { x: 10, y: 10, z: 8.5 }, POWER_DEFINITIONS.eruption.range)).toBe(false);
  });

  it("selects only the nearest target along a mobility strike path", () => {
    const target = selectMobilityPowerTarget(
      { x: 0, y: 8, z: 0 },
      0,
      [
        { id: "far", x: 0.1, y: 8, z: 3.4, alive: true },
        { id: "near", x: -0.2, y: 8, z: 1.8, alive: true },
        { id: "wide", x: 1, y: 8, z: 1, alive: true },
      ],
      POWER_DEFINITIONS.lunge_strike.range,
      POWER_DEFINITIONS.lunge_strike.width,
    );
    expect(target?.id).toBe("near");
    expect(mobilityAdvanceDistance({ x: 0, y: 8, z: 0 }, 0, target, POWER_DEFINITIONS.lunge_strike.forwardStep)).toBeCloseTo(1);
  });
});
