import { describe, expect, it } from "vitest";
import { isVoxelHiddenForPlayer, type PlayerCutaway } from "./player-visibility.js";

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
});
