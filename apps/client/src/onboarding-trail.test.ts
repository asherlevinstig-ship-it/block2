import { describe, expect, it } from "vitest";
import { firstVictoryTownRoute, onboardingTrailRoute, sampleTrail } from "./onboarding-trail.js";

const player = { x: 8.5, y: 8, z: 8.5 };

describe("onboarding glow trail", () => {
  it("guides a first victor back through the south gate and around the tavern", () => {
    expect(firstVictoryTownRoute({ x: 3.5, y: 8, z: 45 })).toEqual([
      { x: 8.5, y: 8, z: 33.5 }, { x: 8.5, y: 8, z: 28.5 },
      { x: 18.5, y: 8, z: 27.5 }, { x: 18.5, y: 8, z: 15.5 },
      { x: 8.5, y: 8.22, z: 11.5 },
    ]);
  });
  it("leads the opening steps to the personal starter drop", () => {
    const drop = { x: 10.5, y: 8.22, z: 10.5, starter: true };
    expect(onboardingTrailRoute(0, player, [], [drop])).toEqual([drop]);
    expect(onboardingTrailRoute(1, player, [], [drop])).toEqual([drop]);
    expect(onboardingTrailRoute(1, player, [], [])).toEqual([{ x: 8.5, y: 8.22, z: 11.5 }]);
    expect(onboardingTrailRoute(2, player, [], [drop])).toEqual([]);
  });

  it("goes around the tavern to the south gate, never toward the cavern", () => {
    const route = onboardingTrailRoute(3, player, [], []);
    expect(route).toEqual([
      { x: 18.5, y: 8, z: 15.5 }, { x: 18.5, y: 8, z: 27.5 },
      { x: 8.5, y: 8, z: 28.5 }, { x: 8.5, y: 8, z: 33.5 },
    ]);
    expect(route.every(point => point.x < 30)).toBe(true);
    expect(sampleTrail(player, route)).toHaveLength(18);
  });

  it("selects a nearby southern ordinary enemy, not an eastern mini-boss", () => {
    const boss = { x: 30, y: 8, z: 8, alive: true, level: 2, isMiniBoss: true, isElite: false };
    const crawler = { id: "south-causeway-crawler", x: 3.5, y: 8, z: 44.5, alive: true, level: 2, isMiniBoss: false, isElite: false };
    const closer = { id: "other-crawler", x: 8.5, y: 8, z: 36.5, alive: true, level: 2, isMiniBoss: false, isElite: false };
    expect(onboardingTrailRoute(4, { x: 8.5, y: 8, z: 33.5 }, [boss, crawler], [])).toEqual([]);
    expect(onboardingTrailRoute(5, { x: 8.5, y: 8, z: 33.5 }, [boss, closer, crawler], [])).toEqual([crawler]);
    const scavenger = { id: "south-causeway-scavenger-west", x: .5, y: 8, z: 47.5, alive: true, level: 1, isMiniBoss: false, isElite: false };
    expect(onboardingTrailRoute(5, { x: 8.5, y: 8, z: 33.5 }, [{ ...crawler, alive: false }, scavenger], [])).toEqual([scavenger]);
    expect(onboardingTrailRoute(6, player, [], [])).toEqual([]);
    expect(onboardingTrailRoute(null, player, [], [])).toEqual([]);
  });
});
