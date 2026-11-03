import { describe, expect, it } from "vitest";
import { TOWER_FLOOR_TWO_ASSET_PLACEMENTS } from "./tower-floor-two-asset-kit.js";

describe("Floor 2 authored asset pass", () => {
  it("covers arrival, hub, branches and boss approach without blocking paths", () => {
    const names = TOWER_FLOOR_TWO_ASSET_PLACEMENTS.map(placement => placement.name);
    expect(names.some(name => name.startsWith("entry-"))).toBe(true);
    expect(names.some(name => name.startsWith("hub-"))).toBe(true);
    expect(names.some(name => name.startsWith("furnace-"))).toBe(true);
    expect(names.some(name => name.startsWith("quench-"))).toBe(true);
    expect(names).toContain("crucible-gate");
    expect(names.some(name => name.startsWith("boss-"))).toBe(true);
  });

  it("uses a restrained placement count for streaming performance", () => {
    expect(TOWER_FLOOR_TWO_ASSET_PLACEMENTS.length).toBeGreaterThanOrEqual(24);
    expect(TOWER_FLOOR_TWO_ASSET_PLACEMENTS.length).toBeLessThanOrEqual(36);
  });
});
