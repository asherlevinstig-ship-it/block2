import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";

interface Internals {
  damagePlayer(mobId: string, playerId: string, damage: number, now: number): boolean;
  returnPlayerToTown(client: any): void;
  simulatePlayers(dt: number): void;
  movementInputs: Map<string, unknown>;
  pendingAttacks: Map<string, unknown>;
  pendingPowers: Map<string, unknown>;
  specialMarks: Map<string, unknown>;
  brambleSnares: Map<string, unknown>;
}
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 0 ? Block.Stone : Block.Air });
  Object.defineProperty(room, "spawnPoint", { value: () => ({ x: 8.5, y: 8, z: 8.5 }) });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); player.x = 100; player.y = 1; player.z = 100;
  player.coins = 47; player.stamina = 12; player.mainHandId = "stone_core_hammer";
  const ore = new InventoryItemState(); ore.quantity = 7; player.inventory.set("iron_ore", ore);
  room.state.players.set("player", player);
  const client = { sessionId: "player", send: vi.fn() };
  return { room, player, client, internal: room as unknown as Internals };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("defeat and return to town", () => {
  it("waits for explicit return and leaves spare possessions in a recovery bag", () => {
    const { player, client, internal } = fixture();
    internal.pendingAttacks.set("player", {}); internal.pendingPowers.set("player", {});
    internal.specialMarks.set("player", {}); internal.brambleSnares.set("player", {});
    player.defending = true;
    expect(internal.damagePlayer("missing", "player", 5, Date.now())).toBe(true);
    expect(player.health).toBe(0); expect(player.defending).toBe(false);
    internal.simulatePlayers(0.033);
    expect([player.x, player.y, player.z]).toEqual([100, 1, 100]);
    expect(internal.pendingAttacks.size + internal.pendingPowers.size + internal.specialMarks.size + internal.brambleSnares.size).toBe(0);
    expect(internal.damagePlayer("missing", "player", 1, Date.now())).toBe(false);
    internal.returnPlayerToTown(client);
    expect([player.x, player.y, player.z]).toEqual([8.5, 8, 8.5]);
    expect(player.health).toBe(player.maxHealth); expect(player.stamina).toBe(player.maxStamina);
    expect(player.coins).toBe(47); expect(player.inventory.get("iron_ore")?.quantity).toBe(0);
    expect(player.recoveryBags.size).toBe(1);
    const bag = [...player.recoveryBags.values()][0]!;
    expect([bag.x, bag.y, bag.z]).toEqual([100, 1, 100]);
    expect(bag.items.get("iron_ore")?.quantity).toBe(7);
    expect(player.mainHandId).toBe("stone_core_hammer");
    expect(player.invulnerableUntil).toBe(11_500);
    internal.returnPlayerToTown(client);
    expect(client.send).toHaveBeenCalledTimes(1);
  });
  it("does not allow living players to use return as a free teleport or heal", () => {
    const { player, client, internal } = fixture();
    internal.returnPlayerToTown(client);
    expect(player.x).toBe(100); expect(player.stamina).toBe(12);
    expect(client.send).not.toHaveBeenCalled();
  });
});
