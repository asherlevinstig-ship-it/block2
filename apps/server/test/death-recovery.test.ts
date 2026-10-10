import { describe, expect, it } from "vitest";
import { InventoryItemState, PlayerState } from "../src/schema.js";
import { collectRecoveryBag, leaveRecoveryBag, parseRecoveryBags, snapshotRecoveryBags } from "../src/death-recovery.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "../src/player-save.js";

function stack(player: PlayerState, id: string, quantity: number, stored = false) {
  const item = new InventoryItemState(); item.quantity = quantity;
  (stored ? player.storage : player.inventory).set(id, item);
}
function fallen() {
  const player = new PlayerState(); Object.assign(player, { health: 0, x: 100.5, y: 8, z: 80.5, coins: 99, mainHandId: "fang_dagger", armourId: "leather_armour", blacksmithUpgrades: 1 });
  stack(player, "iron_ore", 10); stack(player, "silver_ore", 8);
  stack(player, "fang_dagger", 3); stack(player, "leather_armour", 2);
  stack(player, "stone_core_hammer", 1); stack(player, "crawler_fang", 4);
  stack(player, "reinforced_pickaxe", 1); stack(player, "healing_potion", 3);
  stack(player, "iron_ore", 20, true);
  return player;
}
describe("death recovery", () => {
  it("drops minerals and spare loot, preserving equipped copies, gold, storage and supplies", () => {
    const player = fallen(); expect(leaveRecoveryBag(player, "first")).toBe(26);
    const bag = player.recoveryBags.get("first")!;
    expect(bag.items.get("fang_dagger")?.quantity).toBe(2);
    expect(bag.items.get("leather_armour")?.quantity).toBe(1);
    expect(player.inventory.get("fang_dagger")?.quantity).toBe(1);
    expect(player.inventory.get("leather_armour")?.quantity).toBe(1);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(0);
    expect(player.storage.get("iron_ore")?.quantity).toBe(20);
    expect(player.inventory.get("healing_potion")?.quantity).toBe(3);
    expect(player.inventory.get("reinforced_pickaxe")?.quantity).toBe(1);
    expect(player.coins).toBe(99); expect(player.blacksmithUpgrades).toBe(1);
    expect(leaveRecoveryBag(player, "first")).toBe(0);
  });
  it("does not create empty bags or drop living players' inventory", () => {
    const player = fallen(); player.health = 5; expect(leaveRecoveryBag(player, "bag")).toBe(0);
    player.inventory.clear(); player.health = 0; expect(leaveRecoveryBag(player, "bag")).toBe(0);
    expect(player.recoveryBags.size).toBe(0);
  });
  it("requires owner, alive state, nearby height and clear path", () => {
    const player = fallen(); leaveRecoveryBag(player, "bag");
    expect(collectRecoveryBag(new PlayerState(), "bag", () => true)).toContain("no longer");
    expect(collectRecoveryBag(player, "bag", () => true)).toContain("Return");
    player.health = 5; player.x += 3; expect(collectRecoveryBag(player, "bag", () => true)).toContain("Move beside");
    player.x -= 3; player.y += 3; expect(collectRecoveryBag(player, "bag", () => true)).toContain("Move beside");
    player.y -= 3; expect(collectRecoveryBag(player, "bag", () => false)).toContain("clear path");
    expect(player.recoveryBags.size).toBe(1);
  });
  it("recovers what fits, retains leftovers, and cannot duplicate on repeat collection", () => {
    const player = fallen(); leaveRecoveryBag(player, "bag"); player.health = 5; stack(player, "iron_ore", 11);
    expect(collectRecoveryBag(player, "bag", () => true)).toContain("9 remain");
    expect(player.inventory.get("iron_ore")?.quantity).toBe(12);
    expect(player.recoveryBags.get("bag")?.items.get("iron_ore")?.quantity).toBe(9);
    expect(player.inventory.get("fang_dagger")?.quantity).toBe(3);
    collectRecoveryBag(player, "bag", () => true); expect(player.inventory.get("fang_dagger")?.quantity).toBe(3);
    player.inventory.get("iron_ore")!.quantity = 0;
    expect(collectRecoveryBag(player, "bag", () => true)).toContain("empty");
    expect(player.inventory.get("iron_ore")?.quantity).toBe(9); expect(player.recoveryBags.size).toBe(0);
    expect(collectRecoveryBag(player, "bag", () => true)).toContain("no longer");
  });
  it("keeps previous bags on later deaths and survives reconnect/save restore", () => {
    const player = fallen(); leaveRecoveryBag(player, "first");
    player.x += 10; stack(player, "iron_ore", 2); leaveRecoveryBag(player, "second");
    const restored = new PlayerState(); applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
    expect(snapshotRecoveryBags(restored)).toEqual(snapshotRecoveryBags(player));
    expect(restored.recoveryBags.size).toBe(2);
    expect(restored.inventory.get("fang_dagger")?.quantity).toBe(1);
    expect(parsePlayerSave('{"version":1}')?.recoveryBags).toEqual([]);
  });
  it("sanitizes malformed saved bag data", () => {
    const bag = { id: "bag", x: 100, y: 8, z: 80, items: { iron_ore: 70000, silver_ore: -1, fake: 5, fang_dagger: 1.2 } };
    expect(parseRecoveryBags([null, {}, { ...bag, x: Infinity }, bag, bag])).toEqual([{ id: "bag", x: 100, y: 8, z: 80, items: { iron_ore: 65535 } }]);
  });
});
