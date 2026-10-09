import { describe, expect, it } from "vitest";
import { Block, WILDERNESS_CAMPS, SURFACE_HEIGHT, generateChunk, getBlock, worldToChunk, playerCollides,
  isPlayerSupported, voxelRaycast, wildernessCampBlock, type WorldBlockReader, type GeneratedChunk } from "../src/index.js";
function reader(seed: string): WorldBlockReader {
  const chunks = new Map<string, GeneratedChunk>();
  return (x, y, z) => {
    const address = worldToChunk(x, z); const key = `${address.chunkX},${address.chunkZ}`;
    let chunk = chunks.get(key);
    if (!chunk) { chunk = generateChunk(seed, address.chunkX, address.chunkZ); chunks.set(key, chunk); }
    return getBlock(chunk, address.localX, y, address.localZ);
  };
}
describe("readable deposit camps", () => {
  it("assigns nests, spitter cover and ruins to the right mineral sites", () => {
    expect(WILDERNESS_CAMPS.filter(camp => camp.kind === "nest")).toHaveLength(3);
    expect(WILDERNESS_CAMPS.filter(camp => camp.kind === "spitter")).toHaveLength(2);
    expect(WILDERNESS_CAMPS.filter(camp => camp.kind === "ruin")).toHaveLength(2);
  });
  it.each(["camp-test-a", "camp-test-b"])("preserves every ore cell and four walkable approaches for %s", seed => {
    const read = reader(seed);
    for (const camp of WILDERNESS_CAMPS) {
      for (let dx = -camp.radius; dx <= camp.radius; dx++) for (let dz = -camp.radius; dz <= camp.radius; dz++) {
        expect(read(camp.x + dx, SURFACE_HEIGHT, camp.z + dz)).toBe(camp.block);
        expect(read(camp.x + dx, SURFACE_HEIGHT - 1, camp.z + dz)).toBe(camp.block);
        expect(read(camp.x + dx, 8, camp.z + dz)).toBe(Block.Air);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let step = 0; step <= camp.radius + 3; step++) {
        const x = camp.x + dx! * step + .5; const z = camp.z + dz! * step + .5;
        expect(playerCollides(read, x, 8, z)).toBe(false);
        expect(isPlayerSupported(read, x, 8, z)).toBe(true);
      }
    }
  });
  it("generates solid projectile-blocking cover, not just decorative meshes", () => {
    const read = reader("camp-cover");
    for (const camp of WILDERNESS_CAMPS.filter(c => c.kind !== "nest")) {
      const dx = camp.kind === "spitter" ? 3 : 4;
      const dz = camp.kind === "spitter" ? 2 : 4;
      const x = camp.x + dx; const z = camp.z + dz;
      expect(read(x, 8, z)).toBe(Block.Stone); expect(read(x, 9, z)).toBe(Block.Stone);
      expect(playerCollides(read, x + .5, 8, z + .5)).toBe(true);
      const hit = voxelRaycast({ x: x - 1, y: 8.8, z: z + .5 }, { x: 1, y: 0, z: 0 }, 3, read);
      expect(hit?.x).toBe(x);
    }
  });
  it("never alters underground or town terrain", () => {
    for (const camp of WILDERNESS_CAMPS) expect(wildernessCampBlock(camp.x + 3, 6, camp.z + 3)).toBeNull();
    expect(wildernessCampBlock(8, 8, 8)).toBeNull();
  });
});
