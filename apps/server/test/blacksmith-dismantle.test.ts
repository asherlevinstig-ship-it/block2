import { describe, expect, it, vi } from "vitest";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
import { WorldRoom } from "../src/game-room.js";
import { equipmentReforgeRank, withReforgeRank } from "../src/equipment-reforge.js";

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION); player.coins = 10;
  room.state.players.set("smith", player);
  const client = { sessionId: "smith", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client, dismantle: (payload: unknown) => (room as any).handleBlacksmithDismantle(client, payload) };
}

function own(player: PlayerState, itemId: string, quantity: number) {
  const item = new InventoryItemState(); item.quantity = quantity; player.inventory.set(itemId, item);
}

describe("blacksmith equipment dismantling", () => {
  it("dismantles one duplicate while protecting the equipped copy", () => {
    const { player, client, dismantle } = fixture();
    player.mainHandId = "fang_dagger"; own(player, "fang_dagger", 2);
    dismantle({ itemId: "fang_dagger" });
    expect(player.inventory.get("fang_dagger")?.quantity).toBe(1);
    expect(player.inventory.get("crawler_fang")?.quantity).toBe(1);
    expect(player.coins).toBe(13);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({
      phase: "dismantled", dismantledItemId: "fang_dagger", goldGranted: 3,
      materialGranted: "crawler_fang", materialQuantity: 1,
    }));
  });

  it("refuses to dismantle the last equipped weapon or armour", () => {
    const { player, client, dismantle } = fixture();
    player.armourId = "iron_armour"; own(player, "iron_armour", 1);
    dismantle({ itemId: "iron_armour" });
    expect(player.inventory.get("iron_armour")?.quantity).toBe(1);
    expect(player.coins).toBe(10);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "error", message: expect.stringContaining("protected") }));
  });

  it("dismantles an unequipped final copy and rejects remote requests", () => {
    const { player, client, dismantle } = fixture(); own(player, "stone_core_hammer", 1);
    player.reforgeRanksJson = withReforgeRank("{}", "stone_core_hammer", 2);
    dismantle({ itemId: "stone_core_hammer" });
    expect(player.inventory.get("stone_core_hammer")?.quantity).toBe(0);
    expect(player.inventory.get("stone_core")?.quantity).toBe(1);
    expect(equipmentReforgeRank(player.reforgeRanksJson, "stone_core_hammer")).toBe(0);
    player.x += 20; own(player, "leather_armour", 1);
    dismantle({ itemId: "leather_armour" });
    expect(player.inventory.get("leather_armour")?.quantity).toBe(1);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "error", message: expect.stringContaining("Stand beside") }));
  });
});
