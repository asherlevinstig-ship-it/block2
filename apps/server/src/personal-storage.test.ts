import { describe, expect, it } from "vitest";
import { InventoryItemState, PlayerState } from "./schema.js";
import { transferStoredItem } from "./personal-storage.js";

function playerWithOre(): PlayerState {
  const player = new PlayerState();
  const ore = new InventoryItemState(); ore.quantity = 3;
  player.inventory.set("iron_ore", ore);
  player.x = -6.2; player.y = 15; player.z = -4.8;
  return player;
}

describe("personal storage access", () => {
  it("rejects a remote transfer without an authorized chest", () => {
    const player = playerWithOre();
    expect(transferStoredItem(player, { itemId: "iron_ore", direction: "deposit", quantity: 1 })).toContain("Stand beside");
    expect(player.storage.get("iron_ore")).toBeUndefined();
  });

  it("allows the server-authorized private inn chest", () => {
    const player = playerWithOre();
    expect(transferStoredItem(player, { itemId: "iron_ore", direction: "deposit", quantity: 2 }, true)).toContain("Stored 2");
    expect(player.inventory.get("iron_ore")?.quantity).toBe(1);
    expect(player.storage.get("iron_ore")?.quantity).toBe(2);
  });
});
