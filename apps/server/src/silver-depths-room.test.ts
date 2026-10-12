import { describe, expect, it, vi } from "vitest";
import { MATRIARCH_PHASE, SILVER_DEPTHS_ROOM, WORLD_ROOM, crystalMatriarchPattern, spitterShotEndpoints } from "@blockcraft/protocol";
import { Block, SILVER_DEPTHS_BOSS_GATE, SILVER_DEPTHS_COVER, SILVER_DEPTHS_ENTRY_POSITION, SILVER_DEPTHS_GALLERY_GATE, SILVER_DEPTHS_IRON_GATE, SILVER_DEPTHS_SILVER_GATE, SILVER_DEPTHS_PARTY_SPAWNS, SILVER_DEPTHS_EXIT_POSITION, SILVER_DEPTHS_MOONSTONE_SEAL_POSITION, TOWN_SILVER_DEPTHS_PORTAL_POSITION } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { silverDepthsStageSpawns } from "./silver-depths-encounters.js";

function roomWithPortal(id: "depths-entry" | "depths-return") {
  const room = new WorldRoom(); room.setState(new WorldState());
  const player = new PlayerState();
  Object.assign(player, id === "depths-entry" ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : SILVER_DEPTHS_EXIT_POSITION,
    { level: 7, miningExpeditionStage: 8, silverDepthsStage: id === "depths-entry" ? 1 : 6 });
  room.state.players.set("miner", player);
  const portal = new ForestPortalState(); Object.assign(portal,
    id === "depths-entry" ? TOWN_SILVER_DEPTHS_PORTAL_POSITION : SILVER_DEPTHS_EXIT_POSITION,
    { kind: id === "depths-entry" ? "entry" : "return" });
  room.state.portals.set(id, portal);
  const client = { sessionId: "miner", send: vi.fn() };
  vi.spyOn(room as any, "persistPlayer").mockResolvedValue(undefined);
  return { room, player, client };
}

