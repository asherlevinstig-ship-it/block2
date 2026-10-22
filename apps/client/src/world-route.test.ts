import { describe, expect, it } from "vitest";
import { isWorldGuidanceRoad, planWorldRoute, remainingWorldRoute, routeDeviationDistance, worldRouteDistance } from "./world-route.js";

describe("overworld road guidance", () => {
  it.each([
    [{ x: 8.5, z: 8.5 }, { x: 8.5, z: 171.5 }],
    [{ x: 8.5, z: 8.5 }, { x: 18.5, z: -142.5 }],
    [{ x: 8.5, z: 8.5 }, { x: 165.5, z: 68.5 }],
    [{ x: 8.5, z: 8.5 }, { x: -99.5, z: -42.5 }],
  ])("connects the town to distant authored regions", (start, end) => {
    const route = planWorldRoute(start, end);
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toMatchObject(end);
    expect(route.slice(0, -1).every(point => isWorldGuidanceRoad(point.x, point.z))).toBe(true);
  });

  it("closes the northern loop between Deepfen and Northwatch", () => {
    const route = planWorldRoute({ x: -99.5, z: -42.5 }, { x: 18.5, z: -142.5 });
    expect(route.length).toBeGreaterThan(2);
    expect(route.some(point => point.z === -57.5 || point.z === -58.5)).toBe(true);
    expect(route.at(-1)).toMatchObject({ x: 18.5, z: -142.5 });
  });

  it("returns from the northern stronghold to Greenwood along the east descent", () => {
    const route = planWorldRoute({ x: 64.5, z: -118.5 }, { x: 43.5, z: 4.5 });
    expect(route.length).toBeGreaterThan(3);
    expect(routeDeviationDistance({ x: 73.5, z: -60.5 }, route)).toBeLessThanOrEqual(1);
    expect(route.at(-1)).toMatchObject({ x: 43.5, z: 4.5 });
  });

  it("closes the eastern Ashen loop into the southern quarry", () => {
    const route = planWorldRoute({ x: 165.5, z: 68.5 }, { x: 24.5, z: 137.5 });
    expect(route.length).toBeGreaterThan(2);
    expect(routeDeviationDistance({ x: 100.5, z: 113.5 }, route)).toBeLessThan(1);
    expect(route.at(-1)).toMatchObject({ x: 24.5, z: 137.5 });
  });

  it("trims completed sections and detects when the player leaves the route", () => {
    const route = planWorldRoute({ x: 8.5, z: 8.5 }, { x: 8.5, z: 171.5 });
    const midway = route[0]!;
    expect(remainingWorldRoute(midway, route).length).toBeLessThan(route.length);
    expect(routeDeviationDistance(midway, route)).toBeLessThan(.1);
    expect(routeDeviationDistance({ x: midway.x + 20, z: midway.z + 20 }, route)).toBeGreaterThan(5);
    expect(worldRouteDistance(midway, route)).toBeGreaterThan(0);
  });
});
