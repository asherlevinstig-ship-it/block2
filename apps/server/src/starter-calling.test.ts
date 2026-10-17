import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { WORLD_SAFE_CENTER } from "./radial-difficulty.js";
import { parseBuildPathState } from "./build-paths.js";

describe("starter Calling choice", () => {
  it.each([
    ["mage", "magic_focus"],
    ["ranger", "bow"],
    ["tank", "longsword"],
  ] as const)("lets a level-1 player choose %s and equips the appropriate starter weapon", (pathId, handId) => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState();
    Object.assign(player, { x: WORLD_SAFE_CENTER.x, z: WORLD_SAFE_CENTER.z, level: 1 });
    room.state.players.set("newcomer", player);
    const client = { sessionId: "newcomer", send: vi.fn() } as any;
    internal.handleBuildPath(client, { action: "sync" });
    const update = client.send.mock.calls.find(([name]: [string]) => name === "build:path")?.[1];
    expect(update.canChoose).toBe(true);
    expect(update.candidates.map((candidate: { pathId: string }) => candidate.pathId).sort())
      .toEqual(["assassin", "healer", "mage", "ranger", "tank", "thief"]);
    internal.handleBuildPath(client, { action: "choose", pathId });
    expect(parseBuildPathState(player.huntLoadoutsJson).selectedPathId).toBe(pathId);
    expect(player.mainHandId).toBe(handId);
  });

  it("lets an unbound player choose Assassin in the wilderness but requires Town to switch", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState();
    Object.assign(player, { x: WORLD_SAFE_CENTER.x + 100, z: WORLD_SAFE_CENTER.z, level: 2 });
    room.state.players.set("newcomer", player);
    const client = { sessionId: "newcomer", send: vi.fn() } as any;
    internal.handleBuildPath(client, { action: "sync" });
    expect(client.send.mock.lastCall?.[1].canChoose).toBe(true);
    expect(client.send.mock.lastCall?.[1].inTown).toBe(false);
    internal.handleBuildPath(client, { action: "choose", pathId: "assassin" });
    expect(parseBuildPathState(player.huntLoadoutsJson).selectedPathId).toBe("assassin");
    expect(client.send.mock.lastCall?.[1].canChoose).toBe(false);
    internal.handleBuildPath(client, { action: "choose", pathId: "mage" });
    expect(parseBuildPathState(player.huntLoadoutsJson).selectedPathId).toBe("assassin");
    Object.assign(player, { x: WORLD_SAFE_CENTER.x, z: WORLD_SAFE_CENTER.z });
    internal.handleBuildPath(client, { action: "choose", pathId: "mage" });
    expect(parseBuildPathState(player.huntLoadoutsJson).selectedPathId).toBe("mage");
  });
});
