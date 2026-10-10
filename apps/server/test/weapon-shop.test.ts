import { describe, expect, it, vi } from "vitest";
import { BLACKSMITH_WEAPONS, BlacksmithBuySchema, MainHandEquipRequestSchema, WEAPON_ATTACK_DEFINITIONS, playerMeleeStrike } from "@blockcraft/protocol";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { weaponPurchase } from "../src/blacksmith.js";
import { canEquipMainHand } from "../src/equipment-rules.js";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "../src/player-save.js";

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState(); Object.assign(player, TOWN_BLACKSMITH_STALL_POSITION); player.coins = 100;
  room.state.players.set("buyer", player);
  const client = { sessionId: "buyer", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  const buy = (payload: unknown) => (room as any).handleBlacksmithBuy(client, payload);
  return { room, player, client, buy };
}

describe("blacksmith weapon shop", () => {
  it("buys each fixed-price weapon without changing equipped weapon", () => {
    for (const id of Object.keys(BLACKSMITH_WEAPONS) as (keyof typeof BLACKSMITH_WEAPONS)[]) {
      const { player, buy } = fixture(); buy({ itemId: id, price: 0 });
      expect(player.coins).toBe(100 - BLACKSMITH_WEAPONS[id].price);
      expect(player.inventory.get(id)?.quantity).toBe(1);
      expect(player.mainHandId).toBe("longsword");
    }
  });
  it("rejects remote, dead, invalid and unaffordable purchases without spending", () => {
    for (const reason of ["remote", "dead", "invalid", "poor"]) {
      const { player, buy } = fixture();
      if (reason === "remote") player.x += 10;
      if (reason === "dead") player.health = 0;
      if (reason === "poor") player.coins = 44;
      const gold = player.coins;
      buy({ itemId: reason === "invalid" ? "longsword" : "forged_sword" });
      expect(player.coins).toBe(gold); expect(player.inventory.size).toBe(0);
    }
  });
  it("cannot overspend on repeated buys or overflow inventory", () => {
    const { player, buy } = fixture(); player.coins = 50;
    buy({ itemId: "forged_bow" }); buy({ itemId: "forged_bow" });
    expect(player.coins).toBe(0); expect(player.inventory.get("forged_bow")?.quantity).toBe(1);
    expect(weaponPurchase(100, 65535, "forged_sword")).toMatchObject({ ok: false, gold: 100, quantity: 65535 });
  });
  it("requires ownership to equip and preserves items in saved profiles", () => {
    for (const id of Object.keys(BLACKSMITH_WEAPONS) as (keyof typeof BLACKSMITH_WEAPONS)[]) {
      expect(canEquipMainHand(id, () => 0)).toBe(false);
      expect(canEquipMainHand(id, item => item === id ? 1 : 0)).toBe(true);
      const player = new PlayerState(); const item = new InventoryItemState(); item.quantity = 1;
      player.inventory.set(id, item); player.mainHandId = id;
      const restored = new PlayerState(); applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
      expect(restored.inventory.get(id)?.quantity).toBe(1); expect(restored.mainHandId).toBe(id);
      expect(MainHandEquipRequestSchema.safeParse({ requestId: "equip", mainHandId: id }).success).toBe(true);
    }
  });
  it("uses sword sweep geometry and stronger ranged impact damage", () => {
    expect(playerMeleeStrike("forged_sword", 3)).toEqual(playerMeleeStrike("longsword", 3));
    expect(WEAPON_ATTACK_DEFINITIONS.forged_sword.attacks.map(a => a.damage)).toEqual([2, 2, 3]);
    for (const id of ["forged_bow", "forged_focus"] as const) {
      expect(playerMeleeStrike(id, 1)).toBeNull();
      expect(WEAPON_ATTACK_DEFINITIONS[id].projectileTravelMs).toBeGreaterThan(0);
      expect(WEAPON_ATTACK_DEFINITIONS[id].attacks[0].damage).toBe(2);
    }
    expect(BlacksmithBuySchema.safeParse({ itemId: "unknown" }).success).toBe(false);
  });
});
