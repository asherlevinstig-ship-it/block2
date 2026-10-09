import { afterEach, describe, expect, it, vi } from "vitest";
import { TOWN_TAVERN_KEEPER_POSITION } from "@blockcraft/voxel-world";
import { HEALING_POTION } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
import { canBuyPotionAtKeeper } from "../src/healing-potions.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "../src/player-save.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function setup() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  const persist = vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const player = new PlayerState(); Object.assign(player, TOWN_TAVERN_KEEPER_POSITION);
  room.state.players.set("visitor", player);
  const client = { sessionId: "visitor", send: vi.fn() };
  return { player, persist, client, act: (buying: boolean) => internal.handlePotion(client, buying) };
}
describe("server-authoritative healing potions", () => {
  it("requires the tavern keeper's range and floor, not merely being in town", () => {
    expect(canBuyPotionAtKeeper(TOWN_TAVERN_KEEPER_POSITION)).toBe(true);
    expect(canBuyPotionAtKeeper({ ...TOWN_TAVERN_KEEPER_POSITION, y: TOWN_TAVERN_KEEPER_POSITION.y - 4 })).toBe(false);
    const { player, act } = setup(); player.x += 20; act(true);
    expect(player.coins).toBe(20); expect(player.inventory.has("healing_potion")).toBe(false);
  });
  it("charges exactly 5 gold per potion and rejects a fourth purchase without charging", () => {
    const { player, act, persist } = setup();
    act(true); act(true); act(true); act(true);
    expect(player.inventory.get("healing_potion")?.quantity).toBe(3);
    expect(player.coins).toBe(5); expect(persist).toHaveBeenCalledTimes(3);
  });
  it("rejects insufficient gold and defeated players without creating inventory", () => {
    const { player, act } = setup(); player.coins = 4; act(true);
    expect(player.coins).toBe(4); expect(player.inventory.has("healing_potion")).toBe(false);
    player.coins = 20; player.health = 0; act(true); act(false);
    expect(player.coins).toBe(20); expect(player.health).toBe(0);
  });
  it("heals on actual use, consumes once and prevents rapid-fire healing during cooldown", () => {
    const { player, act, client } = setup(); act(true); act(true); player.health = 1;
    act(false); expect(player.health).toBe(3); expect(player.inventory.get("healing_potion")?.quantity).toBe(1);
    expect(player.potionCooldownUntil).toBe(15000);
    act(false); expect(player.health).toBe(3); expect(player.inventory.get("healing_potion")?.quantity).toBe(1);
    vi.advanceTimersByTime(HEALING_POTION.cooldownMs); act(false);
    expect(player.health).toBe(5); expect(player.inventory.get("healing_potion")?.quantity).toBe(0);
    expect(client.send).toHaveBeenLastCalledWith("potion:update", expect.objectContaining({ phase: "healed", healed: 2, quantity: 0 }));
  });
  it("caps healing at max HP and never consumes at full HP or revives a defeated player", () => {
    const { player, act } = setup(); act(true); act(true);
    act(false); expect(player.inventory.get("healing_potion")?.quantity).toBe(2);
    expect(player.potionCooldownUntil).toBe(0);
    player.health = 4; act(false); expect(player.health).toBe(5);
    expect(player.inventory.get("healing_potion")?.quantity).toBe(1);
    player.health = 0; vi.advanceTimersByTime(5000); act(false);
    expect(player.health).toBe(0); expect(player.inventory.get("healing_potion")?.quantity).toBe(1);
  });
  it("returns a useful error when no potions are held", () => {
    const { player, act, client } = setup(); player.health = 2; act(false);
    expect(player.health).toBe(2);
    expect(client.send).toHaveBeenLastCalledWith("potion:update", expect.objectContaining({ phase: "error", quantity: 0 }));
  });
  it("persists potions and cooldown across reconnects, while reading old saves", () => {
    const { player, act } = setup(); act(true); act(true); player.health = 1; act(false);
    const restored = new PlayerState(); applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
    expect(restored.inventory.get("healing_potion")?.quantity).toBe(1);
    expect(restored.health).toBe(3); expect(restored.potionCooldownUntil).toBe(15000);
    const old = JSON.parse(serializePlayerSave(player)); delete old.potionCooldownUntil;
    expect(parsePlayerSave(JSON.stringify(old))?.potionCooldownUntil).toBe(0);
  });
  it("clamps saved potion quantities to the pouch capacity", () => {
    const { player } = setup(); const potion = new InventoryItemState(); potion.quantity = 99;
    player.inventory.set("healing_potion", potion);
    expect(parsePlayerSave(serializePlayerSave(player))?.inventory.healing_potion).toBe(3);
  });
});
