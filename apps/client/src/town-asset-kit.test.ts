import { describe, expect, it } from "vitest";
import {
  canUseForestPortal,
  FAST_WORLD_COLLISION_QUERY,
  FAST_WORLD_TAVERN_ENTRANCE,
  RAPID_PRACTICE_TOWN_COLLIDERS,
} from "@blockcraft/protocol";
import { Block, playerCollides } from "@blockcraft/voxel-world";
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
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => ["foundersBellTower", "wayfarerInn", "beginningsSmithy",
      "weaversHouse", "healersHouse", "wardensBarracks"].includes(asset.id))
      .every(asset => (asset.scale ?? 0) >= 2.1)).toBe(true);
    // The Tower Chronicle now owns the central-plaza footprint formerly used by the well.
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "well")).toBe(false);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "gazebo")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.some(asset => asset.id === "marketStandA")).toBe(true);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.id === "hedge" || asset.id === "fence")).toHaveLength(10);
    expect(SPEED_LAB_TOWN_ASSETS.filter(asset => asset.name.startsWith("east-gate-")).length).toBeGreaterThanOrEqual(8);
    const xs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[0]);
    const zs = SPEED_LAB_TOWN_ASSETS.map(asset => asset.position[2]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(65);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(65);
  });

  it("places the tavern entrance beside the authored inn rather than the retired fallback", () => {
    const inn = SPEED_LAB_TOWN_ASSETS.find(asset => asset.id === "wayfarerInn")!;
    const collider = RAPID_PRACTICE_TOWN_COLLIDERS.find(candidate => candidate.id === "wayfarer-inn")!;
    // The inn's enlarged authored mesh places its east doorway 6.7m from the
    // model origin; this anchor intentionally follows that visible threshold.
    expect(Math.hypot(FAST_WORLD_TAVERN_ENTRANCE.x - inn.position[0], FAST_WORLD_TAVERN_ENTRANCE.z - inn.position[2])).toBeLessThan(7);
    expect(FAST_WORLD_TAVERN_ENTRANCE.x).toBeGreaterThan(collider.maxX);
    expect(FAST_WORLD_TAVERN_ENTRANCE.z).toBeGreaterThanOrEqual(collider.minZ);
    expect(FAST_WORLD_TAVERN_ENTRANCE.z).toBeLessThanOrEqual(collider.maxZ);
  });

  it("keeps a player-sized route open through the inn facade to the tavern door", () => {
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(79.7, 9, 73)).toMatchObject({
      id: "wayfarer-inn-facade-north",
    });
    expect(FAST_WORLD_COLLISION_QUERY.obstacleAt(79.7, 9, 79)).toMatchObject({
      id: "wayfarer-inn-facade-south",
    });
    const read = Object.assign(
      (x: number, y: number, z: number) => FAST_WORLD_COLLISION_QUERY.cellSolid(x, y, z) ? Block.Stone : Block.Air,
      { groundHeight: FAST_WORLD_COLLISION_QUERY.groundHeight },
    );
    for (const z of [74.5, 75.5, 76, 76.5, 77.5]) {
      for (const x of [83, 82, 81, 80.5, 79.5]) {
        expect(playerCollides(read, x, 8, z), `${x},${z}`).toBe(false);
      }
    }
    expect(canUseForestPortal(
      { x: 83, y: 8, z: 76, health: 5 },
      { ...FAST_WORLD_TAVERN_ENTRANCE, kind: "tavern-entry", expiresAt: 0 },
      Date.now(),
    )).toBe(true);
  });
});
