import { describe, expect, it } from "vitest";
import { WorldRoom } from "../src/game-room.js";
import { WORLD_STREAM_CHUNK_RADIUS } from "@blockcraft/protocol";

function requestRegion(knownChunks: { chunkX: number; chunkZ: number; revision: number }[], centerX = 0) {
  let result: { chunks: { chunkX: number; chunkZ: number; revision: number }[] } | undefined;
  const context = {
    state: { players: new Map([["test", { x: 8.5, z: 8.5 }]]) },
    getChunk: () => ({ revision: 2 }),
    snapshot: (chunkX: number, chunkZ: number) => ({ chunkX, chunkZ, revision: 2, blocks: [] }),
  };
  const handler = (WorldRoom.prototype as unknown as {
    handleChunkRegionRequest: (client: unknown, request: unknown) => void;
  }).handleChunkRegionRequest;
  handler.call(context, { sessionId: "test", send: (_type: string, payload: typeof result) => { result = payload; } },
    { chunkX: centerX, chunkZ: 0, knownChunks });
  return result;
}

describe("incremental terrain streaming", () => {
  const diameter = WORLD_STREAM_CHUNK_RADIUS * 2 + 1;
  const known = Array.from({ length: diameter ** 2 }, (_, i) => ({
    chunkX: i % diameter - WORLD_STREAM_CHUNK_RADIUS,
    chunkZ: Math.floor(i / diameter) - WORLD_STREAM_CHUNK_RADIUS,
    revision: 2,
  }));
  it("does not resend a fully cached region", () => {
    expect(requestRegion(known)?.chunks).toHaveLength(0);
  });
  it("sends only one new chunk column crossing a boundary", () => {
    const chunks = requestRegion(known, 1)?.chunks;
    expect(chunks).toHaveLength(diameter);
    expect(chunks?.every(chunk => chunk.chunkX === WORLD_STREAM_CHUNK_RADIUS + 1)).toBe(true);
  });
  it("resends changed or evicted chunks", () => {
    expect(requestRegion(known.map(chunk => ({ ...chunk, revision: chunk.chunkX === 0 && chunk.chunkZ === 0 ? 1 : 2 })))?.chunks)
      .toEqual([{ chunkX: 0, chunkZ: 0, revision: 2, blocks: [] }]);
    expect(requestRegion(known.slice(1))?.chunks).toHaveLength(1);
  });
  it("rejects remote region requests and oversized cache advertisements", () => {
    expect(requestRegion(known, 3)).toBeUndefined();
    expect(requestRegion(Array.from({ length: 122 }, () => known[0]!))).toBeUndefined();
  });
});
