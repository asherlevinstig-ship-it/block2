import { describe, expect, it } from "vitest";
import { canMobLungeHit, dodgeDirection, pursueTarget, selectAggroTarget } from "../src/combat-rules.js";

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

  it("enters attack range on the same tick it reaches the melee boundary", () => {
    const result = pursueTarget({ x: 0, y: 8, z: 0 }, { x: 0, y: 8, z: 1.4 }, 1);
    expect(result.z).toBeCloseTo(0.05);
    expect(result.inAttackRange).toBe(true);
  });

  it("normalizes directional dodges and falls back to facing", () => {
    expect(dodgeDirection(1, 1, 0).x).toBeCloseTo(Math.SQRT1_2);
    expect(dodgeDirection(1, 1, 0).z).toBeCloseTo(Math.SQRT1_2);
    expect(dodgeDirection(0, 0, 90).x).toBeCloseTo(1);
    expect(dodgeDirection(0, 0, 90).z).toBeCloseTo(0);
  });

  it("lets invulnerability avoid an otherwise valid lunge", () => {
    const mob = { x: 0, y: 8, z: 0 };
    const player = { x: 0, y: 8, z: 1.5 };
    expect(canMobLungeHit(mob, player, 0, 1000)).toBe(true);
    expect(canMobLungeHit(mob, player, 1200, 1000)).toBe(false);
  });
});