describe("Silver Depths room travel", () => {
  it("reserves a disconnected player's dungeon seat and restores their run on reconnect", () => {
    const { room, player, client } = roomWithPortal("depths-return");
    const internal = room as any;
    internal.roomKind = "silver-depths";
    player.x = 94.5; player.z = 12.5; player.silverDepthsRunStage = 4;
    const run = { completedAt: 0, startedAt: 1234 };
    internal.silverDepthsRuns.set(client.sessionId, run);
    const drop = new InventoryItemState(); drop.quantity = 1;
    player.inventory.set("iron_ore", drop);
    const reserve = vi.spyOn(room, "allowReconnection").mockImplementation(() => ({ catch: () => undefined }) as any);
    room.onDrop(client as any);
    expect(reserve).toHaveBeenCalledWith(client, 45);
    expect(room.state.players.get(client.sessionId)).toBe(player);
    expect(internal.silverDepthsRuns.get(client.sessionId)).toBe(run);
    expect(player).toMatchObject({ x: 94.5, z: 12.5, silverDepthsRunStage: 4 });
    expect(player.inventory.get("iron_ore")?.quantity).toBe(1);
    expect(player.invulnerableUntil).toBeGreaterThan(Date.now());
    room.onReconnect(client as any);
    expect(room.state.players.get(client.sessionId)).toBe(player);
    expect(internal.silverDepthsRuns.get(client.sessionId)).toBe(run);
    expect(internal.silverDepthsReconnectInvulnerability.has(client.sessionId)).toBe(false);
    expect(player.invulnerableUntil).toBeLessThanOrEqual(Date.now() + 1300);
  });

  it("does not reserve an overworld seat on disconnect", () => {
    const { room, client } = roomWithPortal("depths-entry");
    const reserve = vi.spyOn(room, "allowReconnection").mockImplementation(() => undefined as any);
    room.onDrop(client as any);
    expect(reserve).not.toHaveBeenCalled();
  });

  it("cleans up a dungeon player when the reconnect window expires", async () => {
    const { room, client } = roomWithPortal("depths-return");
    const internal = room as any;
    internal.roomKind = "silver-depths";
    vi.spyOn(room, "allowReconnection").mockImplementation(() => ({ catch: () => undefined }) as any);
    room.onDrop(client as any);
    await room.onLeave(client as any);
    expect(room.state.players.has(client.sessionId)).toBe(false);
    expect(internal.silverDepthsReconnectInvulnerability.has(client.sessionId)).toBe(false);
  });

  it("releases six crystal shots after a longer tell and grants a full counter window", () => {
    const { room } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.registerMob("crystal-matriarch", "cave_spitter", { x: 131.5, y: 1, z: 14.5 });
    const boss = room.state.mobs.get("crystal-matriarch")!;
    boss.isChampion = true;
    boss.attackPattern = crystalMatriarchPattern(1, false);
    expect(boss.attackPattern).toBe("crystal-burst");
    internal.setMobAttackTimeline(boss, 1000, 1000 + MATRIARCH_PHASE.crystalBurstWindupMs, "crystal-matriarch");
    expect(boss.attackRecoveryEndAt - boss.attackReleaseAt).toBe(MATRIARCH_PHASE.crystalBurstRecoveryMs);
    const origin = { x: boss.x, y: boss.y, z: boss.z };
    const shots = spitterShotEndpoints(origin, boss.yaw, boss.attackPattern);
    internal.releaseMobVolley("crystal-matriarch", boss, origin, shots, boss.attackReleaseAt, 1250, 1, 0, 0);
    expect(internal.pendingMobProjectiles.size).toBe(6);
    expect(vi.mocked(room.broadcast).mock.calls.map(([, message]) => message.kind)).toEqual(Array(6).fill("crystal"));
  });

  it("lets Matriarch projectiles shatter cover after two hits and restores it for a new encounter", () => {
    const { room } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const cover = SILVER_DEPTHS_COVER[0];
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
    const impact = { x: cover.x + .5, y: 1.5, z: cover.z + .5 };
    internal.damageMatriarchCover(impact);
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
    internal.damageMatriarchCover(impact);
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Air);
    internal.restoreMatriarchCover();
    expect(internal.readWorldBlock(cover.x, 1, cover.z)).toBe(Block.Stone);
  });

  it("creates a personal fixed Matriarch's Edge drop", () => {
    const { room } = roomWithPortal("depths-entry");
    const boss = new MobState(); Object.assign(boss, { x: 72.5, y: 1, z: 9.5, archetype: "cave_spitter" });
    (room as any).spawnLootDrops("crystal-matriarch", boss, 10_000, "miner");
    expect([...room.state.lootDrops.values()]).toContainEqual(expect.objectContaining({ ownerId: "miner", itemId: "matriarch_edge", quantity: 1 }));
  });

  it("transfers an accepted player from the overworld into a private dungeon room", async () => {
    const { room, player, client } = roomWithPortal("depths-entry");
    (room as any).useSilverDepthsPortal(client, { id: "depths-entry" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", expect.objectContaining({
      room: SILVER_DEPTHS_ROOM, instanceKey: expect.stringMatching(/^silver-/), partySize: 1,
    })));
    expect(player.silverDepthsStage).toBe(1);
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
  });

  it("allows direct test transfer before the level and expedition gates", async () => {
    const { room, player, client } = roomWithPortal("depths-entry");
    Object.assign(player, { level: 1, miningExpeditionStage: 0, silverDepthsStage: 0 });
    (room as any).useSilverDepthsPortal(client, { id: "depths-entry" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", expect.objectContaining({ room: SILVER_DEPTHS_ROOM })));
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
  });

  it("provides four separated spawn slots inside each dungeon instance", () => {
    expect(SILVER_DEPTHS_PARTY_SPAWNS).toHaveLength(4);
    for (let a = 0; a < SILVER_DEPTHS_PARTY_SPAWNS.length; a++) for (let b = a + 1; b < SILVER_DEPTHS_PARTY_SPAWNS.length; b++) {
      const first = SILVER_DEPTHS_PARTY_SPAWNS[a]!, second = SILVER_DEPTHS_PARTY_SPAWNS[b]!;
      expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(3);
    }
  });

  it("opens all six party lanes when one Moonstone seal block is mined", () => {
    const { room, player, client } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    vi.spyOn(internal, "recordWorldDelta").mockImplementation(() => {});
    internal.roomKind = "silver-depths";
    player.silverDepthsStage = 2;
    internal.beginSilverDepthsRun(client, player, 10_000);
    internal.restoreSilverDepthsMoonstone();
    internal.openSilverDepthsMoonstoneGate("test-seal");
    const x = Math.floor(SILVER_DEPTHS_MOONSTONE_SEAL_POSITION.x);
    for (let z = 10; z <= 15; z++) expect(internal.readWorldBlock(x, 1, z)).toBe(Block.Air);
    expect(player.silverDepthsRunStage).toBe(2);
    expect(player.silverDepthsStage).toBe(3);
    expect([...room.state.lootDrops.keys()].filter(id => id.startsWith("depths-supply:miner"))).toHaveLength(2);
  });

  it("runs two gallery waves, activates the checkpoint, then unlocks and scales the boss", () => {
    const { room, player, client } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    vi.spyOn(internal, "recordWorldDelta").mockImplementation(() => {});
    internal.roomKind = "silver-depths"; internal.instancePartySize = 2; player.silverDepthsStage = 2;
    internal.resetSilverDepthsInstance(); internal.beginSilverDepthsRun(client, player, 10_000);
    internal.openSilverDepthsMoonstoneGate("test-seal");
    const clear = (stage: 1 | 2 | 3) => {
      const entries = silverDepthsStageSpawns(stage, "iron");
      for (const entry of entries.slice(0, -1)) room.state.mobs.get(entry.id)!.alive = false;
      internal.advanceSilverDepthsEncounter(entries.at(-1)!.id);
    };
    clear(1);
    expect(player.silverDepthsRunStage).toBe(3);
    expect(internal.readWorldBlock(SILVER_DEPTHS_IRON_GATE.minX, 1, SILVER_DEPTHS_IRON_GATE.z)).toBe(Block.Stone);
    expect(silverDepthsStageSpawns(2, "iron").some(entry => room.state.mobs.has(entry.id))).toBe(false);
    Object.assign(player, { x: 94.5, y: 1, z: 14.5 });
    internal.chooseSilverDepthsWing(client, { wing: "iron" });
    expect(player.silverDepthsWing).toBe("iron");
    expect(internal.readWorldBlock(SILVER_DEPTHS_IRON_GATE.minX, 1, SILVER_DEPTHS_IRON_GATE.z)).toBe(Block.Air);
    expect(internal.readWorldBlock(SILVER_DEPTHS_SILVER_GATE.minX, 1, SILVER_DEPTHS_SILVER_GATE.z)).toBe(Block.Stone);
    expect(silverDepthsStageSpawns(2, "iron").every(entry => room.state.mobs.has(entry.id))).toBe(true);
    expect(silverDepthsStageSpawns(2, "silver").some(entry => room.state.mobs.has(entry.id))).toBe(false);
    player.health = 1; player.stamina = 1; clear(2);
    expect(player.silverDepthsRunStage).toBe(4);
    expect(room.state.lootDrops.get("depths-wing-reward:miner")).toMatchObject({ ownerId: "miner", itemId: "iron_ore", quantity: 5 });
    expect(player.health).toBe(player.maxHealth); expect(player.stamina).toBe(player.maxStamina);
    expect(internal.readWorldBlock(SILVER_DEPTHS_GALLERY_GATE.x, 1, SILVER_DEPTHS_GALLERY_GATE.minZ)).toBe(Block.Air);
    clear(3);
    expect(player.silverDepthsRunStage).toBe(5);
    expect(internal.readWorldBlock(SILVER_DEPTHS_BOSS_GATE.x, 1, SILVER_DEPTHS_BOSS_GATE.minZ)).toBe(Block.Air);
    expect(room.state.mobs.get("crystal-matriarch")).toMatchObject({ health: 40, maxHealth: 40, alive: true });
  });

  it("locks the alternative route for every party member and gives each a personal silver reward", () => {
    const { room, player, client } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.roomKind = "silver-depths"; player.silverDepthsStage = 3;
    Object.assign(player, { x: 94.5, y: 1, z: 14.5, silverDepthsRunStage: 3 });
    const friend = new PlayerState(); Object.assign(friend, { x: 92.5, y: 1, z: 14.5, silverDepthsRunStage: 3 });
    room.state.players.set("friend", friend);
    internal.silverDepthsRuns.set("miner", { completedAt: 0 });
    internal.silverDepthsRuns.set("friend", { completedAt: 0 });
    internal.silverDepthsEncounterStage = 2;
    internal.chooseSilverDepthsWing(client, { wing: "silver" });
    expect(player.silverDepthsWing).toBe("silver");
    expect(friend.silverDepthsWing).toBe("silver");
    expect(internal.readWorldBlock(SILVER_DEPTHS_SILVER_GATE.minX, 1, SILVER_DEPTHS_SILVER_GATE.z)).toBe(Block.Air);
    expect(internal.readWorldBlock(SILVER_DEPTHS_IRON_GATE.minX, 1, SILVER_DEPTHS_IRON_GATE.z)).toBe(Block.Stone);
    internal.chooseSilverDepthsWing(client, { wing: "iron" });
    expect(internal.silverDepthsWing).toBe("silver");
    const entries = silverDepthsStageSpawns(2, "silver");
    for (const entry of entries.slice(0, -1)) room.state.mobs.get(entry.id)!.alive = false;
    internal.advanceSilverDepthsEncounter(entries.at(-1)!.id);
    for (const id of ["miner", "friend"]) expect(room.state.lootDrops.get(`depths-wing-reward:${id}`))
      .toMatchObject({ ownerId: id, itemId: "silver_ore", quantity: 3 });
    expect(player.silverDepthsRunStage).toBe(4);
    expect(friend.silverDepthsRunStage).toBe(4);
    internal.resetSilverDepthsInstance();
    expect(internal.readWorldBlock(SILVER_DEPTHS_SILVER_GATE.minX, 1, SILVER_DEPTHS_SILVER_GATE.z)).toBe(Block.Stone);
    expect(room.state.lootDrops.has("depths-wing-reward:friend")).toBe(false);
  });

  it("warns before an Iron Bastion rock and only hurts players still in its marked circle", () => {
    const { room, player } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.roomKind = "silver-depths"; internal.silverDepthsEncounterStage = 2; internal.silverDepthsWing = "iron";
    internal.silverDepthsRuns.set("miner", { completedAt: 0 });
    Object.assign(player, { x: 100.5, y: 1, z: -6.5, health: 5, maxHealth: 5, invulnerableUntil: 0 });
    internal.silverDepthsNextHazardAt = 1_000;
    internal.advanceSilverDepthsRouteHazards(1_000);
    expect(room.broadcast).toHaveBeenCalledWith("depths:hazard", expect.objectContaining({ kind: "falling-rock", impactAt: 2_500 }));
    internal.advanceSilverDepthsRouteHazards(2_499);
    expect(player.health).toBe(5);
    player.x = 104.5;
    internal.advanceSilverDepthsRouteHazards(2_500);
    expect(player.health).toBe(5);
    internal.silverDepthsNextHazardAt = 8_000;
    internal.advanceSilverDepthsRouteHazards(8_000);
    internal.advanceSilverDepthsRouteHazards(9_500);
    expect(player.health).toBe(3);
  });

  it("pulses Silver Echo lanes while leaving a safe middle corridor and stops after the wave", () => {
    const { room, player } = roomWithPortal("depths-entry"); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.roomKind = "silver-depths"; internal.silverDepthsEncounterStage = 2; internal.silverDepthsWing = "silver";
    internal.silverDepthsRuns.set("miner", { completedAt: 0 });
    Object.assign(player, { x: 100.5, y: 1, z: 31.5, health: 5, maxHealth: 5, invulnerableUntil: 0 });
    internal.silverDepthsNextHazardAt = 1_000;
    internal.advanceSilverDepthsRouteHazards(1_000);
    expect(vi.mocked(room.broadcast).mock.calls.filter(([type]) => type === "depths:hazard")).toHaveLength(2);
    internal.advanceSilverDepthsRouteHazards(2_700);
    expect(player.health).toBe(5);
    Object.assign(player, { x: 96.5, z: 32.5 });
    internal.silverDepthsNextHazardAt = 8_000;
    internal.advanceSilverDepthsRouteHazards(8_000);
    internal.advanceSilverDepthsRouteHazards(9_700);
    expect(player.health).toBe(4);
    internal.silverDepthsEncounterStage = 3;
    internal.advanceSilverDepthsRouteHazards(16_000);
    expect(vi.mocked(room.broadcast).mock.calls.filter(([type]) => type === "depths:hazard")).toHaveLength(4);
  });

  it("only transfers back to the overworld after the fixed boss weapon is claimed", async () => {
    const { room, player, client } = roomWithPortal("depths-return");
    (room as any).roomKind = "silver-depths";
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    expect(player.silverDepthsStage).toBe(6);
    expect(client.send).toHaveBeenCalledWith("portal:notice", expect.stringContaining("Matriarch's Edge"));

    const edge = new InventoryItemState(); edge.quantity = 1; player.inventory.set("matriarch_edge", edge);
    const stone = new InventoryItemState(); stone.quantity = 1; player.inventory.set("moonstone", stone);
    (room as any).useSilverDepthsPortal(client, { id: "depths-return" });
    await vi.waitFor(() => expect(client.send).toHaveBeenCalledWith("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths" }));
    expect(player.silverDepthsStage).toBe(7);
    expect(player).toMatchObject(SILVER_DEPTHS_EXIT_POSITION);
    expect(player.inventory.get("moonstone")?.quantity).toBe(0);
  });

  it("leaves the dungeon room after defeat so refreshing cannot re-enter the instance", async () => {
    const { room, player, client } = roomWithPortal("depths-return");
    (room as any).roomKind = "silver-depths";
    Object.assign(player, { health: 0, x: 83.5, y: 1, z: 9.5 });

    await (room as any).returnPlayerToTown(client);

    expect(player.health).toBe(player.maxHealth);
    expect(player).toMatchObject(TOWN_SILVER_DEPTHS_PORTAL_POSITION);
    expect(client.send).toHaveBeenCalledWith("room:transfer", { room: WORLD_ROOM, returnFrom: "silver-depths" });
    expect(client.send).not.toHaveBeenCalledWith("player:returned", expect.anything());
    expect((room as any).persistPlayer).toHaveBeenCalledWith("miner", player, true);
  });

  it("reports authoritative run stats, rank, and a persisted personal best", () => {
    const { room, player, client } = roomWithPortal("depths-entry"); const internal = room as any;
    internal.beginSilverDepthsRun(client, player, 10_000);
    expect(player.silverDepthsRunStage).toBe(1);
    const run = internal.silverDepthsRuns.get("miner");
    Object.assign(run, { completedAt: 160_000, enemiesDefeated: 3, damageTaken: 2, moonstoneCollected: 1 });
    const edge = new InventoryItemState(); edge.quantity = 1; player.inventory.set("matriarch_edge", edge);
    internal.completeSilverDepthsRun(client, player, run);
    expect(client.send).toHaveBeenLastCalledWith("dungeon:run", expect.objectContaining({
      dungeon: "silver-depths", phase: "completed", durationMs: 150_000, rank: "GOLD", bestTimeMs: 150_000, newBest: true,
      stats: { enemiesDefeated: 3, damageTaken: 2, moonstoneCollected: 1, moonstoneAwarded: 3, moonstoneTotal: 3, signatureItemObtained: true },
    }));
    expect(player.inventory.get("moonstone")?.quantity).toBe(3);
    expect(player.silverDepthsBestTimeMs).toBe(150_000);
    expect(internal.silverDepthsRuns.has("miner")).toBe(false);
  });
});
