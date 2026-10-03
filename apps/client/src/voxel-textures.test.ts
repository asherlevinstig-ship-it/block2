import { describe, expect, it } from "vitest";
import { Block, CHUNK_HEIGHT, townOfBeginningsBlock } from "@blockcraft/voxel-world";
import { createVoxelTexturePixels, voxelCornerLight, voxelTextureKind, type VoxelTextureKind } from "./voxel-textures.js";

const kinds: VoxelTextureKind[] = ["bedrock", "stone", "dirt", "grass-top", "grass-side", "iron", "timber", "slate-roof", "paving", "path", "dressed-stone", "bronze"];

describe("procedural voxel textures", () => {
  it("generates deterministic opaque pixel maps with visible variation", () => {
    for (const kind of kinds) {
      const first = createVoxelTexturePixels(kind);
      const second = createVoxelTexturePixels(kind);
      expect(first).toEqual(second);
      expect(first).toHaveLength(32 * 32 * 4);
      expect(new Set(Array.from(first).filter((_, index) => index % 4 !== 3)).size).toBeGreaterThan(4);
      for (let index = 3; index < first.length; index += 4) expect(first[index]).toBe(255);
    }
  });

  it("gives grass a green top and dirt-backed side", () => {
    const top = createVoxelTexturePixels("grass-top");
    const side = createVoxelTexturePixels("grass-side");
    expect(top[1]).toBeGreaterThan(top[0]!);
    const lowerSideOffset = (24 * 32 + 16) * 4;
    expect(side[lowerSideOffset]).toBeGreaterThan(side[lowerSideOffset + 1]!);
  });

  it("keeps building finishes distinct from mineable wilderness materials", () => {
    expect(voxelTextureKind(Block.Dirt, 0, 2, 8, 4)).toBe("timber");
    expect(voxelTextureKind(Block.Stone, 1, 2, 10, 4)).toBe("slate-roof");
    expect(voxelTextureKind(Block.Stone, 1, 8, 7, 8)).toBe("paving");
    expect(voxelTextureKind(Block.Dirt, 0, 22, 6, 6)).toBe("dirt");
    expect(voxelTextureKind(Block.IronOre, 0, 22, 3, 6)).toBe("iron");
  });

  it("shades enclosed voxel corners without darkening open surfaces", () => {
    expect(voxelCornerLight(false, false, false)).toBe(1);
    expect(voxelCornerLight(true, true, false)).toBe(voxelCornerLight(true, true, true));
    expect(voxelCornerLight(true, false, false)).toBeLessThan(1);
    expect(voxelCornerLight(true, false, false)).toBeGreaterThan(voxelCornerLight(true, true, false));
  });

  it("keeps the town lookup bounds inclusive of all authored structures", () => {
    for (let z = -2; z <= 20; z += 1) {
      for (let x = -2; x <= 20; x += 1) {
        for (let y = 0; y < CHUNK_HEIGHT; y += 1) {
          const block = townOfBeginningsBlock(x, y, z);
          if (block === null || block === Block.Air) continue;
          const kind = voxelTextureKind(block, 1, x, y, z);
          expect(["timber", "path", "bronze", "slate-roof", "paving", "dressed-stone"]).toContain(kind);
        }
      }
    }
  });

  it("uses wilderness materials beyond every town boundary", () => {
    for (const [x, y, z] of [[0, 8, 8], [17, 8, 8], [8, 8, 0], [8, 8, 17], [8, 6, 8], [8, 12, 8]]) {
      expect(voxelTextureKind(Block.Stone, 1, x!, y!, z!)).toBe("stone");
      expect(voxelTextureKind(Block.Dirt, 0, x!, y!, z!)).toBe("dirt");
      expect(voxelTextureKind(Block.IronOre, 0, x!, y!, z!)).toBe("iron");
    }
  });
});
