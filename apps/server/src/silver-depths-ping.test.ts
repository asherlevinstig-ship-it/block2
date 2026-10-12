import { describe, expect, it, vi } from "vitest";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

describe("Silver Depths party pings", () => {
  function dungeon() {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "silver-depths";
    const leader = { sessionId: "leader", send: vi.fn() };
    const ally = { sessionId: "ally", send: vi.fn() };
    internal.clients.push(leader, ally);
    for (const [id, name] of [["leader", "Leader"], ["ally", "Ally"]] as const) {
      const player = new PlayerState();
      player.name = name; player.y = 1; player.health = 5;
      room.state.players.set(id, player);
      internal.silverDepthsRoster.set(id, name);
      internal.silverDepthsRuns.set(id, { completedAt: 0 });
    }
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
    return { room, internal, leader, ally, broadcast };
  }

  it("broadcasts a server-named, cell-centred ping and rate-limits repeats", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    try {
      const { internal, leader, broadcast } = dungeon();
      internal.handleSilverDepthsPing(leader, { x: 95.1, z: 14.2, senderName: "Forged" });
      expect(broadcast).not.toHaveBeenCalled();
      internal.handleSilverDepthsPing(leader, { x: 95.1, z: 14.2 });
      expect(broadcast).toHaveBeenCalledWith("depths:ping", { senderId: "leader", senderName: "Leader", x: 95.5, z: 14.5, durationMs: 8000 });
      internal.handleSilverDepthsPing(leader, { x: 96.5, z: 14.5 });
      expect(broadcast).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1500);
      internal.handleSilverDepthsPing(leader, { x: 96.5, z: 14.5 });
      expect(broadcast).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it("rejects void clicks, dead or fallen members, outsiders, and overworld messages", () => {
    const { room, internal, leader, broadcast } = dungeon();
    internal.handleSilverDepthsPing(leader, { x: 75.5, z: -10.5 });
    internal.handleSilverDepthsPing(leader, { x: Infinity, z: 14.5 });
    internal.handleSilverDepthsPing({ sessionId: "outsider" }, { x: 95.5, z: 14.5 });
    internal.silverDepthsFallen.add("leader");
    internal.handleSilverDepthsPing(leader, { x: 95.5, z: 14.5 });
    internal.silverDepthsFallen.delete("leader");
    room.state.players.get("leader")!.health = 0;
    internal.handleSilverDepthsPing(leader, { x: 95.5, z: 14.5 });
    room.state.players.get("leader")!.health = 5;
    internal.roomKind = "overworld";
    internal.handleSilverDepthsPing(leader, { x: 95.5, z: 14.5 });
    expect(broadcast).not.toHaveBeenCalled();
  });
});
