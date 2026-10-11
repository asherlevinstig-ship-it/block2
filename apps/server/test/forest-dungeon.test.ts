import { afterEach, describe, expect, it, vi } from "vitest";
import { canUseForestPortal, FOREST_PORTAL_LIFETIME_MS } from "@blockcraft/protocol";
import { Block, FOREST_PORTAL_POSITION, FOREST_DUNGEON_ENTRY, FOREST_DUNGEON_EXIT, FOREST_DUNGEON_MOBS, FOREST_DUNGEON_COVER, isProtectedVoxel, isPlayerSupported, playerCollides } from "@blockcraft/voxel-world";
import { ForestPortalCycle } from "../src/forest-portal-cycle.js";
import { WorldRoom } from "../src/game-room.js";
import { InventoryItemState, PlayerState, WorldState } from "../src/schema.js";
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
  return { room, internal, player, client, kill, open };
}
describe("forest dungeon portal", () => {
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
  });
  it("clears two gated rooms, spawns the guardian once, guarantees a personal hammer and never respawns slain dungeon mobs", () => {
    const { room, internal, player, client, kill, open } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" });
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
    expect([...room.state.lootDrops.values()].some(drop => drop.ownerId === "tester" && drop.itemId === "stone_core_hammer")).toBe(true);
    expect(room.state.portals.has("forest-victory")).toBe(true);
    vi.setSystemTime(30000); internal.simulatePlayers(.033);
    expect(FOREST_DUNGEON_MOBS.every(entry => room.state.mobs.get(entry.id)?.alive === false)).toBe(true);
  });
  it("uses complementary spitter patterns in room two and switches the guardian from volleys to charges below half health", () => {
    const { room, internal, player, client, kill, open } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" });
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
  it("allows a second player to join the same run without resetting defeated rooms", () => {
    const { room, internal, player, client, open, kill } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" });
    Object.assign(player, { x: 164.5, y: 8, z: 161.5 }); kill("forest-room1-a");
    const friend = new PlayerState(); Object.assign(friend, FOREST_PORTAL_POSITION); room.state.players.set("friend", friend);
    internal.useForestPortal({ sessionId: "friend", send: vi.fn() }, { id: "forest-entry" });
    expect(friend.x).toBe(FOREST_DUNGEON_ENTRY.x); expect(room.state.mobs.get("forest-room1-a")?.alive).toBe(false);
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
    const { room, internal, player, client, open } = fixture(); open(); internal.useForestPortal(client, { id: "forest-entry" });
    const ore = new InventoryItemState(); ore.quantity = 3; player.inventory.set("silver_ore", ore);
    vi.setSystemTime(12000); internal.damagePlayer("forest-room1-a", "tester", 99, Date.now(), false);
    expect(player.health).toBe(0); const bags = player.recoveryBags.size; expect(bags).toBe(1);
    internal.returnPlayerToTown(client); internal.simulatePlayers(.033);
    expect(player.health).toBe(5); expect(player.recoveryBags.size).toBe(bags);
    expect(room.state.portals.size).toBe(0); expect(internal.forestDungeonActive).toBe(false);
  });
});
