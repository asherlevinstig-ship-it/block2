import { describe, expect, it } from "vitest";
import { Block, EMBER_VAULT, generateChunk, getBlock, isInEmberVault, isProtectedVoxel, worldToChunk } from "../src/index.js";

describe("Ember Vault", () => {
  const chunks = new Map<string, ReturnType<typeof generateChunk>>();
  const read = (x: number, y: number, z: number) => {
    const address = worldToChunk(x, z); const key = `${address.chunkX},${address.chunkZ}`;
    if (!chunks.has(key)) chunks.set(key, generateChunk("ember-test", address.chunkX, address.chunkZ));
    return getBlock(chunks.get(key)!, address.localX, y, address.localZ);
  };

  it("authors a protected three-room forge with open connecting doors", () => {
    expect(isInEmberVault(212.5, 165.5)).toBe(true);
    expect(isProtectedVoxel(228, 165)).toBe(true);
    expect(read(212, 7, 165)).toBe(Block.Stone);
    expect(read(212, 8, EMBER_VAULT.minZ)).toBe(Block.Bedrock);
    expect(read(223, 8, 165)).toBe(Block.Air);
    expect(read(232, 8, 165)).toBe(Block.Air);
    expect(read(228, 8, 160)).toBe(Block.IronOre);
  });

  it("uses visible hot lanes and a bedrock perimeter instead of an open map edge", () => {
    expect(read(218, 7, 159)).toBe(Block.IronOre);
    expect(read(227, 7, 163)).toBe(Block.IronOre);
    expect(read(EMBER_VAULT.minX - 2, 7, 165)).toBe(Block.Bedrock);
    expect(read(EMBER_VAULT.maxX + 2, 8, 165)).toBe(Block.Air);
  });
});
