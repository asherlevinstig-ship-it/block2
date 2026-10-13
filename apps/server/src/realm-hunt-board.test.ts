import { describe, expect, it, vi } from "vitest";
import { TOWN_EXPEDITION_BOARD_POSITION } from "@blockcraft/voxel-world";
import type { RealmHuntBoardUpdate } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";

describe("Realm Hunt Board", () => {
  it("lists every leader, reports relic progress, and selects one tracked hunt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    try {
      const room = new WorldRoom(); room.setState(new WorldState());
      const internal = room as any;
      internal.roomKind = "overworld";
      const player = new PlayerState();
      Object.assign(player, TOWN_EXPEDITION_BOARD_POSITION);
      const relics = new InventoryItemState(); relics.quantity = 2;
      player.inventory.set("mossback_fang_relic", relics);
      room.state.players.set("hunter", player);

      const mossback = new MobState();
      Object.assign(mossback, { name: "Mossback Alpha", isMiniBoss: true, alive: true,
        leaderRematchTier: 2, leaderModifier: "armoured", x: 48.5, y: 8, z: 26.5 });
      room.state.mobs.set("moss-crawler", mossback);
      internal.mobHomes.set("moss-crawler", { x: 48.5, y: 8, z: 26.5 });

      const client = { sessionId: "hunter", send: vi.fn() };
      internal.handleRealmHuntBoard(client, { action: "sync" });
      const initial = client.send.mock.calls.find(call => call[0] === "realm-hunt:board")?.[1] as RealmHuntBoardUpdate;
      expect(initial.hunts).toHaveLength(18);
      expect(initial.hunts.find(hunt => hunt.mobId === "moss-crawler")).toMatchObject({
        status: "empowered", rematchTier: 2, modifier: "armoured", relicCount: 2, forgeName: "Alpha Fang",
      });

      internal.handleRealmHuntBoard(client, { action: "select", mobId: "moss-crawler" });
      const selected = client.send.mock.calls.filter(call => call[0] === "realm-hunt:board").at(-1)?.[1] as RealmHuntBoardUpdate;
      expect(selected.selectedMobId).toBe("moss-crawler");
      expect(internal.selectedRealmHunts.get("hunter")).toBe("moss-crawler");
    } finally { vi.useRealTimers(); }
  });

  it("requires the town board before changing hunts", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    const player = new PlayerState(); Object.assign(player, { x: 100, y: 8, z: 100 });
    room.state.players.set("hunter", player);
    const client = { sessionId: "hunter", send: vi.fn() };
    internal.handleRealmHuntBoard(client, { action: "select", mobId: "moss-crawler" });
    expect(internal.selectedRealmHunts.has("hunter")).toBe(false);
    expect(client.send).toHaveBeenCalledWith("realm-hunt:board", expect.objectContaining({
      message: expect.stringContaining("Return to the Realm Hunt Board"),
    }));
  });
});
