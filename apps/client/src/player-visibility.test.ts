import { describe, expect, it } from "vitest";
import {
  isBelowSurroundingSurface,
  isVoxelHiddenForPlayer,
  stableCutawayAnchor,
  type PlayerCutaway,
} from "./player-visibility.js";

const underground: PlayerCutaway = {
  active: true,
  playerX: 8.5,
  playerY: 4,
  playerZ: 8.5,
  cameraOffsetX: 16,
  cameraOffsetZ: 16,
};

describe("underground player visibility", () => {
  it("preserves the floor supporting the player", () => {
    expect(isVoxelHiddenForPlayer(8, 3, 8, underground)).toBe(false);
    expect(isVoxelHiddenForPlayer(10, 3, 10, underground)).toBe(false);
  });

  it("opens the roof above the player", () => {
    expect(isVoxelHiddenForPlayer(8, 5, 8, underground)).toBe(true);
  });

  it("clears walls between the camera and player", () => {
    expect(isVoxelHiddenForPlayer(10, 4, 10, underground)).toBe(true);
    expect(isVoxelHiddenForPlayer(5, 4, 5, underground)).toBe(false);
  });

  it("keeps terrain away from the viewing corridor", () => {
    expect(isVoxelHiddenForPlayer(14, 4, 7, underground)).toBe(false);
  });

  it("does not alter terrain on the surface", () => {
    expect(isVoxelHiddenForPlayer(8, 8, 8, { ...underground, active: false })).toBe(false);
  });

  it("activates after stepping down into an open excavation", () => {
    expect(isBelowSurroundingSurface(7, [7, 7, 7, 7, 6, 6, 6, 6])).toBe(true);
    expect(isBelowSurroundingSurface(8, [7, 7, 7, 7, 7, 7, 7, 7])).toBe(false);
  });

  it("ignores an isolated tall column beside a surface player", () => {
    expect(isBelowSurroundingSurface(8, [10, 7, 7, 7, 7, 7, 7, 7])).toBe(false);
  });

  it("keeps the cutaway fixed while the player remains inside its dead zone", () => {
    const anchor = { x: 8, y: 4, z: 8 };
    expect(stableCutawayAnchor(anchor, { x: 9.2, y: 4, z: 8.9 })).toBe(anchor);
  });

  it("recentres after the player crosses the dead-zone boundary", () => {
    expect(stableCutawayAnchor({ x: 8, y: 4, z: 8 }, { x: 10.4, y: 4, z: 8.2 })).toEqual({ x: 10, y: 4, z: 8 });
  });

  it("recentres immediately when the player changes height", () => {
    expect(stableCutawayAnchor({ x: 8, y: 4, z: 8 }, { x: 8.2, y: 3, z: 8.1 })).toEqual({ x: 8, y: 3, z: 8 });
  });

  it("supports a larger reduced-motion dead zone", () => {
    const anchor = { x: 8, y: 4, z: 8 };
    expect(stableCutawayAnchor(anchor, { x: 11.5, y: 4, z: 8 }, 5)).toBe(anchor);
  });
});
