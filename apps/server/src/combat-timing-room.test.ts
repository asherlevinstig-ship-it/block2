import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

afterEach(() => vi.restoreAllMocks());

describe("owner-only combat timing", () => {
  it("correlates an accepted attack with its authoritative miss", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const player = new PlayerState(); Object.assign(player, { x: 40.5, y: 8, z: 18.5 });
    room.state.players.set("hero", player);
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    const client = { sessionId: "hero", send: vi.fn() } as any;
    room.clients.push(client);
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const internal = room as any;
    internal.handleAttack(client, { requestId: "attack-1", yaw: 90 });
    internal.resolvePendingAttacks(10_500);
    const timings = client.send.mock.calls.filter(([type]: [string]) => type === "combat:timing")
      .map(([, event]: [string, Record<string, unknown>]) => event);
    expect(timings).toMatchObject([
      { requestId: "attack-1", action: "attack", phase: "accepted", serverTime: 10_000, scheduledAt: 10_135 },
      { requestId: "attack-1", action: "attack", phase: "released", serverTime: 10_500 },
      { requestId: "attack-1", action: "attack", phase: "resolved", serverTime: 10_500, outcome: "miss" },
    ]);
  });

  it("does not send timing to another player", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const owner = { sessionId: "hero", send: vi.fn() } as any;
    const other = { sessionId: "other", send: vi.fn() } as any;
    room.clients.push(owner, other);
    (room as any).sendCombatTiming("hero", { requestId: "attack-1", action: "attack", phase: "accepted", serverTime: 10_000 });
    expect(owner.send).toHaveBeenCalledOnce();
    expect(other.send).not.toHaveBeenCalled();
  });

  it("uses only a capped part of a delayed attack message", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const player = new PlayerState(); Object.assign(player, { x: 40.5, y: 8, z: 18.5 });
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() } as any;
    room.clients.push(client);
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    (room as any).handleAttack(client, { requestId: "delayed", yaw: 90, actionAt: 9_800 });
    expect((room as any).pendingAttacks.get("hero").impactAt).toBe(10_035);
    expect((room as any).attackChains.get("hero").recoveryUntil).toBeLessThan(10_000 + 600);
    expect(client.send).toHaveBeenCalledWith("combat:timing", expect.objectContaining({
      requestId: "delayed", scheduledAt: 10_035,
    }));
  });
});
