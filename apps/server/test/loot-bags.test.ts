import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, LootDropState, PlayerState, WorldState } from "../src/schema.js";
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(read = flat) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any; const persist = vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const player = new PlayerState(); Object.assign(player, { x: 100.5, y: 1, z: 100.5, mainHandId: "longsword" });
  room.state.players.set("player", player);
  const drop = new LootDropState(); Object.assign(drop, { x: 101, y: 1.22, z: 100.5, itemId: "fang_dagger", quantity: 1, expiresAt: 40000 });
  room.state.lootDrops.set("bag", drop);
  const client = { sessionId: "player", send: vi.fn() };
  const collect = (equip = false) => internal.handleLootCollect(client, { dropId: "bag", equip });
  return { room, internal, player, drop, client, collect, persist };
}
describe("authoritative equipment loot bags", () => {
  it("leaves equipment for inspection but still automatically picks up materials", () => {
    const { internal, room, drop, player } = fixture(); internal.resolveLootPickups(10000);
    expect(room.state.lootDrops.has("bag")).toBe(true); expect(player.inventory.has("fang_dagger")).toBe(false);
    drop.itemId = "moss_fibre"; internal.resolveLootPickups(10000);
    expect(room.state.lootDrops.size).toBe(0); expect(player.inventory.get("moss_fibre")?.quantity).toBe(1);
  });
  it("collects into the pack without changing the equipped weapon and persists it", () => {
    const { player, collect, persist, client } = fixture(); collect();
    expect(player.inventory.get("fang_dagger")?.quantity).toBe(1); expect(player.mainHandId).toBe("longsword");
    expect(persist).toHaveBeenCalled(); expect(client.send).toHaveBeenCalledWith("loot:result", expect.objectContaining({ ok: true }));
  });
  it.each(["fang_dagger", "stone_core_hammer", "acid_gland_focus"])("collects and equips %s through the normal loadout rules", id => {
    const { player, drop, collect } = fixture(); drop.itemId = id; collect(true);
    expect(player.mainHandId).toBe(id); expect(player.inventory.get(id)?.quantity).toBe(1);
  });
  it("rejects repeated and competing collection without duplicating the item", () => {
    const { room, internal, player, collect } = fixture(); const other = new PlayerState(); Object.assign(other, { x: 100.5, y: 1, z: 100.5 });
    room.state.players.set("other", other); collect(); collect();
    internal.handleLootCollect({ sessionId: "other", send: vi.fn() }, { dropId: "bag", equip: true });
    expect(player.inventory.get("fang_dagger")?.quantity).toBe(1); expect(other.inventory.has("fang_dagger")).toBe(false);
  });
  it.each(["dead", "distant", "expired", "missing", "invalid"])("rejects a %s request without granting loot", reason => {
    const { player, drop, collect, internal, client } = fixture();
    if (reason === "dead") player.health = 0;
    if (reason === "distant") player.x = 110;
    if (reason === "expired") drop.expiresAt = 10000;
    if (reason === "missing") internal.state.lootDrops.delete("bag");
    if (reason === "invalid") internal.handleLootCollect(client, { dropId: "bag", equip: "yes" }); else collect();
    expect(player.inventory.has("fang_dagger")).toBe(false);
    expect(client.send).toHaveBeenCalledWith("loot:result", expect.objectContaining({ ok: false }));
  });
  it("blocks collection through terrain", () => {
    const read: WorldBlockReader = (x, y) => y <= 0 || x === 101 && y <= 3 ? Block.Stone : Block.Air;
    const { player, collect } = fixture(read); collect(); expect(player.inventory.has("fang_dagger")).toBe(false);
  });
  it("rejects equipment changes mid-action but permits keeping the item", () => {
    const { internal, player, collect, room } = fixture(); internal.pendingAttacks.set("player", {});
    collect(true); expect(room.state.lootDrops.has("bag")).toBe(true); expect(player.inventory.has("fang_dagger")).toBe(false);
    collect(false); expect(player.inventory.get("fang_dagger")?.quantity).toBe(1);
  });
  it("does not consume the bag when the stack is full", () => {
    const { player, collect, room } = fixture(); const item = new InventoryItemState(); item.quantity = 65535;
    player.inventory.set("fang_dagger", item); collect(); expect(room.state.lootDrops.has("bag")).toBe(true);
  });
});
