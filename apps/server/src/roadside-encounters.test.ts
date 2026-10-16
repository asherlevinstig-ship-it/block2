import { describe, expect, it, vi } from "vitest";
import { ROADSIDE_ENCOUNTERS, ROLE_FIELD_OPPORTUNITIES, parseRoadsideClaims, roadsideEncounterAt } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "./player-save.js";

function fixture(id: string) {
  const site = roadsideEncounterAt(id)!;
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any; internal.roomKind = "overworld";
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState();
  Object.assign(player, { x: site.x + .5, y: 8, z: site.z + .5, coins: 0, health: 3, maxHealth: 5, stamina: 25, maxStamina: 100 });
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() };
  return { site, room, internal, player, client };
}

describe("personal roadside encounters", () => {
  it("uses landmarks separate from Calling sites and keeps rewards small", () => {
    const fieldIds = new Set<string>(ROLE_FIELD_OPPORTUNITIES.map(site => site.landmarkId));
    expect(ROADSIDE_ENCOUNTERS).toHaveLength(10);
    for (const entry of ROADSIDE_ENCOUNTERS) {
      expect(roadsideEncounterAt(entry.id)).not.toBeNull();
      expect(fieldIds.has(entry.id)).toBe(false);
      expect(entry.gold).toBeLessThanOrEqual(8);
      expect(entry.quantity).toBeLessThanOrEqual(2);
    }
  });

  it("grants a cache once per character and persists its claim", () => {
    const { internal, player, client, room, site } = fixture("greenwood-forager-camp");
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("moss_fibre")?.quantity).toBe(2);
    expect(player.coins).toBe(3);
    expect(parseRoadsideClaims(player.huntLoadoutsJson).has(site.id)).toBe(true);
    expect(room.broadcast).toHaveBeenCalledWith("loot:picked-up", expect.objectContaining({ itemId: "moss_fibre", quantity: 2 }));
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("moss_fibre")?.quantity).toBe(2);
    const restored = new PlayerState();
    applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
    expect(parseRoadsideClaims(restored.huntLoadoutsJson).has(site.id)).toBe(true);
  });

  it("requires guarded sites to be cleared and validates distance", () => {
    const { internal, player, client, room, site } = fixture("southgate-cart");
    const guard = new MobState(); Object.assign(guard, { x: site.x + 2, y: 8, z: site.z + 2, alive: true });
    room.state.mobs.set("guard", guard);
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(parseRoadsideClaims(player.huntLoadoutsJson).has(site.id)).toBe(false);
    guard.alive = false;
    player.x += 20;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("iron_ore")).toBeUndefined();
    player.x = site.x + .5;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("iron_ore")?.quantity).toBe(2);
  });

  it("lets a shrine restore health or give supplies, but never both", () => {
    const rest = fixture("mistfen-shrine");
    rest.internal.handleRoadsideEncounter(rest.client, { id: rest.site.id, choice: "rest" });
    expect(rest.player.health).toBe(5);
    expect(rest.player.stamina).toBe(100);
    expect(rest.player.inventory.get("healing_potion")).toBeUndefined();
    rest.internal.handleRoadsideEncounter(rest.client, { id: rest.site.id, choice: "supplies" });
    expect(rest.player.inventory.get("healing_potion")).toBeUndefined();
    const supplies = fixture("mistfen-shrine");
    supplies.internal.handleRoadsideEncounter(supplies.client, { id: supplies.site.id, choice: "supplies" });
    expect(supplies.player.inventory.get("healing_potion")?.quantity).toBe(1);
    expect(supplies.player.health).toBe(3);
  });

  it("keeps shrine rewards unclaimed when enemies are close or the potion stack is full", () => {
    const { internal, player, client, room, site } = fixture("mistfen-shrine");
    const enemy = new MobState(); Object.assign(enemy, { x: player.x + 2, y: 8, z: player.z, alive: true });
    room.state.mobs.set("enemy", enemy);
    internal.handleRoadsideEncounter(client, { id: site.id, choice: "rest" });
    expect(player.health).toBe(3);
    enemy.alive = false;
    const potion = new InventoryItemState(); potion.quantity = 3; player.inventory.set("healing_potion", potion);
    internal.handleRoadsideEncounter(client, { id: site.id, choice: "supplies" });
    expect(parseRoadsideClaims(player.huntLoadoutsJson).has(site.id)).toBe(false);
    expect(player.inventory.get("healing_potion")?.quantity).toBe(3);
  });
});
