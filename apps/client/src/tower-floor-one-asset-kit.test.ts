import { describe, expect, it } from "vitest";
import { towerFloorOneGroundHeight } from "@blockcraft/protocol";
import { readFileSync } from "node:fs";
import {
  KAYKIT_DUNGEON_BASE_URL,
  TOWER_FLOOR_ONE_ASSET_FILES,
  TOWER_FLOOR_ONE_ASSET_SPIKE,
  TOWER_FLOOR_ONE_FORTRESS_ASSETS,
} from "./tower-floor-one-asset-kit.js";

describe("Floor 1 authored asset kit", () => {
  it("uses a compact local CC0 library rather than runtime third-party requests", () => {
    expect(Object.keys(TOWER_FLOOR_ONE_ASSET_FILES)).toHaveLength(36);
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
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.some(asset => asset.id === "stairsWide")).toBe(true);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.filter(asset => asset.name.startsWith("arrival-floor-"))).toHaveLength(7);
    expect(TOWER_FLOOR_ONE_ASSET_SPIKE.filter(asset => asset.id === "trunkA" || asset.id === "trunkB" || asset.id === "trunkC")).toHaveLength(4);
    expect(Math.max(...TOWER_FLOOR_ONE_ASSET_SPIKE.map(asset => asset.position[0]))).toBeLessThanOrEqual(359);
  });

  it("keeps the boss-court architecture deferred and its combat approach open", () => {
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS).toHaveLength(54);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "fortressGate")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "throneChair")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.some(asset => asset.id === "battlement")).toBe(true);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.filter(asset => asset.name.startsWith("crown-court-floor-"))).toHaveLength(16);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.filter(asset => asset.id === "stoneColumn")).toHaveLength(8);
    expect(TOWER_FLOOR_ONE_FORTRESS_ASSETS.every(asset => asset.position[0] >= 361)).toBe(true);
    const centralPlacements = TOWER_FLOOR_ONE_FORTRESS_ASSETS.filter(asset => Math.abs(asset.position[2] - 106) < 4);
    expect(centralPlacements.filter(asset => asset.id.startsWith("floorTile"))).toHaveLength(8);
    expect(centralPlacements.filter(asset => !asset.id.startsWith("floorTile"))).toHaveLength(5);
  });

  it("joins the gate shell and throne wall without visible metre-wide seams", () => {
    const named = (name: string) => TOWER_FLOOR_ONE_FORTRESS_ASSETS.find(asset => asset.name === name)!;
    const gate = named("crown-gate");
    const northPillar = named("gate-north-pillar");
    const southPillar = named("gate-south-pillar");
    const gateHalfLength = 4 * (gate.scale ?? 1) / 2;
    const pillarHalfLength = 4 * (northPillar.scale ?? 1) / 2;
    expect((gate.position[2] - gateHalfLength) - (northPillar.position[2] + pillarHalfLength))
      .toBeLessThanOrEqual(.15);
    expect((southPillar.position[2] - pillarHalfLength) - (gate.position[2] + gateHalfLength))
      .toBeLessThanOrEqual(.15);

    const northWall = named("fortress-north-wall");
    const southWall = named("fortress-south-wall");
    const wallHalfLength = 4 * (northWall.scale ?? 1) / 2;
    expect((southWall.position[2] - wallHalfLength) - (northWall.position[2] + wallHalfLength))
      .toBeLessThanOrEqual(.05);

    for (const side of ["north", "south"] as const) {
      const run = ["west", "mid", "east"].map(section => named(`${side}-court-wall-${section}`));
      const halfLength = 4 * (run[0]!.scale ?? 1) / 2;
      expect(run[0]!.position[0] - halfLength).toBeLessThanOrEqual(northPillar.position[0] + .05);
      expect(run[2]!.position[0] + halfLength).toBeGreaterThanOrEqual(northWall.position[0] - 1.42);
      for (let index = 1; index < run.length; index++)
        expect((run[index]!.position[0] - halfLength) - (run[index - 1]!.position[0] + halfLength))
          .toBeLessThanOrEqual(.05);
    }
  });

  it("beds freestanding fortress pieces into the shared walkable terrain", () => {
    const grounded = new Set([
      "crown-gate", "fortress-north-corner", "fortress-south-corner",
      "fortress-north-wall", "fortress-south-wall", "gate-north-pillar",
      "gate-south-pillar", "north-battlement-west", "north-battlement-east",
      "south-battlement-west", "south-battlement-east", "crownkeeper-throne",
      "north-court-wall-west", "north-court-wall-mid", "north-court-wall-east",
      "south-court-wall-west", "south-court-wall-mid", "south-court-wall-east",
    ]);
    for (const asset of TOWER_FLOOR_ONE_FORTRESS_ASSETS.filter(candidate => grounded.has(candidate.name))) {
      const ground = towerFloorOneGroundHeight(asset.position[0], asset.position[2]);
      expect(Math.abs(asset.position[1] - ground), asset.name).toBeLessThanOrEqual(.12);
    }
  });

  it("keeps wall-supported ivy short and removes only specifically replaced wall sections", () => {
    const worldSource = readFileSync(new URL("./tower-floor-one-world-v2.ts", import.meta.url), "utf8");
    const assetSource = readFileSync(new URL("./tower-floor-one-asset-kit.ts", import.meta.url), "utf8");
    expect(worldSource).toContain('[.07, length * .5, .07]');
    expect(worldSource).toContain('towerFloorOneGroundHeight(x, z) + 2.43');
    expect(worldSource).not.toContain('ivyCurtain(root, 322, 14.8');
    expect(assetSource).not.toContain('name === "floor1-ruined-wall"');
    expect(assetSource).toContain('floor1-ruined-wall-337-116');
  });
});
