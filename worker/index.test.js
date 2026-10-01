import { describe, expect, it } from "vitest";
import { colyseusUpstreamUrl, isAllowedGameRequest } from "./index.js";

describe("Colyseus production relay", () => {
  it("rewrites the same-origin matchmaking route to Colyseus Cloud", () => {
    expect(colyseusUpstreamUrl("https://block2.example/game/matchmake/joinOrCreate/world?x=1").toString())
      .toBe("https://us-mia-ea26ba04.colyseus.cloud/matchmake/joinOrCreate/world?x=1");
  });

  it("allows matchmaking, health checks, and websocket upgrades only", () => {
    expect(isAllowedGameRequest(new Request("https://block2.example/game/health"))).toBe(true);
    expect(isAllowedGameRequest(new Request("https://block2.example/game/matchmake/joinOrCreate/world"))).toBe(true);
    expect(isAllowedGameRequest(new Request("https://block2.example/game/process/room", {
      headers: { Upgrade: "websocket" },
    }))).toBe(true);
    expect(isAllowedGameRequest(new Request("https://block2.example/game/private"))).toBe(false);
  });
});
