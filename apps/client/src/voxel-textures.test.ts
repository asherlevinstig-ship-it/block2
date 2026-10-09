import { describe, expect, it } from "vitest";
import { Block, CHUNK_HEIGHT, townOfBeginningsBlock } from "@blockcraft/voxel-world";
import { createVoxelTexturePixels, voxelCornerLight, voxelTextureKind, type VoxelTextureKind } from "./voxel-textures.js";

const kinds: VoxelTextureKind[] = ["bedrock", "stone", "dirt", "grass-top", "grass-side", "forest-grass-top", "forest-grass-side", "oak-bark", "oak-rings", "leaves", "iron", "timber", "slate-roof", "paving", "path", "dressed-stone", "bronze"];

describe("procedural voxel textures", () => {
  it("renders silver as a distinct bright blue-white mineral rather than iron", () => {
    expect(voxelTextureKind(Block.SilverOre, 1, 68, 7, 27)).toBe("silver");
    expect(createVoxelTexturePixels("silver")).not.toEqual(createVoxelTexturePixels("iron"));
    expect(createVoxelTexturePixels("silver")).toEqual(createVoxelTexturePixels("silver"));
  });
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

  it("separates warm iron nodules from pale crystalline silver", () => {
    const iron = createVoxelTexturePixels("iron");
    const silver = createVoxelTexturePixels("silver");
    const index = (11 * 32 + 9) * 4;
    expect(iron[index]).toBeGreaterThan(iron[index + 2]!);
    expect(silver[index + 2]).toBeGreaterThanOrEqual(silver[index]!);
    expect(iron).not.toEqual(silver);
  });
  it("gives grass a green top and dirt-backed side", () => {
    const top = createVoxelTexturePixels("grass-top");
    const side = createVoxelTexturePixels("grass-side");
    expect(top[1]).toBeGreaterThan(top[0]!);
    const lowerSideOffset = (24 * 32 + 16) * 4;
    expect(side[lowerSideOffset]).toBeGreaterThan(side[lowerSideOffset + 1]!);
  });

  it("keeps building finishes distinct from mineable wilderness materials", () => {
    expect(voxelTextureKind(Block.Dirt, 0, 8, 7, 20)).toBe("timber");
    expect(voxelTextureKind(Block.Dirt, 0, 0, 10, 18)).toBe("timber");
    expect(voxelTextureKind(Block.Stone, 1, 8, 12, 20)).toBe("slate-roof");
    expect(voxelTextureKind(Block.Stone, 1, 8, 7, 8)).toBe("paving");
    expect(voxelTextureKind(Block.Dirt, 0, 32, 6, 6)).toBe("dirt");
    expect(voxelTextureKind(Block.IronOre, 0, 32, 3, 6)).toBe("iron");
    expect(voxelTextureKind(Block.Grass, 1, 36, 7, 18)).toBe("forest-grass-top");
    expect(voxelTextureKind(Block.OakLog, 0, 36, 8, 18)).toBe("oak-bark");
    expect(voxelTextureKind(Block.OakLog, 1, 36, 10, 18)).toBe("oak-rings");
    expect(voxelTextureKind(Block.Leaves, 0, 36, 11, 18)).toBe("leaves");
  });

  it("shades enclosed voxel corners without darkening open surfaces", () => {
    expect(voxelCornerLight(false, false, false)).toBe(1);
    expect(voxelCornerLight(true, true, false)).toBe(voxelCornerLight(true, true, true));
    expect(voxelCornerLight(true, false, false)).toBeLessThan(1);
    expect(voxelCornerLight(true, false, false)).toBeGreaterThan(voxelCornerLight(true, true, false));
  });

  it("keeps the town lookup bounds inclusive of all authored structures", () => {
    for (let z = -14; z <= 30; z += 1) {
      for (let x = -14; x <= 30; x += 1) {
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
