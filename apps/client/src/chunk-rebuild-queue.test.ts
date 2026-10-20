import { describe, expect, it } from "vitest";
import { nearestQueuedChunkKey } from "./chunk-rebuild-queue.js";

describe("chunk rebuild queue", () => {
  it("prioritizes the chunk nearest the player", () => {
    const queued = new Map([
      ["7,7", { chunkX: 7, chunkZ: 7 }],
      ["2,3", { chunkX: 2, chunkZ: 3 }],
      ["4,3", { chunkX: 4, chunkZ: 3 }],
    ]);
    expect(nearestQueuedChunkKey(queued, { chunkX: 3, chunkZ: 3 })).toBe("2,3");
  });

  it("uses a stable key order when chunks are equally close", () => {
    const queued = new Map([
      ["4,3", { chunkX: 4, chunkZ: 3 }],
      ["2,3", { chunkX: 2, chunkZ: 3 }],
    ]);
    expect(nearestQueuedChunkKey(queued, { chunkX: 3, chunkZ: 3 })).toBe("2,3");
  });

  it("returns null for an empty queue", () => {
    expect(nearestQueuedChunkKey(new Map(), { chunkX: 0, chunkZ: 0 })).toBeNull();
  });
});
