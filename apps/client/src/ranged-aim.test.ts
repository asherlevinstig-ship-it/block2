import { describe, expect, it } from "vitest";
import { rangedAimYaw } from "./ranged-aim.js";
describe("ranged mouse aim", () => {
  const player = { x: 0, y: 8, z: 0 };
  it("projects pointer rays independently of movement or nearby enemies", () => {
    expect(rangedAimYaw({ x: 5, y: 20, z: 0 }, { x: 5, y: 0, z: 0 }, player, 0)).toBe(90);
    expect(rangedAimYaw({ x: 0, y: 20, z: -5 }, { x: 0, y: 0, z: -5 }, player, 90)).toBe(180);
    expect(rangedAimYaw({ x: -5, y: 20, z: 5 }, { x: -5, y: 0, z: 5 }, player, 0)).toBe(-45);
  });
  it("uses the player's current shot-height plane when underground", () => {
    expect(rangedAimYaw({ x: 0, y: 20, z: 0 }, { x: 10, y: 0, z: 10 }, { ...player, y: 1 }, 0)).toBe(45);
  });
  it("keeps facing for parallel, behind-camera and near-player rays", () => {
    expect(rangedAimYaw({ x: 0, y: 20, z: 0 }, { x: 5, y: 20, z: 5 }, player, 33)).toBe(33);
    expect(rangedAimYaw({ x: 0, y: 20, z: 0 }, { x: 5, y: 30, z: 5 }, player, 33)).toBe(33);
    expect(rangedAimYaw({ x: 0, y: 20, z: 0 }, { x: 0, y: 0, z: 0 }, player, 33)).toBe(33);
  });
});
