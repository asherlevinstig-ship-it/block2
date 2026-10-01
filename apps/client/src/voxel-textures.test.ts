import { describe, expect, it } from "vitest";
import { createVoxelTexturePixels, type VoxelTextureKind } from "./voxel-textures.js";

const kinds: VoxelTextureKind[] = ["bedrock", "stone", "dirt", "grass-top", "grass-side", "iron"];

describe("procedural voxel textures", () => {
  it("generates deterministic opaque pixel maps with visible variation", () => {
    for (const kind of kinds) {
      const first = createVoxelTexturePixels(kind);
      const second = createVoxelTexturePixels(kind);
      expect(first).toEqual(second);
      expect(first).toHaveLength(16 * 16 * 4);
      expect(new Set(Array.from(first).filter((_, index) => index % 4 !== 3)).size).toBeGreaterThan(4);
      for (let index = 3; index < first.length; index += 4) expect(first[index]).toBe(255);
    }
  });

  it("gives grass a green top and dirt-backed side", () => {
    const top = createVoxelTexturePixels("grass-top");
    const side = createVoxelTexturePixels("grass-side");
    expect(top[1]).toBeGreaterThan(top[0]!);
    const lowerSideOffset = (12 * 16 + 8) * 4;
    expect(side[lowerSideOffset]).toBeGreaterThan(side[lowerSideOffset + 1]!);
  });
});
