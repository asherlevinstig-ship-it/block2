import { describe, expect, it } from "vitest";
import { Block, SURFACE_HEIGHT, TOWN_STORAGE_CHEST_POSITION, isAtTownStorage, playerCollides } from "@blockcraft/voxel-world";
import { InventoryItemState, PlayerState } from "../src/schema.js";
import { transferStoredItem } from "../src/personal-storage.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "../src/player-save.js";

function player() {
  const p = new PlayerState();
  Object.assign(p, TOWN_STORAGE_CHEST_POSITION);
  p.z += 1.3;
  return p;
}
function stack(p: PlayerState, side: "inventory" | "storage", id: string, quantity: number) {
  const item = new InventoryItemState(); item.quantity = quantity; p[side].set(id, item);
}
function move(p: PlayerState, itemId = "iron_ore", direction = "deposit", quantity: number | "all" = "all") {
  return transferStoredItem(p, { itemId, direction, quantity });
}
describe("personal chest", () => {
  it("has shared collision and a usable approach without affecting underground movement", () => {
    const chest = TOWN_STORAGE_CHEST_POSITION;
    const ground = (_x: number, y: number, _z: number) => y === SURFACE_HEIGHT ? Block.Grass : Block.Air;
    expect(playerCollides(ground, chest.x, chest.y, chest.z)).toBe(true);
    expect(playerCollides(ground, chest.x, chest.y, chest.z + 1.3)).toBe(false);
    expect(isAtTownStorage(player())).toBe(true);
    expect(playerCollides(() => Block.Air, chest.x, 4, chest.z)).toBe(false);
    expect(playerCollides(() => Block.Air, chest.x, chest.y, chest.z)).toBe(false);
  });
  it("deposits and withdraws without losing or duplicating items", () => {
    const p = player(); stack(p, "inventory", "iron_ore", 9);
    move(p, "iron_ore", "deposit", 1);
    expect(p.inventory.get("iron_ore")?.quantity).toBe(8);
    expect(p.storage.get("iron_ore")?.quantity).toBe(1);
    move(p); move(p, "iron_ore", "withdraw"); move(p, "iron_ore", "withdraw");
    expect(p.inventory.get("iron_ore")?.quantity).toBe(9);
    expect(p.storage.get("iron_ore")?.quantity).toBe(0);
  });
  it.each([0, -1, 1.5, NaN, 65536])("rejects invalid quantity %s", quantity => {
    const p = player(); stack(p, "inventory", "iron_ore", 9); move(p, "iron_ore", "deposit", quantity);
    expect(p.inventory.get("iron_ore")?.quantity).toBe(9); expect(p.storage.size).toBe(0);
  });
  it("rejects unknown items, dead players, distance and height", () => {
    for (const change of [(p: PlayerState) => p.x += 10, (p: PlayerState) => p.y -= 4, (p: PlayerState) => p.health = 0]) {
      const p = player(); stack(p, "inventory", "iron_ore", 9); change(p); move(p);
      expect(p.storage.size).toBe(0);
    }
    expect(move(player(), "fake_item")).toContain("valid");
  });
  it("retains equipped copies but allows duplicates to be stored", () => {
    const p = player(); p.mainHandId = "fang_dagger"; stack(p, "inventory", "fang_dagger", 3);
    move(p, "fang_dagger"); expect(p.inventory.get("fang_dagger")?.quantity).toBe(1);
    move(p, "fang_dagger"); expect(p.storage.get("fang_dagger")?.quantity).toBe(2);
    p.mainHandId = "longsword"; move(p, "fang_dagger"); expect(p.storage.get("fang_dagger")?.quantity).toBe(3);
    p.armourId = "leather_armour"; stack(p, "inventory", "leather_armour", 1);
    move(p, "leather_armour"); expect(p.inventory.get("leather_armour")?.quantity).toBe(1);
    stack(p, "inventory", "reinforced_pickaxe", 1); move(p, "reinforced_pickaxe");
    expect(p.inventory.get("reinforced_pickaxe")?.quantity).toBe(1);
  });
  it("respects potion, ore and storage stack limits", () => {
    const p = player(); stack(p, "storage", "healing_potion", 10); move(p, "healing_potion", "withdraw");
    expect(p.inventory.get("healing_potion")?.quantity).toBe(3);
    stack(p, "storage", "iron_ore", 50); move(p, "iron_ore", "withdraw");
    expect(p.inventory.get("iron_ore")?.quantity).toBe(12);
    p.blacksmithUpgrades = 4; move(p, "iron_ore", "withdraw");
    expect(p.inventory.get("iron_ore")?.quantity).toBe(30);
    stack(p, "storage", "fang_dagger", 65534); stack(p, "inventory", "fang_dagger", 10); move(p, "fang_dagger");
    expect(p.storage.get("fang_dagger")?.quantity).toBe(65535); expect(p.inventory.get("fang_dagger")?.quantity).toBe(9);
  });
  it("keeps ownership separate and preserves storage across saves", () => {
    const a = player(), b = player(); stack(a, "inventory", "iron_ore", 8); move(a);
    transferStoredItem(b, { itemId: "iron_ore", direction: "withdraw", quantity: "all", playerId: "other" });
    expect(b.inventory.size).toBe(0); expect(a.storage.get("iron_ore")?.quantity).toBe(8);
    stack(a, "storage", "healing_potion", 10);
    const restored = player(); applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(a))!);
    expect(restored.storage.get("iron_ore")?.quantity).toBe(8);
    expect(restored.storage.get("healing_potion")?.quantity).toBe(10);
    expect(parsePlayerSave('{"version":1}')?.storage).toEqual({});
    expect(parsePlayerSave(JSON.stringify({ version: 1, storage: { iron_ore: 70000, healing_potion: 10, silver_ore: -1, fang_dagger: 1.5, exploit: 5 } }))?.storage).toEqual({ iron_ore: 65535, healing_potion: 10 });
  });
});
