import { describe, expect, it } from "vitest";
import { pursueTarget, selectAggroTarget } from "../src/combat-rules.js";

describe("mob combat behavior", () => {
  it("selects the closest living surface player", () => {
    const target = selectAggroTarget({ x: 10, y: 8, z: 10 }, [
      { id: "underground", x: 10, y: 4, z: 10, health: 5 },
      { id: "far", x: 20, y: 8, z: 10, health: 5 },
      { id: "near", x: 12, y: 8, z: 10, health: 5 },
    ]);
    expect(target?.id).toBe("near");
  });

  it("moves toward a target but stops at melee distance", () => {
    expect(pursueTarget({ x: 0, y: 8, z: 0 }, { x: 0, y: 8, z: 4 }, 1)).toEqual({
      x: 0,
      z: 1.35,
      yaw: 0,
      inAttackRange: false,
    });
    expect(pursueTarget({ x: 0, y: 8, z: 0 }, { x: 0, y: 8, z: 1 }, 1).inAttackRange).toBe(true);
  });
});
