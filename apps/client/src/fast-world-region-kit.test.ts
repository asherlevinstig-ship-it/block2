import { describe, expect, it } from "vitest";
import {
  FAST_WORLD_VISUAL_CHUNK_SIZE,
  FastWorldVisualChunkStream,
  fastWorldActiveVisualChunkKeys,
  fastWorldRegionVisualChunks,
  fastWorldVisualChunkForPosition,
} from "./fast-world-region-kit.js";

describe("Fast World visual region kit", () => {
  it("cuts Greenwood and Mistfen into reusable 32 metre visual chunks", () => {
    expect(FAST_WORLD_VISUAL_CHUNK_SIZE).toBe(32);
    expect(fastWorldRegionVisualChunks("greenwood")).toHaveLength(6);
    expect(fastWorldRegionVisualChunks("mistfen")).toHaveLength(9);
    for (const chunk of [...fastWorldRegionVisualChunks("greenwood"), ...fastWorldRegionVisualChunks("mistfen")]) {
      expect(chunk.width).toBeGreaterThan(0);
      expect(chunk.width).toBeLessThanOrEqual(32);
      expect(chunk.depth).toBeGreaterThan(0);
      expect(chunk.depth).toBeLessThanOrEqual(32);
    }
  });

  it("loads only nearby scenery and preloads the neighboring ring", () => {
    const greenwoodKey = fastWorldVisualChunkForPosition("greenwood", 116, 130);
    const mistfenKey = fastWorldVisualChunkForPosition("mistfen", 178, 50);
    const active = fastWorldActiveVisualChunkKeys(116, 130);
    expect(active.has(greenwoodKey)).toBe(true);
    expect(active.has(mistfenKey)).toBe(false);
  });

  it("recalculates visibility only after the player crosses a chunk boundary", () => {
    const stream = new FastWorldVisualChunkStream();
    expect(stream.update(116, 130)?.active.size).toBeGreaterThan(0);
    expect(stream.update(119, 131)).toBeNull();
    const changed = stream.update(119, 127);
    expect(changed).not.toBeNull();
    expect(changed!.activated.length + changed!.deactivated.length).toBeGreaterThan(0);
  });
});
