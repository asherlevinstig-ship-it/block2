import { describe, expect, it } from "vitest";
import {
  KAYKIT_DUNGEON_BASE_URL,
  TOWER_FLOOR_ONE_ASSET_FILES,
  TOWER_FLOOR_ONE_ASSET_SPIKE,
  TOWER_FLOOR_ONE_FORTRESS_ASSETS,
} from "./tower-floor-one-asset-kit.js";

describe("Floor 1 authored asset kit", () => {
  it("uses a compact local CC0 library rather than runtime third-party requests", () => {
    expect(Object.keys(TOWER_FLOOR_ONE_ASSET_FILES)).toHaveLength(21);
    expect(Object.values(TOWER_FLOOR_ONE_ASSET_FILES)
      .every(url => url.startsWith(`${KAYKIT_DUNGEON_BASE_URL}/`) && url.endsWith(".glb"))).toBe(true);
  });

  it("gives every placement a unique stable name and positive scale", () => {
    expect(new Set(TOWER_FLOOR_ONE_ASSET_SPIKE.map(asset => asset.name)).size)
      .toBe(TOWER_FLOOR_ONE_ASSET_SPIKE.length);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.every(asset => (asset.scale ?? 1) > 0)).toBe(true);
  });

  it("concentrates the first pass on the sanctuary and opening court", () => {
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.filter(asset => asset.id === "decoratedPillar")).toHaveLength(8);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.filter(asset => asset.id === "archedWall")).toHaveLength(3);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.some(asset => asset.id === "crates")).toBe(true);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.some(asset => asset.id === "torch")).toBe(true);
    expect(Math.max(...TOWER_FLOOR_ONE_ASSET_SPIKE.map(asset => asset.position[0]))).toBeLessThanOrEqual(356);
  });

  it("keeps the boss-court architecture deferred and its combat approach open", () => {
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS).toHaveLength(20);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "fortressGate")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "throneChair")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "battlement")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.every(asset => asset.position[0] >= 361)).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.filter(asset => Math.abs(asset.position[2] - 106) < 4))
      .toHaveLength(3);
  });
});
