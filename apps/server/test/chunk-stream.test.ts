import { describe, expect, it } from "vitest";
import { WorldRoom } from "../src/game-room.js";

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
  const known = Array.from({ length: 25 }, (_, i) => ({ chunkX: i % 5 - 2, chunkZ: Math.floor(i / 5) - 2, revision: 2 }));
  it("does not resend a fully cached region", () => {
    expect(requestRegion(known)?.chunks).toHaveLength(0);
  });
  it("sends only the five new chunks crossing a boundary", () => {
    const chunks = requestRegion(known, 1)?.chunks;
    expect(chunks).toHaveLength(5);
    expect(chunks?.every(chunk => chunk.chunkX === 3)).toBe(true);
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
