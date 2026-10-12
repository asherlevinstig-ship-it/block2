import { describe, expect, it } from "vitest";
import { SILVER_DEPTHS_ATMOSPHERES, silverDepthsLightColour, silverDepthsZone } from "./silver-depths-atmosphere.js";

describe("Silver Depths area atmosphere", () => {
  it("distinguishes the entrance, gallery, both mining wings, checkpoint and arena", () => {
    expect(silverDepthsZone({ x: 64, y: 1, z: 12 })).toBe("entrance");
    expect(silverDepthsZone({ x: 94, y: 1, z: 14 })).toBe("gallery");
    expect(silverDepthsZone({ x: 100, y: 1, z: -7 })).toBe("iron");
    expect(silverDepthsZone({ x: 102, y: 1, z: 31 })).toBe("silver");
    expect(silverDepthsZone({ x: 113, y: 1, z: 14 })).toBe("checkpoint");
    expect(silverDepthsZone({ x: 131, y: 1, z: 14 })).toBe("arena");
    expect(silverDepthsZone({ x: 64, y: 8, z: 12 })).toBeNull();
    expect(silverDepthsZone({ x: 200, y: 1, z: 12 })).toBeNull();
  });
  it("uses distinct, readable palettes without an overly short fog range", () => {
    expect(silverDepthsLightColour(64, 12)[0]).toBeGreaterThan(silverDepthsLightColour(64, 12)[2]);
    expect(silverDepthsLightColour(102, -7)[0]).toBeGreaterThan(silverDepthsLightColour(102, -7)[2]);
    expect(silverDepthsLightColour(103, 31)[2]).toBeGreaterThan(silverDepthsLightColour(103, 31)[0]);
    expect(silverDepthsLightColour(132, 15)[0]).toBeGreaterThan(silverDepthsLightColour(132, 15)[1]);
    for (const profile of Object.values(SILVER_DEPTHS_ATMOSPHERES)) {
      expect(profile.fogStart).toBeGreaterThanOrEqual(18);
      expect(profile.fogEnd - profile.fogStart).toBeGreaterThanOrEqual(18);
      expect(profile.ambient.every(channel => channel >= .06)).toBe(true);
    }
  });
});
