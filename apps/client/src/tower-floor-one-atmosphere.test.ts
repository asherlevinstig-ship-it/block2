import { describe, expect, it } from "vitest";
import { towerFloorOneAtmosphere } from "./tower-floor-one-atmosphere.js";

describe("Floor 1 atmosphere journey", () => {
  it("keeps the sanctuary brighter and more open than the Crownkeeper court", () => {
    const sanctuary = towerFloorOneAtmosphere(306, 106);
    const crown = towerFloorOneAtmosphere(375, 106);
    expect(sanctuary.sun).toBeGreaterThan(crown.sun);
    expect(sanctuary.fill).toBeGreaterThan(crown.fill);
    expect(sanctuary.fogEnd).toBeGreaterThan(crown.fogEnd);
    expect(sanctuary.ambient[2]).toBeGreaterThan(sanctuary.ambient[0]);
    expect(crown.ambient[2]).toBeGreaterThan(crown.ambient[1]);
  });

  it("gives the two Warden courts distinct danger colours", () => {
    const north = towerFloorOneAtmosphere(350, 80);
    const south = towerFloorOneAtmosphere(350, 132);
    expect(north.fog[0]).toBeGreaterThan(north.fog[1]);
    expect(south.fog[1]).toBeGreaterThan(south.fog[0]);
  });

  it("changes smoothly across the sanctuary causeway", () => {
    const before = towerFloorOneAtmosphere(323.9, 106);
    const after = towerFloorOneAtmosphere(324.1, 106);
    expect(Math.abs(before.sun - after.sun)).toBeLessThan(.01);
    expect(Math.abs(before.fog[1] - after.fog[1])).toBeLessThan(.01);
  });
});
