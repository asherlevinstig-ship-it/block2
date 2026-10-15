import { describe, expect, it, vi } from "vitest";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
import { WorldRoom } from "../src/game-room.js";

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION);
  const item = new InventoryItemState(); item.quantity = 1; player.inventory.set("fang_dagger", item);
  player.huntLoadoutsJson = JSON.stringify({
    affixes: { fang_dagger: { affixId: "lethal", tier: 2 } }, dust: 30, offers: {}, targetAffixId: "precise",
  });
  room.state.players.set("smith", player);
  const client = { sessionId: "smith", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client, focus: () => (room as any).handleBlacksmithAttune(client, { action: "focus", itemId: "fang_dagger" }) };
}

describe("focused equipment attunement", () => {
  it("guarantees the pinned trait while preserving tier and charging the premium", () => {
    const { room, player, client, focus } = fixture();
    focus();
    expect((room as any).equipmentAffixes(player).fang_dagger).toEqual({ affixId: "precise", tier: 2 });
    expect((room as any).attunementDust(player)).toBe(12);
    expect(client.send).toHaveBeenCalledWith("equipment:affixes", expect.objectContaining({
      affixes: { fang_dagger: { affixId: "precise", tier: 2 } }, dust: 12,
    }));
  });

  it("requires a pinned trait and never consumes dust on rejection", () => {
    const { room, player, client, focus } = fixture();
    player.huntLoadoutsJson = JSON.stringify({ affixes: { fang_dagger: { affixId: "lethal", tier: 2 } }, dust: 30, offers: {} });
    focus();
    expect((room as any).equipmentAffixes(player).fang_dagger).toEqual({ affixId: "lethal", tier: 2 });
    expect((room as any).attunementDust(player)).toBe(30);
    expect(client.send).toHaveBeenLastCalledWith("blacksmith:update", expect.objectContaining({ phase: "error", message: expect.stringContaining("Pin a trait") }));
  });
});
