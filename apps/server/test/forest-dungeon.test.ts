import { afterEach, describe, expect, it, vi } from "vitest";
import { canUseForestPortal, FOREST_PORTAL_LIFETIME_MS } from "@blockcraft/protocol";
import { Block, FOREST_PORTAL_POSITION, FOREST_DUNGEON_ENTRY, FOREST_DUNGEON_EXIT, FOREST_DUNGEON_MOBS, FOREST_DUNGEON_COVER, TOWN_EXPEDITION_BOARD_POSITION, TOWN_EXPEDITION_PORTAL_POSITION, isProtectedVoxel, isPlayerSupported, playerCollides } from "@blockcraft/voxel-world";
import { ForestPortalCycle } from "../src/forest-portal-cycle.js";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, LootDropState, PlayerState, WorldState } from "../src/schema.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const player = new PlayerState(); Object.assign(player, FOREST_PORTAL_POSITION); room.state.players.set("tester", player);
  const client = { sessionId: "tester", send: vi.fn() } as any;
  const kill = (id: string) => {
    const mob = room.state.mobs.get(id)!;
    internal.combatContributions.record(id, "tester", mob.maxHealth, Date.now());
    internal.defeatMob(id, mob, "tester", Date.now());
  };
  const open = () => {
    internal.registerMob("cave-spitter", "cave_spitter", { x: 46.5, y: 8, z: 31.5 });
    internal.registerMob("frontier-spitter", "cave_spitter", { x: 50.5, y: 8, z: 25.5 });
    kill("cave-spitter"); kill("frontier-spitter");
  };
  const ready = (who = client) => internal.handleDungeonLobby(who, { action: "ready" });
  return { room, internal, player, client, kill, open, ready };
}
describe("forest dungeon portal", () => {
  it("lets a nearby solo leader open a reserved town portal and reports persistent board details", () => {
    const { room, internal, player, client } = fixture();
    Object.assign(player, TOWN_EXPEDITION_BOARD_POSITION, { forestBestTimeMs: 65432 });
    internal.handleDungeonBoard(client, { action: "sync" });
    expect(client.send).toHaveBeenCalledWith("dungeon:board", expect.objectContaining({ available: true, leader: true, partySize: 1, bestTimeMs: 65432 }));
    internal.handleDungeonBoard(client, { action: "open" });
    expect(room.state.portals.get("forest-entry")).toMatchObject({ ...TOWN_EXPEDITION_PORTAL_POSITION, kind: "entry", expiresAt: 40000 });
    expect(internal.forestDungeonRun.allowed).toEqual(new Set(["tester"]));
  });
  it("rejects remote board launches and reserves party launches for the leader", () => {
    const { room, internal, player, client } = fixture();
    internal.handleDungeonBoard(client, { action: "open" });
    expect(room.state.portals.has("forest-entry")).toBe(false);
    const friend = new PlayerState(); Object.assign(friend, TOWN_EXPEDITION_BOARD_POSITION); room.state.players.set("friend", friend);
    Object.assign(player, TOWN_EXPEDITION_BOARD_POSITION);
    internal.parties.handle("tester", { action: "invite", targetId: "friend" }, room.state.players, 10000);
    const inviteId = internal.parties.snapshot("friend", room.state.players, 10000).invite.id;
    internal.parties.handle("friend", { action: "respond", inviteId, accept: true }, room.state.players, 10000);
    const friendClient = { sessionId: "friend", send: vi.fn() } as any;
    internal.handleDungeonBoard(friendClient, { action: "open" });
    expect(room.state.portals.has("forest-entry")).toBe(false);
    expect(friendClient.send).toHaveBeenCalledWith("dungeon:board", expect.objectContaining({ leader: false, message: expect.stringContaining("leader") }));
  });
  it("builds distinct blocking cover while preserving each room's central route", () => {
    const { internal } = fixture();
    expect(FOREST_DUNGEON_COVER.filter(prop => prop.stage === 1)).toHaveLength(2);
    expect(FOREST_DUNGEON_COVER.filter(prop => prop.stage === 2)).toHaveLength(3);
    expect(FOREST_DUNGEON_COVER.filter(prop => prop.stage === 3)).toHaveLength(4);
    for (const prop of FOREST_DUNGEON_COVER) {
      const block = prop.kind === "stone" ? Block.Stone : Block.OakLog;
      expect(internal.readWorldBlock(prop.x, 8, prop.z)).toBe(block);
      expect(internal.readWorldBlock(prop.x, 7 + prop.height, prop.z)).toBe(block);
      expect(internal.readWorldBlock(prop.x, 8 + prop.height, prop.z)).toBe(Block.Air);
      expect(playerCollides(internal.readWorldBlock, prop.x + .5, 8, prop.z + .5)).toBe(true);
    }
    for (const x of [160.5, 164.5, 170.5, 174.5, 178.5, 182.5, 187.5, 191.5]) {
      expect(playerCollides(internal.readWorldBlock, x, 8, 165.5)).toBe(false);
      expect(isPlayerSupported(internal.readWorldBlock, x, 8, 165.5)).toBe(true);
    }
  });
  it("requires both fresh guard defeats, ignores unrelated mobs and consumes the pair once", () => {
    const cycle = new ForestPortalCycle();
    expect(cycle.record("moss-crawler", 1000)).toBe(false);
    expect(cycle.record("cave-spitter", 1000)).toBe(false);
    expect(cycle.record("frontier-spitter", 61001)).toBe(false);
    expect(cycle.record("cave-spitter", 62000)).toBe(true);
    expect(cycle.record("frontier-spitter", 63000)).toBe(false);
  });
  it("validates reach, height, living players and the authoritative expiry boundary", () => {
    const portal = { ...FOREST_PORTAL_POSITION, kind: "entry", expiresAt: 12000 };
    const player = { ...FOREST_PORTAL_POSITION, health: 5 };
    expect(canUseForestPortal(player, portal, 11999)).toBe(true);
    expect(canUseForestPortal(player, portal, 12000)).toBe(false);
    expect(canUseForestPortal({ ...player, x: player.x + 2.01 }, portal, 10000)).toBe(false);
    expect(canUseForestPortal({ ...player, y: player.y + 2 }, portal, 10000)).toBe(false);
    expect(canUseForestPortal({ ...player, health: 0 }, portal, 10000)).toBe(false);
    expect(canUseForestPortal(player, { ...portal, expiresAt: 0 }, 10000000)).toBe(true);
  });
  it("creates a guaranteed timed portal only after clearing the guard pair", () => {
    const { room, open } = fixture(); open();
    expect(room.state.portals.get("forest-entry")?.expiresAt).toBe(10000 + FOREST_PORTAL_LIFETIME_MS);
    expect(room.state.mobs.has("forest-room1-a")).toBe(false);
  });
  it("travels with gear intact, cancels old actions and sends destination chunks before play resumes", () => {
    const { room, internal, player, client, open } = fixture(); open();
    player.health = 3; player.coins = 123; player.powerCooldownUntil = 99999;
    internal.pendingAttacks.set("tester", {}); internal.pendingMining.set("tester", {}); internal.pendingPowers.set("tester", {});
    internal.useForestPortal(client, { id: "forest-entry" });
    expect({ x: player.x, y: player.y, z: player.z }).toEqual(FOREST_DUNGEON_ENTRY);
    expect(player.health).toBe(3); expect(player.coins).toBe(123); expect(player.powerCooldownUntil).toBe(99999);
    expect(internal.pendingAttacks.has("tester")).toBe(false); expect(internal.pendingMining.has("tester")).toBe(false); expect(internal.pendingPowers.has("tester")).toBe(false);
    const bootstrap = client.send.mock.calls.find((call: any[]) => call[0] === "world:bootstrap")[1];
    expect(bootstrap.spawn).toEqual(FOREST_DUNGEON_ENTRY);
    expect(bootstrap.chunks.some((chunk: any) => chunk.chunkX === 10 && chunk.chunkZ === 10)).toBe(true);
    expect(isPlayerSupported(internal.readWorldBlock, player.x, player.y, player.z)).toBe(true);
    expect(playerCollides(internal.readWorldBlock, player.x, player.y, player.z)).toBe(false);
    expect(room.state.portals.get("forest-return")?.expiresAt).toBe(0);
    expect(room.state.mobs.has("forest-room1-a")).toBe(false);
    expect(internal.forestDungeonRun.startedAt).toBe(0);
    internal.handleDungeonLobby(client, { action: "ready" });
    expect(internal.forestDungeonRun.startedAt).toBe(10000);
    expect(room.state.mobs.has("forest-room1-a")).toBe(true);
    expect(room.state.portals.has("forest-entry")).toBe(false);
  });
  it("clears the dungeon, locks extraction until the personal cache is claimed and grants its complete bundle once", () => {
    const { room, internal, player, client, kill, open, ready } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" }); ready();
    (room.clients as any[]).push(client);
    expect(internal.readWorldBlock(168, 8, 165)).toBe(Block.OakLog);
    expect(isProtectedVoxel(168, 165)).toBe(true);
    for (const stage of [1, 2]) {
      const entries = FOREST_DUNGEON_MOBS.filter(mob => mob.stage === stage);
      for (const entry of entries) {
        Object.assign(player, entry); kill(entry.id);
      }
      expect(internal.readWorldBlock(stage === 1 ? 168 : 180, 8, 165)).toBe(Block.Air);
    }
    expect(client.send.mock.calls.filter((call: any[]) => call[0] === "portal:notice" && String(call[1]).includes("gate has opened"))).toHaveLength(2);
    Object.assign(player, { x: 187.5, y: 8, z: 165.5 }); kill("forest-guardian");
    const cacheId = [...room.state.lootDrops.keys()].find(id => id.startsWith("forest-cache:"))!;
    const cache = room.state.lootDrops.get(cacheId)!;
    expect(cache).toMatchObject({ ownerId: "tester", itemId: "rootbound_hammer" });
    expect([...room.state.lootDrops.values()].some(drop => drop.ownerId === "tester" && drop.itemId === "stone_core_hammer")).toBe(false);
    expect(room.state.portals.has("forest-victory")).toBe(true);
    expect(player.forestBestTimeMs).toBeGreaterThan(0);
    expect(client.send).toHaveBeenCalledWith("dungeon:run", expect.objectContaining({ phase: "completed", reward: expect.stringContaining("Rootbound Hammer") }));
    const victoryPortal = room.state.portals.get("forest-victory")!;
    Object.assign(player, { x: victoryPortal.x, y: victoryPortal.y, z: victoryPortal.z }); vi.setSystemTime(12000);
    internal.useForestPortal(client, { id: "forest-victory" });
    expect(player.x).toBe(room.state.portals.get("forest-victory")!.x);
    expect(client.send).toHaveBeenCalledWith("portal:notice", expect.stringContaining("Rootbound Cache"));
    Object.assign(player, { x: cache.x, y: cache.y, z: cache.z });
    const goldBefore = player.coins;
    internal.handleLootCollect(client, { dropId: cacheId, equip: false });
    expect(room.state.lootDrops.has(cacheId)).toBe(false);
    expect(internal.forestDungeonRun.claimed.has("tester")).toBe(true);
    expect(player.coins).toBe(goldBefore + 12);
    expect(player.inventory.get("stone_core")?.quantity).toBe(3);
    expect(player.inventory.get("iron_ore")?.quantity).toBe(2);
    expect(player.inventory.get("healing_potion")?.quantity).toBe(1);
    expect(player.inventory.get("rootbound_hammer")?.quantity).toBe(1);
    expect(client.send).toHaveBeenCalledWith("dungeon:reward", expect.objectContaining({ goldGranted: 12 }));
    internal.handleLootCollect(client, { dropId: cacheId, equip: false });
    expect(player.coins).toBe(goldBefore + 12);
    Object.assign(player, { x: victoryPortal.x, y: victoryPortal.y, z: victoryPortal.z }); vi.setSystemTime(14000);
    internal.useForestPortal(client, { id: "forest-victory" });
    expect({ x: player.x, y: player.y, z: player.z }).toEqual(FOREST_PORTAL_POSITION);
    vi.setSystemTime(30000); internal.simulatePlayers(.033);
    expect(FOREST_DUNGEON_MOBS.every(entry => room.state.mobs.get(entry.id)?.alive !== true)).toBe(true);
  });
  it("grants Rootguard Armour after the hammer and converts a stale duplicate into veteran supplies", () => {
    const { room, internal, player, client } = fixture();
    const hammer = new InventoryItemState(); hammer.quantity = 1; player.inventory.set("rootbound_hammer", hammer);
    internal.forestDungeonRun = { id: "replay", allowed: new Set(["tester"]), entered: new Set(["tester"]), ready: new Set(),
      claimed: new Set(), scalePlayers: 1, startedAt: 9000, completedAt: 10000 };
    const cache = new LootDropState(); Object.assign(cache, { ownerId: "tester", itemId: "rootguard_armour", quantity: 1,
      x: player.x, y: player.y, z: player.z, expiresAt: Number.MAX_SAFE_INTEGER });
    room.state.lootDrops.set("forest-cache:replay:tester", cache);
    internal.handleLootCollect(client, { dropId: "forest-cache:replay:tester", equip: false });
    expect(player.inventory.get("rootguard_armour")?.quantity).toBe(1);

    internal.forestDungeonRun.claimed.clear(); internal.forestDungeonRun.id = "duplicate";
    const duplicate = new LootDropState(); Object.assign(duplicate, { ownerId: "tester", itemId: "rootguard_armour", quantity: 1,
      x: player.x, y: player.y, z: player.z, expiresAt: Number.MAX_SAFE_INTEGER });
    room.state.lootDrops.set("forest-cache:duplicate:tester", duplicate);
    const gold = player.coins;
    internal.handleLootCollect(client, { dropId: "forest-cache:duplicate:tester", equip: false });
    expect(player.inventory.get("rootguard_armour")?.quantity).toBe(1);
    expect(player.inventory.get("silver_ore")?.quantity).toBe(3);
    expect(player.coins).toBe(gold + 30);
  });
  it("uses complementary spitter patterns in room two and switches the guardian from volleys to charges below half health", () => {
    const { room, internal, player, client, kill, open, ready } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" }); ready();
    for (const entry of FOREST_DUNGEON_MOBS.filter(mob => mob.stage === 1)) { Object.assign(player, entry); kill(entry.id); }
    vi.setSystemTime(10100); internal.simulatePlayers(.033);
    const roomTwo = FOREST_DUNGEON_MOBS.filter(entry => entry.stage === 2).map(entry => room.state.mobs.get(entry.id)!);
    expect(roomTwo.map(mob => mob.archetype)).toEqual(["cave_spitter", "cave_spitter"]);
    expect(roomTwo.map(mob => mob.attackPattern)).toEqual(["aimed", "fan"]);
    for (const entry of FOREST_DUNGEON_MOBS.filter(mob => mob.stage === 2)) { Object.assign(player, entry); kill(entry.id); }
    const guardian = room.state.mobs.get("forest-guardian")!;
    expect(guardian.isChampion).toBe(true); expect(guardian.maxHealth).toBe(28);
    Object.assign(player, { x: guardian.x, y: 8, z: guardian.z + 6, health: 10000, maxHealth: 10000, invulnerableUntil: 100000 });
    vi.setSystemTime(10200); internal.simulatePlayers(.033);
    expect(guardian.enraged).toBe(false); expect(guardian.attackPattern).toBe("rocks");
    internal.clearMobAttackTimeline(guardian); internal.pendingMobMelee.delete("forest-guardian");
    Object.assign(guardian, { combatState: "idle", stateUntil: 0, targetId: "", actionSequence: 1, health: 13 });
    Object.assign(player, { x: guardian.x, z: guardian.z + 3 });
    vi.setSystemTime(10300); internal.simulatePlayers(.033);
    expect(guardian.enraged).toBe(true); expect(guardian.attackPattern).toBe("charge");
    expect(guardian.combatState).toBe("windup");
  });
  it("creates cardinal root hazards with diagonal safe gaps and restores breakable Guardian cover", () => {
    const { room, internal } = fixture();
    const mob = { attackStrikeX: 187.5, attackStrikeY: 8, attackStrikeZ: 165.5, actionSequence: 3 };
    internal.placeGuardianRootLanes(mob, 10000);
    expect(internal.mobHazards.size).toBe(12);
    expect([...internal.mobHazards.values()].every((hazard: any) => hazard.x === 187.5 || hazard.z === 165.5)).toBe(true);
    expect((room.broadcast as any).mock.calls.filter((call: any[]) => call[0] === "combat:mob-hazard" && call[1].kind === "root")).toHaveLength(12);
    const cover = FOREST_DUNGEON_COVER.find(prop => prop.stage === 3)!;
    internal.setGuardianCover(cover, true); expect(internal.readWorldBlock(cover.x, 8, cover.z)).toBe(Block.Air);
    internal.setGuardianCover(cover, false); expect(internal.readWorldBlock(cover.x, 8, cover.z)).toBe(Block.OakLog);
  });
  it("keeps a safe return available after the outside entrance expires", () => {
    const { room, internal, player, client, open } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" });
    vi.setSystemTime(140000); internal.simulatePlayers(.033);
    expect(room.state.portals.has("forest-entry")).toBe(false); expect(room.state.portals.has("forest-return")).toBe(true);
    Object.assign(player, FOREST_DUNGEON_EXIT); internal.useForestPortal(client, { id: "forest-return" });
    expect({ x: player.x, y: player.y, z: player.z }).toEqual(FOREST_PORTAL_POSITION);
    internal.simulatePlayers(.033); expect(room.state.mobs.has("forest-room1-a")).toBe(false); expect(room.state.portals.size).toBe(0);
  });
  it("admits the snapshotted party, rejects outsiders and never resets defeated rooms for a late party entrant", () => {
    const { room, internal, player, client, open, kill } = fixture(); open();
    const friend = new PlayerState(); Object.assign(friend, FOREST_PORTAL_POSITION); room.state.players.set("friend", friend);
    internal.parties.handle("tester", { action: "invite", targetId: "friend" }, room.state.players, 10000);
    const inviteId = internal.parties.snapshot("friend", room.state.players, 10000).invite.id;
    internal.parties.handle("friend", { action: "respond", inviteId, accept: true }, room.state.players, 10000);
    internal.useForestPortal(client, { id: "forest-entry" });
    const outsider = new PlayerState(); Object.assign(outsider, FOREST_PORTAL_POSITION); room.state.players.set("outsider", outsider);
    const outsiderClient = { sessionId: "outsider", send: vi.fn() } as any;
    internal.useForestPortal(outsiderClient, { id: "forest-entry" });
    expect(outsider.x).toBe(FOREST_PORTAL_POSITION.x);
    expect(outsiderClient.send).toHaveBeenCalledWith("portal:notice", expect.stringContaining("occupied"));
    const friendClient = { sessionId: "friend", send: vi.fn() } as any;
    internal.useForestPortal(friendClient, { id: "forest-entry" });
    expect(room.state.mobs.has("forest-room1-a")).toBe(false);
    internal.handleDungeonLobby(client, { action: "ready" }); internal.handleDungeonLobby(friendClient, { action: "ready" });
    expect(friend.x).toBe(FOREST_DUNGEON_ENTRY.x); expect(room.state.mobs.get("forest-room1-a")?.maxHealth).toBe(10);
    Object.assign(player, { x: 164.5, y: 8, z: 161.5 }); kill("forest-room1-a");
    expect(internal.forestReturns.size).toBe(2);
  });
  it("rejects forged IDs, remote entry, expired entry and dead players", () => {
    const { internal, player, client, open } = fixture(); open();
    internal.useForestPortal(client, { id: "forged" }); expect(player.x).toBe(FOREST_PORTAL_POSITION.x);
    player.x += 10; internal.useForestPortal(client, { id: "forest-entry" }); expect(player.x).not.toBe(FOREST_DUNGEON_ENTRY.x);
    Object.assign(player, FOREST_PORTAL_POSITION); player.health = 0; internal.useForestPortal(client, { id: "forest-entry" }); expect(player.x).toBe(FOREST_PORTAL_POSITION.x);
    player.health = 5; vi.setSystemTime(140000); internal.useForestPortal(client, { id: "forest-entry" }); expect(player.x).toBe(FOREST_PORTAL_POSITION.x);
  });
  it("ends an abandoned run after death-return without losing the recovery bag", () => {
    const { room, internal, player, client, open, ready } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" }); ready();
    const ore = new InventoryItemState(); ore.quantity = 3; player.inventory.set("silver_ore", ore);
    vi.setSystemTime(12000); internal.damagePlayer("forest-room1-a", "tester", 99, Date.now(), false);
    expect(player.health).toBe(0); const bags = player.recoveryBags.size; expect(bags).toBe(1);
    internal.returnPlayerToTown(client); internal.simulatePlayers(.033);
    expect(player.health).toBe(5); expect(player.recoveryBags.size).toBe(bags);
    expect(room.state.portals.size).toBe(0); expect(internal.forestDungeonActive).toBe(false);
    Object.assign(player, TOWN_EXPEDITION_BOARD_POSITION); vi.setSystemTime(57000); internal.simulatePlayers(.033);
    internal.handleDungeonBoard(client, { action: "open" });
    expect(room.state.portals.has("forest-entry")).toBe(true);
    Object.assign(player, TOWN_EXPEDITION_PORTAL_POSITION);
    internal.useForestPortal(client, { id: "forest-entry" });
    expect(player.x).toBe(FOREST_DUNGEON_ENTRY.x);
  });
});
