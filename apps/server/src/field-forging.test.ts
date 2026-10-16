import { describe, expect, it, vi } from "vitest";
import { ArmourEquipSchema, FIELD_FORGE_RECIPES, FieldForgeSchema, armourForItem, armourStats } from "@blockcraft/protocol";
import { TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "./schema.js";
import { playerBackpackSlots } from "./backpack.js";

function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(internal, "sendBlacksmithState").mockImplementation(() => {});
  const player = new PlayerState();
  Object.assign(player, { ...TOWN_BLACKSMITH_STALL_POSITION, health: 5, maxHealth: 5, coins: 30 });
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() };
  const give = (id: string, quantity: number) => {
    const item = new InventoryItemState(); item.quantity = quantity; player.inventory.set(id, item);
  };
  return { room, internal, player, client, give };
}

describe("early regional field armour", () => {
  it("has modest, equippable regional gear below the legendary recipes", () => {
    expect(Object.keys(FIELD_FORGE_RECIPES)).toEqual(["greenwood", "mistfen"]);
    for (const recipe of Object.values(FIELD_FORGE_RECIPES)) {
      expect(FieldForgeSchema.safeParse({ region: recipe === FIELD_FORGE_RECIPES.greenwood ? "greenwood" : "mistfen" }).success).toBe(true);
      expect(armourForItem(recipe.itemId)).toBe(recipe.itemId);
      expect(ArmourEquipSchema.safeParse({ armourId: recipe.itemId }).success).toBe(true);
      expect(armourStats(recipe.itemId).reduction).toBe(1);
      expect(recipe.gold).toBeLessThan(20);
    }
  });

  it("forges a Greenwood wrap from finds and grants a real pack item", () => {
    const { internal, player, client, give } = fixture();
    give("moss_fibre", 2); give("timber", 1);
    internal.handleFieldForge(client, { region: "greenwood" });
    expect(player.inventory.get("forager_wrap")?.quantity).toBe(1);
    expect(player.inventory.get("moss_fibre")?.quantity).toBe(0);
    expect(player.inventory.get("timber")?.quantity).toBe(0);
    expect(player.coins).toBe(18);
    expect(internal.sendBlacksmithState).toHaveBeenCalledWith(client, expect.stringContaining("Forager Wrap forged"), "purchased");
  });

  it("does not spend anything when materials are missing or the player is away", () => {
    const { internal, player, client, give } = fixture();
    give("crawler_fang", 1);
    internal.handleFieldForge(client, { region: "mistfen" });
    expect(player.coins).toBe(30);
    expect(player.inventory.get("crawler_fang")?.quantity).toBe(1);
    give("acid_gland", 1);
    player.x += 20;
    internal.handleFieldForge(client, { region: "mistfen" });
    expect(player.inventory.get("fenwalker_mantle")).toBeUndefined();
    expect(player.inventory.get("acid_gland")?.quantity).toBe(1);
  });

  it("lets consumed materials free space for the newly forged armour", () => {
    const { internal, player, client, give } = fixture();
    give("moss_fibre", 2); give("timber", 1);
    for (const id of ["iron_ore", "silver_ore", "moonstone", "ember_core", "stone_core", "acid_gland",
      "crawler_fang", "ridge_hide", "rootguard_armour", "fang_dagger"]) give(id, 1);
    expect(playerBackpackSlots(player)).toBe(12);
    internal.handleFieldForge(client, { region: "greenwood" });
    expect(player.inventory.get("forager_wrap")?.quantity).toBe(1);
    expect(playerBackpackSlots(player)).toBe(11);
  });
});
