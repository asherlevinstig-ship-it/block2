import { describe, expect, it, vi } from "vitest";
import { ArmourEquipSchema, FIELD_FORGE_RECIPES, FieldForgeSchema, armourForItem, armourStats } from "@blockcraft/protocol";
import { ROADSIDE_ENCOUNTERS, TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "./schema.js";
import { playerBackpackSlots } from "./backpack.js";
import { lootForArchetype } from "./loot-rules.js";

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

describe("regional field armour", () => {
  it("has equippable regional gear and keeps boss rewards superior", () => {
    expect(Object.keys(FIELD_FORGE_RECIPES)).toEqual(["greenwood", "mistfen", "quarry", "northwatch"]);
    for (const [region, recipe] of Object.entries(FIELD_FORGE_RECIPES)) {
      expect(FieldForgeSchema.safeParse({ region }).success).toBe(true);
      expect(armourForItem(recipe.itemId)).toBe(recipe.itemId);
      expect(ArmourEquipSchema.safeParse({ armourId: recipe.itemId }).success).toBe(true);
    }
    expect(armourStats("quarry_hauberk").reduction).toBeLessThan(armourStats("worldsplitter_plate").reduction);
    expect(armourStats("quarry_hauberk").hazardReduction).toBeLessThan(armourStats("worldsplitter_plate").hazardReduction);
    expect(armourStats("quarry_hauberk").projectileReduction).toBe(1);
    expect(armourStats("ridgeguard_mantle").reduction).toBe(armourStats("northwatch_cloak").reduction);
    expect(armourStats("ridgeguard_mantle").projectileReduction).toBe(armourStats("northwatch_cloak").projectileReduction);
    expect(armourStats("ridgeguard_mantle").speed).toBeLessThan(armourStats("northwatch_cloak").speed);
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

  it("forges a Quarry Hauberk from obtainable pre-boss roadside finds", () => {
    const { internal, player, client, give } = fixture();
    const ore = ROADSIDE_ENCOUNTERS.find(site => site.id === "sunfall-survey");
    const core = ROADSIDE_ENCOUNTERS.find(site => site.id === "collapsed-lift");
    expect(ore).toMatchObject({ itemId: "iron_ore", quantity: 2 });
    expect(core).toMatchObject({ itemId: "stone_core", quantity: 1 });
    give("iron_ore", 2);
    internal.handleFieldForge(client, { region: "quarry" });
    expect(player.inventory.get("quarry_hauberk")).toBeUndefined();
    expect(player.coins).toBe(30);
    give("stone_core", 1);
    internal.handleFieldForge(client, { region: "quarry" });
    expect(player.inventory.get("quarry_hauberk")?.quantity).toBe(1);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(0);
    expect(player.inventory.get("stone_core")?.quantity).toBe(0);
    expect(player.coins).toBe(2);
  });

  it("forges a Ridgeguard Mantle from regular Northwatch encounters before the Watchbreaker", () => {
    const { internal, player, client, give } = fixture();
    expect(lootForArchetype("ridge_stalker")).toContainEqual({ itemId: "ridge_hide", quantity: 1 });
    expect(ROADSIDE_ENCOUNTERS.find(site => site.id === "northwatch-cart"))
      .toMatchObject({ itemId: "iron_ore", quantity: 2 });
    give("ridge_hide", 1); give("iron_ore", 2);
    internal.handleFieldForge(client, { region: "northwatch" });
    expect(player.inventory.get("ridgeguard_mantle")).toBeUndefined();
    expect(player.coins).toBe(30);
    give("ridge_hide", 2);
    internal.handleFieldForge(client, { region: "northwatch" });
    expect(player.inventory.get("ridgeguard_mantle")?.quantity).toBe(1);
    expect(player.inventory.get("ridge_hide")?.quantity).toBe(0);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(0);
    expect(player.coins).toBe(6);
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
