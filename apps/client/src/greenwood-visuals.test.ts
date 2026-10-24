import { describe, expect, it } from "vitest";
import {
  GREENWOOD_ASSET_PLACEMENTS,
  GREENWOOD_FALLEN_LOGS,
  GREENWOOD_GROUND_PATCHES,
  GREENWOOD_ELEVATION_MOUNDS,
  GREENWOOD_LANDMARKS,
  GREENWOOD_LEADER_POSITION,
  GREENWOOD_ROUTE_NODES,
  GREENWOOD_TEXTURE_STYLES,
  GREENWOOD_UNDERGROWTH,
} from "./greenwood-visuals.js";

describe("Greenwood visual composition", () => {
  const trees = GREENWOOD_ASSET_PLACEMENTS.filter(asset => asset.id === "treeCrooked" || asset.id === "treeHighRound");
  const rocks = GREENWOOD_ASSET_PLACEMENTS.filter(asset => asset.id === "rockLarge" || asset.id === "rockSmall");

  it("forms a dense forest border with licensed low-poly nature assets", () => {
    expect(trees.length).toBeGreaterThanOrEqual(36);
    expect(rocks.length).toBeGreaterThanOrEqual(10);
    expect(new Set(GREENWOOD_ASSET_PLACEMENTS.map(asset => asset.name)).size).toBe(GREENWOOD_ASSET_PLACEMENTS.length);
  });

  it("keeps the east-west combat road and leader clearing readable", () => {
    expect(trees.every(tree => Math.abs(tree.position[2] - 106) >= 6)).toBe(true);
    expect(trees.every(tree => Math.hypot(tree.position[0] - GREENWOOD_LEADER_POSITION.x,
      tree.position[2] - GREENWOOD_LEADER_POSITION.z) >= 7.5)).toBe(true);
  });

  it("adds texture and layered forest-floor detail instead of another flat green slab", () => {
    expect(Object.keys(GREENWOOD_TEXTURE_STYLES)).toEqual(["forestFloor", "moss", "leafLitter", "bark"]);
    expect(GREENWOOD_GROUND_PATCHES.some(patch => patch.id === "elderthorn-clearing")).toBe(true);
    expect(GREENWOOD_FALLEN_LOGS.length).toBeGreaterThanOrEqual(5);
    expect(GREENWOOD_UNDERGROWTH.length).toBeGreaterThanOrEqual(24);
  });

  it("gives exploration three combat landmarks and a guarded cache before the leader grove", () => {
    expect(GREENWOOD_LANDMARKS.map(landmark => landmark.kind)).toEqual([
      "ruined-camp", "ancient-shrine", "corrupted-grove", "guarded-cache", "leader-grove",
    ]);
    expect(new Set(GREENWOOD_LANDMARKS.map(landmark => landmark.id)).size).toBe(GREENWOOD_LANDMARKS.length);
    expect(GREENWOOD_LANDMARKS.every(landmark => landmark.discoveryRadius >= 7)).toBe(true);
  });

  it("keeps a readable main route while branches and low ridges break up the field", () => {
    expect(GREENWOOD_ROUTE_NODES[0]).toMatchObject({ id: "east-gate", x: 108.5 });
    expect(GREENWOOD_ROUTE_NODES).toContainEqual(expect.objectContaining({ id: "mistfen-threshold", x: 153.5 }));
    expect(GREENWOOD_ROUTE_NODES.at(-1)).toMatchObject({ id: "elderthorn", x: GREENWOOD_LEADER_POSITION.x });
    expect(GREENWOOD_ELEVATION_MOUNDS.length).toBeGreaterThanOrEqual(6);
    expect(GREENWOOD_ELEVATION_MOUNDS.every(mound => Math.abs(mound.z - 106) >= 8)).toBe(true);
  });
});
