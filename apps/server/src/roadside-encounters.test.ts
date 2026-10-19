import { describe, expect, it, vi } from "vitest";
import { Block, ROADSIDE_ENCOUNTERS, ROLE_FIELD_OPPORTUNITIES, SURFACE_HEIGHT, nearestRoadsideEncounter,
  parseRoadsideClaims, roadsideDiscoveryBlock, roadsideEncounterAt } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "./player-save.js";
import { roadsideGuardsFor } from "./roadside-guards.js";

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
    expect(ROADSIDE_ENCOUNTERS).toHaveLength(18);
    for (const entry of ROADSIDE_ENCOUNTERS) {
      expect(roadsideEncounterAt(entry.id)).not.toBeNull();
      expect(fieldIds.has(entry.id)).toBe(false);
      expect(entry.gold).toBeLessThanOrEqual(8);
      expect(entry.quantity).toBeLessThanOrEqual(2);
    }
  });

  it("places visible off-road stashes without turning them into separate map tasks", () => {
    for (const entry of ROADSIDE_ENCOUNTERS) {
      if (entry.kind !== "trail") continue;
      const site = roadsideEncounterAt(entry.id)!;
      const stashX = site.x + entry.stashDx, stashZ = site.z + entry.stashDz;
      expect(Math.hypot(entry.stashDx, entry.stashDz)).toBeGreaterThan(5);
      expect(nearestRoadsideEncounter(stashX + .5, stashZ + .5)?.id).toBe(entry.id);
      expect(roadsideDiscoveryBlock(stashX, SURFACE_HEIGHT + 1, stashZ)).toBe(Block.OakLog);
    }
  });

  it("makes a trail cache a short off-road search, then persists its one-time claim", () => {
    const { internal, player, client, room, site } = fixture("greenwood-forager-camp");
    if (site.kind !== "trail") throw new Error("Expected a trail site");
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(client.send).toHaveBeenCalledWith("roadside:result", expect.objectContaining({ ok: true, claimed: false, message: site.clue }));
    expect(player.inventory.get("moss_fibre")).toBeUndefined();
    player.x = site.x + site.stashDx + .5;
    player.z = site.z + site.stashDz + .5;
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
    const guardIds = roadsideGuardsFor(site.id).map(guard => guard.id);
    expect(guardIds).toHaveLength(2);
    for (const id of guardIds) {
      const guard = new MobState(); Object.assign(guard, { x: site.x + 2, y: 8, z: site.z + 2, alive: true });
      room.state.mobs.set(id, guard);
    }
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(parseRoadsideClaims(player.huntLoadoutsJson).has(site.id)).toBe(false);
    room.state.mobs.get(guardIds[0]!)!.alive = false;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(parseRoadsideClaims(player.huntLoadoutsJson).has(site.id)).toBe(false);
    room.state.mobs.get(guardIds[1]!)!.alive = false;
    player.x += 20;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("iron_ore")).toBeUndefined();
    player.x = site.x + .5;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("iron_ore")?.quantity).toBe(2);
  });

  it("activates authored guards only near their site and releases them after the area empties", () => {
    const { room, internal, player, site } = fixture("northwatch-watchpost");
    player.x = 8.5; player.z = 8.5;
    internal.advanceRoadsideGuards(1_000);
    expect(room.state.mobs.size).toBe(0);
    player.x = site.x + .5; player.z = site.z + .5;
    internal.advanceRoadsideGuards(2_000);
    const guards = roadsideGuardsFor(site.id);
    expect(guards).toHaveLength(2);
    for (const guard of guards) expect(room.state.mobs.get(guard.id)?.name).toBe(guard.name);
    player.x = 8.5; player.z = 8.5;
    internal.advanceRoadsideGuards(32_001);
    for (const guard of guards) expect(room.state.mobs.has(guard.id)).toBe(false);
  });

  it("turns the Ashglass cache into a fixed ambush before granting its reward", () => {
    const { room, internal, player, client, site } = fixture("ashglass-survey");
    expect(site.kind).toBe("ambush");
    internal.advanceRoadsideGuards(1_000);
    expect(roadsideGuardsFor(site.id).every(guard => !room.state.mobs.has(guard.id))).toBe(true);
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(client.send).toHaveBeenCalledWith("roadside:result", expect.objectContaining({ phase: "activated" }));
    const guards = roadsideGuardsFor(site.id);
    expect(guards).toHaveLength(3);
    expect(guards.every(guard => room.state.mobs.get(guard.id)?.alive)).toBe(true);
    expect(player.inventory.get("silver_ore")).toBeUndefined();
    for (const guard of guards) room.state.mobs.get(guard.id)!.alive = false;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("silver_ore")?.quantity).toBe(2);
  });

  it("requires players to hold the broken winch before its patrol-cleared crate rises", () => {
    const { room, internal, player, client, site } = fixture("broken-winch-camp");
    if (site.kind !== "repair") throw new Error("Expected a repair site");
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(client.send).toHaveBeenCalledWith("roadside:result", expect.objectContaining({ phase: "repair", progress: 0, holders: 1 }));
    for (let now = 1_250; now <= 6_000; now += 250) internal.advanceRoadsideGuards(now);
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("silver_ore")).toBeUndefined();
    for (let now = 6_250; now <= 11_000; now += 250) internal.advanceRoadsideGuards(now);
    for (const guard of roadsideGuardsFor(site.id)) room.state.mobs.get(guard.id)!.alive = false;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(client.send).toHaveBeenCalledWith("roadside:result", expect.objectContaining({ phase: "claimed" }));
    expect(player.inventory.get("silver_ore")?.quantity).toBe(2);
    vi.restoreAllMocks();
  });

  it("makes the Wilds blind lead to a fixed wounded elite hunt", () => {
    const { room, internal, player, client, site } = fixture("wilds-hunter-blind");
    if (site.kind !== "hunt") throw new Error("Expected a hunt site");
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(room.state.mobs.size).toBe(0);
    player.x = site.x + site.stashDx + .5; player.z = site.z + site.stashDz + .5;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(client.send).toHaveBeenCalledWith("roadside:result", expect.objectContaining({ phase: "activated" }));
    const guards = roadsideGuardsFor(site.id);
    expect(guards).toHaveLength(3);
    expect(room.state.mobs.get("roadside-wilds-stalker")?.isElite).toBe(true);
    for (const guard of guards) room.state.mobs.get(guard.id)!.alive = false;
    internal.handleRoadsideEncounter(client, { id: site.id });
    expect(player.inventory.get("crawler_fang")?.quantity).toBe(2);
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
