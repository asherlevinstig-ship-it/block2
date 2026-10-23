import { describe, expect, it } from "vitest";
import { SPEED_LAB_TOWN_ASSETS, TOWN_ASSET_FILES, readyTownFallbacks, townAssetUrl, type TownAssetId } from "./town-asset-kit.js";

describe("town asset kit", () => {
  it("serves every declared asset from the versioned town directory", () => {
    for (const id of Object.keys(TOWN_ASSET_FILES) as TownAssetId[]) {
      expect(townAssetUrl(id)).toMatch(/^\/assets\/kenney-fantasy-town\/[a-z-]+\.glb$/);
    }
  });

  it("only retires a fallback after every replacement it needs has loaded", () => {
    expect(readyTownFallbacks(new Set<TownAssetId>(["stallGreen"]))).not.toContain("market-stalls");
    expect(readyTownFallbacks(new Set<TownAssetId>(["stallGreen", "stallRed"]))).toContain("market-stalls");
    expect(readyTownFallbacks(new Set<TownAssetId>(["rockLarge"]))).not.toContain("rocks");
  });

  it("gives each pilot placement a unique name and keeps it on or above town ground", () => {
    expect(new Set(SPEED_LAB_TOWN_ASSETS.map(asset => asset.name)).size).toBe(SPEED_LAB_TOWN_ASSETS.length);
    expect(SPEED_LAB_TOWN_ASSETS.every(asset => asset.position[1] >= 8.15)).toBe(true);
    expect(Math.min(...SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[0]))).toBeLessThan(77);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "fountainRound")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.id === "wallWoodDoor")).toHaveLength(6);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.id === "wallWoodWindow").length).toBeGreaterThan(60);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "roofHigh")).toBe(true);
    const xs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[0]);
    const zs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(65);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(65);
  });
});
