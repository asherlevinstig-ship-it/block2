import { describe, expect, it } from "vitest";
import {
  isBelowSurroundingSurface,
  isVoxelHiddenForPlayer,
  loweredSliceHeight,
  shouldReleaseDepthSlice,
  shouldUseDepthSlice,
  type PlayerCutaway,
} from "./player-visibility.js";

const underground: PlayerCutaway = {
  active: true,
  sliceY: 5,
};

describe("underground player visibility", () => {
  it("preserves the floor supporting the player", () => {
    expect(isVoxelHiddenForPlayer(8, 3, 8, underground)).toBe(false);
    expect(isVoxelHiddenForPlayer(10, 3, 10, underground)).toBe(false);
  });

  it("removes every block at and above the selected slice", () => {
    expect(isVoxelHiddenForPlayer(8, 5, 8, underground)).toBe(true);
    expect(isVoxelHiddenForPlayer(100, 9, -100, underground)).toBe(true);
    expect(isVoxelHiddenForPlayer(10, 4, 10, underground)).toBe(false);
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

  it("keeps the slice fixed while the player stays at the same height", () => {
    expect(loweredSliceHeight(5, 4.4)).toBe(5);
  });

  it("does not raise the slice when the player climbs", () => {
    expect(loweredSliceHeight(5, 8)).toBe(5);
  });

  it("lowers the slice by whole voxel levels as the player descends", () => {
    expect(loweredSliceHeight(5, 2.4)).toBe(3);
  });

  it("chooses the initial slice from the player's height", () => {
    expect(loweredSliceHeight(null, 4)).toBe(5);
  });

  it("keeps an active slice latched when mining removes the ceiling", () => {
    expect(shouldUseDepthSlice(5, 3, 8, false, false)).toBe(true);
  });

  it("does not let an excavation detector activate a slice while walking flat", () => {
    expect(shouldUseDepthSlice(null, 8, 8, false, true)).toBe(false);
  });

  it("keeps an active slice latched through a temporary surface correction", () => {
    expect(shouldUseDepthSlice(5, 8, 8, false, false)).toBe(true);
    expect(shouldReleaseDepthSlice(8, 8, false, true, 400)).toBe(false);
  });

  it("releases only after a sustained, supported return to the surface", () => {
    expect(shouldReleaseDepthSlice(8, 8, false, true, 1200)).toBe(true);
    expect(shouldReleaseDepthSlice(8, 8, true, true, 2000)).toBe(false);
    expect(shouldReleaseDepthSlice(8, 8, false, false, 2000)).toBe(false);
  });
});
