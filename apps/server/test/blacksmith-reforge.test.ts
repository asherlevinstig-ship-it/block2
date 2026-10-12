import { describe, expect, it, vi } from "vitest";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
import { WorldRoom } from "../src/game-room.js";
import { equipmentReforgeRank } from "../src/equipment-reforge.js";

function own(player: PlayerState, itemId: string, quantity: number) {
  const item = new InventoryItemState(); item.quantity = quantity; player.inventory.set(itemId, item);
}

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION); player.coins = 100;
  own(player, "fang_dagger", 1); own(player, "crawler_fang", 10);
  room.state.players.set("smith", player);
  const client = { sessionId: "smith", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { player, client, reforge: (payload: unknown) => (room as any).handleBlacksmithReforge(client, payload) };
}

describe("blacksmith reforging", () => {
  it("spends the fixed recipe and advances the owned weapon one rank", () => {
    const { player, client, reforge } = fixture();
    reforge({ itemId: "fang_dagger" });
    expect(player.coins).toBe(90);
    expect(player.inventory.get("crawler_fang")?.quantity).toBe(8);
    expect(equipmentReforgeRank(player.reforgeRanksJson, "fang_dagger")).toBe(1);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({
      phase: "reforged", reforgedItemId: "fang_dagger", reforgeRanks: { fang_dagger: 1 },
    }));
  });

  it("does not spend anything when materials are insufficient", () => {
    const { player, client, reforge } = fixture();
    player.inventory.get("crawler_fang")!.quantity = 1;
    reforge({ itemId: "fang_dagger" });
    expect(player.coins).toBe(100);
    expect(equipmentReforgeRank(player.reforgeRanksJson, "fang_dagger")).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "error" }));
  });

  it("requires ownership and the blacksmith location", () => {
    const { player, client, reforge } = fixture();
    player.x += 20;
    reforge({ itemId: "fang_dagger" });
    expect(equipmentReforgeRank(player.reforgeRanksJson, "fang_dagger")).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ message: expect.stringContaining("Stand beside") }));
  });
});
