import { describe, expect, it, vi } from "vitest";
import { TOWN_EXPEDITION_BOARD_POSITION } from "@blockcraft/voxel-world";
import { decodeLootBagItems, type RealmHuntBoardUpdate } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { HUNT_PATHS, beginHuntContract, huntContractTargets } from "./hunt-contracts.js";

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
      expect(initial.contract).toBeNull();
      expect(initial.hunts.find(hunt => hunt.mobId === "moss-crawler")).toMatchObject({
        status: "empowered", rematchTier: 2, modifier: "armoured", relicCount: 2, forgeName: "Alpha Fang",
      });

      internal.handleRealmHuntBoard(client, { action: "select", mobId: "moss-crawler" });
      const selected = client.send.mock.calls.filter(call => call[0] === "realm-hunt:board").at(-1)?.[1] as RealmHuntBoardUpdate;
      expect(selected.selectedMobId).toBe("moss-crawler");
      expect(internal.selectedRealmHunts.get("hunter")).toBe("moss-crawler");
    } finally { vi.useRealTimers(); }
  });

  it("rotates three escalating leaders into a tier-five Path Champion and large personal cache", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    const player = new PlayerState(); Object.assign(player, TOWN_EXPEDITION_BOARD_POSITION);
    room.state.players.set("hunter", player);
    const client = { sessionId: "hunter", send: vi.fn() }; internal.clients.push(client);
    const targets = huntContractTargets("fang", 0);
    for (const [index, id] of targets.entries()) {
      const mob = new MobState(); Object.assign(mob, { name: id, isMiniBoss: true, x: 42.5 + index * 5, y: 8, z: 18.5 });
      room.state.mobs.set(id, mob); internal.mobHomes.set(id, { x: mob.x, y: mob.y, z: mob.z });
    }

    internal.handleRealmHuntBoard(client, { action: "contract", pathId: "fang" });
    expect(internal.huntContracts.get("hunter")).toMatchObject({ pathId: "fang", step: 0, targetMobId: targets[0] });
    expect(room.state.mobs.get(targets[0]!)!.leaderRematchTier).toBe(2);
    internal.advancePlayerHuntContract("hunter", targets[0]!, room.state.mobs.get(targets[0]!)!, 10_000);
    expect(internal.huntContracts.get("hunter")).toMatchObject({ step: 1, targetMobId: targets[1], modifier: "relentless" });
    expect(room.state.mobs.get(targets[1]!)!.leaderRematchTier).toBe(3);
    internal.advancePlayerHuntContract("hunter", targets[1]!, room.state.mobs.get(targets[1]!)!, 11_000);
    internal.advancePlayerHuntContract("hunter", targets[2]!, room.state.mobs.get(targets[2]!)!, 12_000);

    const contract = internal.huntContracts.get("hunter");
    expect(contract).toMatchObject({ step: 3, championActive: true, modifier: HUNT_PATHS.fang.championModifier });
    const champion = room.state.mobs.get(contract.championMobId)!;
    expect(champion).toMatchObject({ name: HUNT_PATHS.fang.championName, isChampion: true, isMiniBoss: true,
      leaderRematchTier: 5, leaderModifier: HUNT_PATHS.fang.championModifier });
    internal.spawnLootDrops(contract.championMobId, champion, 13_000, "hunter");
    const cache = [...room.state.lootDrops.values()].at(-1)!;
    expect(decodeLootBagItems(cache.contentsJson)).toEqual(expect.arrayContaining([
      { itemId: "fang_dagger", quantity: 1 }, { itemId: "crawler_fang", quantity: 6 }, { itemId: "moss_fibre", quantity: 6 },
    ]));
    internal.advancePlayerHuntContract("hunter", contract.championMobId, champion, 14_000);
    expect(internal.huntContracts.get("hunter")).toMatchObject({ completed: true, championActive: false });
    expect(internal.huntContractCycles.get("hunter").fang).toBe(1);
  });

  it("rotates later contracts through different leaders", () => {
    expect(huntContractTargets("venom", 1)).not.toEqual(beginHuntContract("venom", 0).targets);
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
