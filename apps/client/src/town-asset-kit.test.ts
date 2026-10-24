import { describe, expect, it } from "vitest";
import { SPEED_LAB_TOWN_ASSETS, TOWN_ASSET_FILES, readyTownFallbacks, townAssetUrl, type TownAssetId } from "./town-asset-kit.js";

describe("town asset kit", () => {
  it("serves every declared asset from one of the curated town libraries", () => {
    for (const id of Object.keys(TOWN_ASSET_FILES) as TownAssetId[]) {
      expect(townAssetUrl(id)).toMatch(/^\/assets\/(?:quaternius-medieval-village|kenney-fantasy-town)\/[a-z-]+\.glb$/);
    }
  });

  it("only retires a fallback after every replacement it needs has loaded", () => {
    expect(readyTownFallbacks(new Set<TownAssetId>(["marketStandA"]))).not.toContain("market-stalls");
    expect(readyTownFallbacks(new Set<TownAssetId>(["marketStandA", "marketStandB"]))).toContain("market-stalls");
    expect(readyTownFallbacks(new Set<TownAssetId>(["rockLarge"]))).not.toContain("rocks");
  });

  it("uses complete buildings around an open, widely-spaced town centre", () => {
    expect(new Set(SPEED_LAB_TOWN_ASSETS.map(asset => asset.name)).size).toBe(SPEED_LAB_TOWN_ASSETS.length);
    expect(SPEED_LAB_TOWN_ASSETS.every(asset => asset.position[1] >= 8.15)).toBe(true);
    expect(Math.min(...SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[0]))).toBeLessThan(77);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => ["foundersBellTower", "wayfarerInn", "beginningsSmithy",
      "weaversHouse", "healersHouse", "wardensBarracks"].includes(asset.id))).toHaveLength(6);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "well")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "gazebo")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "marketStandA")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.id === "hedge" || asset.id === "fence")).toHaveLength(10);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.name.startsWith("east-gate-")).length).toBeGreaterThanOrEqual(8);
    const xs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[0]);
    const zs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(65);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(65);
  });
});
