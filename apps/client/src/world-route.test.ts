import { describe, expect, it } from "vitest";
import { isWorldGuidanceRoad, planWorldRoute, remainingWorldRoute, routeDeviationDistance, worldRouteDistance } from "./world-route.js";

describe("overworld road guidance", () => {
  it.each([
    [{ x: 8.5, z: 8.5 }, { x: 8.5, z: 101.5 }],
    [{ x: 8.5, z: 8.5 }, { x: 15.5, z: -72.5 }],
    [{ x: 8.5, z: 8.5 }, { x: 93.5, z: 61.5 }],
    [{ x: 8.5, z: 8.5 }, { x: -50.5, z: -27.5 }],
  ])("connects the town to distant authored regions", (start, end) => {
    const route = planWorldRoute(start, end);
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toMatchObject(end);
    expect(route.slice(0, -1).every(point => isWorldGuidanceRoad(point.x, point.z))).toBe(true);
  });

  it("trims completed sections and detects when the player leaves the route", () => {
    const route = planWorldRoute({ x: 8.5, z: 8.5 }, { x: 8.5, z: 101.5 });
    const midway = route[0]!;
    expect(remainingWorldRoute(midway, route).length).toBeLessThan(route.length);
    expect(routeDeviationDistance(midway, route)).toBeLessThan(.1);
    expect(routeDeviationDistance({ x: midway.x + 20, z: midway.z + 20 }, route)).toBeGreaterThan(5);
    expect(worldRouteDistance(midway, route)).toBeGreaterThan(0);
  });
});
