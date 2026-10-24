import { describe, expect, it } from "vitest";
import {
  FAST_WORLD_NAV_LANDMARKS,
  FAST_WORLD_SIGNPOSTS,
  closestFastWorldMiniBoss,
  discoverFastWorldLandmarks,
  fastWorldDestinationDirection,
  fastWorldMapPoint,
  fastWorldPlayerMapRotation,
  fastWorldRegionTravelSummary,
} from "./fast-world-navigation.js";

describe("Fast World navigation", () => {
  it("discovers landmarks only at their authored proximity", () => {
    expect(discoverFastWorldLandmarks({ x: 123.5, z: 88.5 }, new Set()).map(point => point.name))
      .toContain("Mosswatch Remains");
    expect(discoverFastWorldLandmarks({ x: 40, z: 40 }, new Set())).toEqual([]);
    expect(discoverFastWorldLandmarks({ x: 123.5, z: 88.5 }, new Set(["greenwood:mosswatch-camp"]))).toEqual([]);
  });

  it("maps the authored world bounds into a compact canvas", () => {
    expect(fastWorldMapPoint(40, 20, 216, 172)).toEqual({ x: 0, y: 0 });
    expect(fastWorldMapPoint(256, 192, 216, 172)).toEqual({ x: 216, y: 172 });
    expect(fastWorldPlayerMapRotation(0)).toBeCloseTo(Math.PI);
    expect(fastWorldPlayerMapRotation(90)).toBeCloseTo(Math.PI / 2);
    expect(fastWorldPlayerMapRotation(180)).toBeCloseTo(0);
  });

  it("offers physical signs, backtracking guidance and relative direction", () => {
    expect(FAST_WORLD_SIGNPOSTS.some(sign => sign.name === "Fenward Track")).toBe(true);
    expect(fastWorldRegionTravelSummary("greenwood")).toContain("← Town");
    expect(fastWorldRegionTravelSummary("mistfen")).toContain("Greenwood / Town");
    expect(fastWorldDestinationDirection({ x: 0, z: 0 }, { x: 0, z: 10 }, 0))
      .toEqual({ distance: 10, angle: 0 });
  });

  it("contains the authored Greenwood and Mistfen discoveries", () => {
    expect(FAST_WORLD_NAV_LANDMARKS.filter(point => point.regionId === "greenwood")).toHaveLength(5);
    expect(FAST_WORLD_NAV_LANDMARKS.filter(point => point.regionId === "mistfen")).toHaveLength(5);
  });

  it("shows only the closest living miniboss inside proximity", () => {
    const mobs = [
      { id: "near", name: "Near Keeper", x: 20, z: 0, level: 4, alive: true, isMiniBoss: true },
      { id: "closer", name: "Closer Keeper", x: 12, z: 0, level: 6, alive: true, isMiniBoss: true },
      { id: "dead", name: "Dead Keeper", x: 2, z: 0, level: 8, alive: false, isMiniBoss: true },
      { id: "ordinary", name: "Ordinary", x: 1, z: 0, level: 1, alive: true, isMiniBoss: false },
    ];
    expect(closestFastWorldMiniBoss({ x: 0, z: 0 }, mobs)).toMatchObject({ id: "closer", distance: 12 });
    expect(closestFastWorldMiniBoss({ x: 100, z: 100 }, mobs)).toBeNull();
  });
});
