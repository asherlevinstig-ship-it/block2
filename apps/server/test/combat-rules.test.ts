import { describe, expect, it } from "vitest";
import { canMobLungeHit, dodgeDirection, isInsideImpact, maintainRangedDistance, pursueTarget, selectAggroTarget } from "../src/combat-rules.js";

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

  it("keeps ranged mobs inside their preferred attack band", () => {
    const target = { x: 0, y: 8, z: 0 };
    const close = maintainRangedDistance({ x: 0, y: 8, z: 2 }, target, 1, 1, 4, 7);
    expect(close.z).toBeCloseTo(3);
    expect(close.inAttackRange).toBe(false);
    const far = maintainRangedDistance({ x: 0, y: 8, z: 9 }, target, 1, 1, 4, 7);
    expect(far.z).toBeCloseTo(8);
    expect(far.inAttackRange).toBe(false);
    expect(maintainRangedDistance({ x: 0, y: 8, z: 6 }, target, 1, 1, 4, 7).inAttackRange).toBe(true);
  });

  it("resolves projectile and hazard radii in three dimensions", () => {
    const impact = { x: 4, y: 8, z: 4 };
    expect(isInsideImpact({ x: 4.7, y: 8, z: 4.4 }, impact, 0.9)).toBe(true);
    expect(isInsideImpact({ x: 5, y: 8, z: 4 }, impact, 0.9)).toBe(false);
    expect(isInsideImpact({ x: 4, y: 5, z: 4 }, impact, 1.3)).toBe(false);
  });
});
