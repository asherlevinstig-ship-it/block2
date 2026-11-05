import { describe, expect, it } from "vitest";
import { serviceNpcAnimation, serviceNpcFacingYaw, serviceNpcPerformanceDuration,
  serviceNpcPerformanceFor } from "./town-npc-interaction-presentation.js";

describe("town NPC interaction presentation", () => {
  it("turns NPCs toward the player in the town coordinate convention", () => {
    expect(serviceNpcFacingYaw({ x: 0, z: 0 }, { x: 0, z: 5 }, 17)).toBeCloseTo(0);
    expect(serviceNpcFacingYaw({ x: 0, z: 0 }, { x: 5, z: 0 }, 17)).toBeCloseTo(90);
    expect(serviceNpcFacingYaw({ x: 0, z: 0 }, { x: -5, z: 0 }, 17)).toBeCloseTo(-90);
    expect(serviceNpcFacingYaw({ x: 2, z: 2 }, { x: 2, z: 2 }, 17)).toBe(17);
  });

  it("maps every service to a readable authored animation", () => {
    expect(serviceNpcAnimation(serviceNpcPerformanceFor("smith-brom"))).toBe("1H_Melee_Attack_Chop");
    expect(serviceNpcAnimation(serviceNpcPerformanceFor("healer-lyra"))).toBe("Spellcasting");
    expect(serviceNpcAnimation(serviceNpcPerformanceFor("guild-steward-elin"))).toBe("Interact");
    expect(serviceNpcAnimation("greet")).toBe("Interact");
  });

  it("keeps performances long enough to read without delaying the service", () => {
    expect(serviceNpcPerformanceDuration("greet")).toBeGreaterThanOrEqual(1_000);
    expect(serviceNpcPerformanceDuration("forge")).toBeLessThanOrEqual(1_600);
    expect(serviceNpcPerformanceDuration("heal")).toBeGreaterThan(serviceNpcPerformanceDuration("forge"));
  });
});
