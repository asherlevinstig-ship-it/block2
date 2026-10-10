import { describe, expect, it, vi } from "vitest";
import { armouredDamage, armourStats, BlacksmithBuySchema, type ArmourId } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, InventoryItemState, MobState, WorldState } from "../src/schema.js";
import { parsePlayerSave, serializePlayerSave, applyPlayerSave } from "../src/player-save.js";
import { weaponPurchase } from "../src/blacksmith.js";
import { tradeBalance } from "../src/trading.js";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); player.x = 100; player.y = 8; player.z = 100;
  const mob = new MobState(); mob.x = 101; mob.y = 8; mob.z = 100;
  room.state.players.set("player", player); room.state.mobs.set("mob", mob);
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  const client = { sessionId: "player", send: vi.fn() };
  const equip = (armourId: string) => (room as any).handleArmourEquip(client, { armourId });
  const own = (id: string) => { const item = new InventoryItemState(); item.quantity = 1; player.inventory.set(id, item); };
  return { room, player, own, equip };
}
describe("armour", () => {
  it("buys armour through the server shop without auto-equipping", () => {
    for (const [id, price] of [["leather_armour", 30], ["iron_armour", 70]] as const) {
      const { room, player } = fixture(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION); player.coins = 100;
      const client = { sessionId: "player", send: vi.fn() };
      (room as any).handleBlacksmithBuy(client, { itemId: id, price: 0 });
      expect(player.coins).toBe(100 - price); expect(player.inventory.get(id)?.quantity).toBe(1); expect(player.armourId).toBe("none");
    }
  });
  it("reduces damage without immunizing players or breaking zero-damage parries", () => {
    expect(armouredDamage(3, "none")).toBe(3);
    expect(armouredDamage(3, "leather_armour")).toBe(2);
    expect(armouredDamage(3, "iron_armour")).toBe(1);
    expect(armouredDamage(1, "iron_armour")).toBe(1);
    expect(armouredDamage(0, "iron_armour")).toBe(0);
    expect(armourStats("iron_armour").speed).toBe(.92);
    expect(armourStats("leather_armour").speed).toBe(1);
    expect(armourStats("toString").reduction).toBe(0);
  });
  it("applies reduction on actual server damage", () => {
    for (const [armourId, health] of [["none", 2], ["leather_armour", 3], ["iron_armour", 4]] as const) {
      const { room, player } = fixture(); player.armourId = armourId;
      (room as any).damagePlayer("mob", "player", 3, 1000, false);
      expect(player.health).toBe(health);
    }
  });
  it("requires ownership, keeps purchases unequipped, and supports removal", () => {
    const { player, own, equip } = fixture(); equip("iron_armour"); expect(player.armourId).toBe("none");
    own("leather_armour"); equip("leather_armour"); expect(player.armourId).toBe("leather_armour");
    equip("unknown"); expect(player.armourId).toBe("leather_armour");
    equip("none"); expect(player.armourId).toBe("none");
    for (const [id, price] of [["leather_armour", 30], ["iron_armour", 70]] as const) {
      expect(BlacksmithBuySchema.safeParse({ itemId: id }).success).toBe(true);
      expect(weaponPurchase(100, 0, id)).toMatchObject({ ok: true, gold: 100 - price, quantity: 1 });
      expect(weaponPurchase(price - 1, 0, id).ok).toBe(false);
    }
  });
  it("round-trips worn armour and safely loads legacy or unowned armour saves", () => {
    for (const id of ["leather_armour", "iron_armour"] as ArmourId[]) {
      const { player, own, equip } = fixture(); own(id); equip(id);
      const restored = new PlayerState(); applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
      expect(restored.armourId).toBe(id);
      const raw = JSON.parse(serializePlayerSave(player)); delete raw.armourId;
      expect(parsePlayerSave(JSON.stringify(raw))?.armourId).toBe("none");
      raw.armourId = id; raw.inventory = {};
      const empty = new PlayerState(); applyPlayerSave(empty, parsePlayerSave(JSON.stringify(raw))!); expect(empty.armourId).toBe("none");
    }
  });
  it("cannot trade away worn armour but can trade it after removing it", () => {
    const { player, own, equip } = fixture(); own("iron_armour"); equip("iron_armour");
    const offer = { gold: 0, items: [{ itemId: "iron_armour" as const, quantity: 1 }] };
    expect(typeof tradeBalance(player, offer, { gold: 0, items: [] })).toBe("string");
    equip("none"); expect(typeof tradeBalance(player, offer, { gold: 0, items: [] })).toBe("object");
  });
});
