import { describe, expect, it } from "vitest";
import { MINI_BOSS_ENRAGE_MS, MINI_BOSS_FEINT_DELAY_MS, miniBossDamage, miniBossOrbitCounterPattern, miniBossWindupDelay, predictedMiniBossAim, updateOrbitPressure } from "./mini-boss-pressure.js";
import { combatMobDefinition } from "./frontier-champion.js";

describe("mini boss pressure", () => {
  it("leads a moving target but caps the prediction distance", () => {
    const aim = predictedMiniBossAim({ x: 0, y: 8, z: 0 }, { x: 0, y: 8, z: 5 }, { strafe: 1, forward: 0 }, 1);
    expect(aim.x).toBeCloseTo(1.65);
    expect(aim.z).toBe(5);
    expect(aim.yaw).toBeGreaterThan(0);
  });

  it("recognises sustained orbiting and opens a temporary counter window", () => {
    let state = updateOrbitPressure(undefined, { x: 0, z: 0 }, { id: "p", x: 0, z: 4 }, 0);
    for (let index = 1; index <= 8; index++) {
      const angle = index * .13;
      state = updateOrbitPressure(state, { x: 0, z: 0 }, { id: "p", x: Math.sin(angle) * 4, z: Math.cos(angle) * 4 }, index * 50);
    }
    expect(state.counterUntil).toBeGreaterThan(400);
  });

  it("selects an archetype-specific circle breaker", () => {
    expect(miniBossOrbitCounterPattern("cave_spitter")).toBe("venom-ring");
    expect(miniBossOrbitCounterPattern("stone_brute")).toBe("warden-barrage");
    expect(miniBossOrbitCounterPattern("moss_crawler")).toBe("alpha-rush");
  });

  it("adds only one pressure damage when the player is under-levelled", () => {
    expect(miniBossDamage(1, 8, 5)).toBe(2);
    expect(miniBossDamage(2, 12, 1)).toBe(3);
    expect(miniBossDamage(2, 8, 6)).toBe(2);
    expect(MINI_BOSS_ENRAGE_MS).toBe(45_000);
  });

  it("makes an enraged leader decisively faster without removing the tell", () => {
    const calm = combatMobDefinition({ archetype: "cave_spitter", isMiniBoss: true, health: 10, maxHealth: 10 });
    const enraged = combatMobDefinition({ archetype: "cave_spitter", isMiniBoss: true, enraged: true, health: 10, maxHealth: 10 });
    expect(enraged.windupMs).toBeLessThan(calm.windupMs);
    expect(enraged.cooldownMs).toBeLessThan(calm.cooldownMs);
    expect(enraged.recoverMs).toBeLessThan(calm.recoverMs);
    expect(enraged.windupMs).toBeGreaterThanOrEqual(500);
  });

  it("occasionally holds a telegraph to catch automatic early dodges", () => {
    expect(miniBossWindupDelay(true, 2)).toBe(MINI_BOSS_FEINT_DELAY_MS);
    expect(miniBossWindupDelay(true, 3)).toBe(0);
    expect(miniBossWindupDelay(false, 2)).toBe(0);
  });
});
