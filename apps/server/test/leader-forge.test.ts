import { describe, expect, it, vi } from "vitest";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { InventoryItemState, MobState, PlayerState, WorldState } from "../src/schema.js";
import { WorldRoom } from "../src/game-room.js";

function own(player: PlayerState, itemId: string, quantity: number) {
  const item = new InventoryItemState(); item.quantity = quantity; player.inventory.set(itemId, item);
}

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION); player.coins = 20;
  room.state.players.set("smith", player);
  const client = { sessionId: "smith", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client, forge: (payload: unknown) => (room as any).handleLeaderForge(client, payload) };
}

describe("leader forge", () => {
  it("consumes three matching relics and records a permanent collection mark", () => {
    const { player, client, forge } = fixture();
    own(player, "fang_dagger", 1); own(player, "mossback_fang_relic", 3);
    forge({ relicId: "mossback_fang_relic", action: "awaken" });
    expect(player.inventory.get("mossback_fang_relic")?.quantity).toBe(0);
    expect(player.inventory.get("alpha_forgemark")?.quantity).toBe(1);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({
      phase: "awakened", leaderRelics: expect.objectContaining({ mossback_fang_relic: 0 }),
      leaderMarks: expect.objectContaining({ alpha_forgemark: 1 }),
    }));
  });

  it("exchanges spare relics only after the matching mark is awakened", () => {
    const { player, client, forge } = fixture();
    own(player, "alpha_forgemark", 1); own(player, "mossback_fang_relic", 2);
    forge({ relicId: "mossback_fang_relic", action: "exchange" });
    expect(player.inventory.get("mossback_fang_relic")?.quantity).toBe(1);
    expect(player.coins).toBe(32);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "exchanged", goldGranted: 12 }));
  });

  it("requires the matching weapon and all three relics", () => {
    const { player, client, forge } = fixture();
    own(player, "mossback_fang_relic", 3);
    forge({ relicId: "mossback_fang_relic", action: "awaken" });
    expect(player.inventory.get("mossback_fang_relic")?.quantity).toBe(3);
    expect(player.inventory.get("alpha_forgemark")).toBeUndefined();
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "error", message: expect.stringContaining("Crawler Fang Dagger") }));
  });

  it("adds awakened damage and labels the triggered combat perk", () => {
    const { room, player } = fixture();
    own(player, "fang_dagger", 1); own(player, "alpha_forgemark", 1);
    Object.assign(player, { x: 0, y: 8, z: 0 });
    const mob = new MobState(); Object.assign(mob, { x: 1, y: 8, z: 0, health: 20, maxHealth: 20, armor: 0 });
    room.state.mobs.set("target", mob);
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => room as any);
    (room as any).applyWeaponHit("smith", { mainHandId: "fang_dagger", step: 3 }, "target", 10_000);
    expect(broadcast).toHaveBeenCalledWith("combat:hit", expect.objectContaining({ perk: "alpha_finish" }));
    expect(mob.health).toBe(17);
  });
});
