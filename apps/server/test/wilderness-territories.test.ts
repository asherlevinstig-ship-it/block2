import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, MINERAL_DEPOSITS, RENEWABLE_MINERAL_DEPOSITS, TOWN_BLACKSMITH_STALL_POSITION, wildernessTerritoryAt, wildernessSurfaceBlock, authoredMineralAt, playerCollides } from "@blockcraft/voxel-world";
import { WILDERNESS_ENCOUNTERS, ASHEN_SENTRY_IDS, ashenSentryAllows, ashenSentryPattern, isAshenSentry, isGreenwoodCampMob, isMistfenMob, isNorthwatchMob, northwatchAllows, northwatchShardPattern, isSouthernQuarryMob, southernQuarryAllows } from "../src/wilderness-encounters.js";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { parseNorthwatchProgress, withNorthwatchProgress } from "../src/northwatch-progress.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave } from "../src/player-save.js";
import { equipmentReforgeRank } from "../src/equipment-reforge.js";
import { dangerBandAt, MOB_TOWN_MINIMUM_RADIUS, radiusFromSafeCenter } from "../src/radial-difficulty.js";
import { lootForArchetype } from "../src/loot-rules.js";
import { areaMiniBossDefinition, leaderForFollower } from "../src/area-mini-bosses.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any; vi.spyOn(room, "broadcast").mockImplementation(() => {});
  for (const spawn of WILDERNESS_ENCOUNTERS) internal.registerMob(spawn.id, spawn.archetype, spawn);
  return { room, internal };
}
describe("distinct radial wilderness territories", () => {
  it("keeps home safe and separates iron outskirts, silver wilds and stone frontier", () => {
    expect(wildernessTerritoryAt(8.5, 8.5)).toBeNull();
    expect(wildernessTerritoryAt(35, -5)?.tier).toBe(1);
    expect(wildernessTerritoryAt(48, 28)?.tier).toBe(2);
    expect(wildernessTerritoryAt(68, 27)?.tier).toBe(3);
    expect(wildernessSurfaceBlock(68, 27)).not.toBe(Block.Grass);
  });
  it("places crawlers in tier one, spitter pairs in tier two and brute guards in tier three", () => {
    const { room } = fixture();
    for (const spawn of WILDERNESS_ENCOUNTERS) {
      const mob = room.state.mobs.get(spawn.id)!;
      expect(mob.difficultyTier).toBe(dangerBandAt(spawn).tier);
      expect(radiusFromSafeCenter(mob)).toBeGreaterThanOrEqual(MOB_TOWN_MINIMUM_RADIUS - .001);
    }
    expect(WILDERNESS_ENCOUNTERS.filter(e => e.archetype === "cave_spitter" && !isAshenSentry(e.id))).toHaveLength(10);
    expect(WILDERNESS_ENCOUNTERS.filter(e => e.archetype === "ridge_stalker")).toHaveLength(4);
    expect(WILDERNESS_ENCOUNTERS.filter(e => e.archetype === "shard_sentry")).toHaveLength(2);
    expect(lootForArchetype("stone_brute", "", 0)).toContainEqual({ itemId: "stone_core_hammer", quantity: 1 });
    expect(lootForArchetype("stone_brute", "", .5)).not.toContainEqual({ itemId: "stone_core_hammer", quantity: 1 });
  });
  it("gives frontier deposits 50 renewable ore cells versus 18 in the wilds", () => {
    const { internal } = fixture();
    const statuses = internal.mineralStatus();
    for (const deposit of MINERAL_DEPOSITS) {
      const status = statuses.find((s: { id: string }) => s.id === `${deposit.x},${deposit.z}`);
      expect(status.available).toBe(status.total);
      expect(status.total).toBe(deposit.radius === 2 ? 50 : 18);
      expect(authoredMineralAt(deposit.x + deposit.radius, 7, deposit.z)).toBe(deposit.block);
    }
    expect(statuses).toHaveLength(RENEWABLE_MINERAL_DEPOSITS.length);
  });
  it("places every guard near the appropriate mineral site", () => {
    for (const spawn of WILDERNESS_ENCOUNTERS) {
      if (isAshenSentry(spawn.id) || isGreenwoodCampMob(spawn.id) || isMistfenMob(spawn.id) || isSouthernQuarryMob(spawn.id) || isNorthwatchMob(spawn.id)) continue;
      const block = spawn.archetype === "moss_crawler" ? Block.IronOre : Block.SilverOre;
      const nearest = Math.min(...MINERAL_DEPOSITS.filter(d => d.block === block && (spawn.archetype !== "stone_brute" || d.radius === 2))
        .map(d => Math.hypot(spawn.x - d.x, spawn.z - d.z)));
      expect(nearest).toBeLessThan(8);
    }
    for (const spawn of WILDERNESS_ENCOUNTERS.filter(spawn => isSouthernQuarryMob(spawn.id))) {
      expect(southernQuarryAllows(spawn)).toBe(true);
    }
    for (const spawn of WILDERNESS_ENCOUNTERS.filter(spawn => isNorthwatchMob(spawn.id))) {
      expect(northwatchAllows(spawn)).toBe(true);
    }
  });
  it("keeps Ashglass Sentries by the spire and gives them a distinct readable volley rhythm", () => {
    const { room, internal } = fixture();
    for (const id of ASHEN_SENTRY_IDS) {
      const mob = room.state.mobs.get(id)!;
      expect(mob.name).toBe(id === "ashglass-sentry-east" ? "Ashglass High Sentry" : "Ashglass Sentry");
      expect(mob.difficultyTier).toBe(3);
      expect(ashenSentryAllows(mob)).toBe(true);
      expect(internal.roamingAllowed(id, { x: 35, y: 8, z: 35 })).toBe(false);
    }
    expect([0, 1, 2, 3].map(ashenSentryPattern)).toEqual(["fan", "fan", "aimed", "fan"]);
  });
  it("keeps the Northwatch leader guarded and its trophy in the forge progression", () => {
    const { room, internal } = fixture();
    const leader = room.state.mobs.get("northwatch-watchbreaker")!;
    expect(leader.isMiniBoss).toBe(true);
    expect(leader.difficultyTier).toBe(3);
    expect(areaMiniBossDefinition("northwatch-watchbreaker")?.rewardItemId).toBe("watchbreaker_crest");
    expect(leaderForFollower("northwatch-briar")).toBe("northwatch-watchbreaker");
    expect(leaderForFollower("northwatch-guard")).toBe("northwatch-watchbreaker");
    expect(internal.roamingAllowed("northwatch-watchbreaker", { x: 8, y: 8, z: -20 })).toBe(false);
    expect([0, 1, 2, 3, 4].map(northwatchShardPattern)).toEqual(["aimed", "aimed", "fan", "aimed", "aimed"]);
    expect(lootForArchetype("ridge_stalker")).toContainEqual({ itemId: "crawler_fang", quantity: 1 });
    expect(lootForArchetype("shard_sentry")).toContainEqual({ itemId: "stone_core", quantity: 1 });
  });
  it("guarantees a personal Northwatch cloak once while its first bag is pending", () => {
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    const player = new PlayerState();
    room.state.players.set("player", player);
    const leader = room.state.mobs.get("northwatch-watchbreaker")!;
    internal.spawnLootDrops("northwatch-watchbreaker", leader, 10_000, "player");
    internal.spawnLootDrops("northwatch-watchbreaker", leader, 10_001, "player");
    const bags = [...room.state.lootDrops.values()].map(drop => decodeLootBagItems(drop.contentsJson));
    expect(bags).toHaveLength(2);
    expect(bags[0]).toContainEqual({ itemId: "northwatch_cloak", quantity: 1 });
    expect(bags[1]).not.toContainEqual({ itemId: "northwatch_cloak", quantity: 1 });
  });
  it("turns both Northwatch patrol kills into a one-clear Ridge Hide bonus", () => {
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    const player = new PlayerState();
    room.state.players.set("player", player);
    player.huntLoadoutsJson = withNorthwatchProgress(player.huntLoadoutsJson, { clears: 1, marks: 0 });
    for (const id of ["northwatch-scout", "northwatch-spitter"]) {
      const mob = room.state.mobs.get(id)!;
      internal.defeatMob(id, mob, "player", 10_000);
    }
    expect(parseNorthwatchProgress(player.huntLoadoutsJson).marks).toBe(3);
    const leader = room.state.mobs.get("northwatch-watchbreaker")!;
    leader.leaderRematchTier = 1;
    internal.spawnLootDrops("northwatch-watchbreaker", leader, 10_001, "player");
    const bag = [...room.state.lootDrops.values()].at(-1)!;
    expect(decodeLootBagItems(bag.contentsJson)).toContainEqual({ itemId: "ridge_hide", quantity: 3 });
    internal.defeatMob("northwatch-watchbreaker", leader, "player", 10_002);
    expect(parseNorthwatchProgress(player.huntLoadoutsJson)).toEqual({ clears: 2, marks: 0 });
  });
  it("keeps Northwatch progress when loadouts and attunements are edited", () => {
    const { internal } = fixture();
    const player = new PlayerState();
    player.huntLoadoutsJson = withNorthwatchProgress(player.huntLoadoutsJson, { clears: 2, marks: 1 });
    internal.setPlayerBuildData(player, []);
    expect(parseNorthwatchProgress(player.huntLoadoutsJson)).toEqual({ clears: 2, marks: 1 });
    internal.setEquipmentAttunements(player, {}, 0, {});
    expect(parseNorthwatchProgress(player.huntLoadoutsJson)).toEqual({ clears: 2, marks: 1 });
  });
  it("keeps Northwatch rewards personal without scaling its shared boss to nearby players", () => {
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    const leader = room.state.mobs.get("northwatch-watchbreaker")!;
    const veteran = new PlayerState(); Object.assign(veteran, { x: leader.x + 12, y: leader.y, z: leader.z });
    veteran.huntLoadoutsJson = withNorthwatchProgress(veteran.huntLoadoutsJson, { clears: 3, marks: 3 });
    const newcomer = new PlayerState(); Object.assign(newcomer, { x: leader.x + 14, y: leader.y, z: leader.z });
    room.state.players.set("veteran", veteran); room.state.players.set("newcomer", newcomer);
    expect(leader.leaderRematchTier).toBe(0);
    internal.spawnLootDrops("northwatch-watchbreaker", leader, 10_000, "veteran");
    internal.spawnLootDrops("northwatch-watchbreaker", leader, 10_001, "newcomer");
    const drops = [...room.state.lootDrops.values()];
    expect(decodeLootBagItems(drops[0]!.contentsJson)).toContainEqual({ itemId: "ridge_hide", quantity: 4 });
    expect(decodeLootBagItems(drops[1]!.contentsJson).some(entry => entry.itemId === "ridge_hide")).toBe(false);
    veteran.x = 200;
    expect(leader.leaderRematchTier).toBe(0);
  });
  it("gives Assassins a fixed burst opening when a Northwatch escort falls", () => {
    const { room, internal } = fixture();
    const boss = room.state.mobs.get("northwatch-watchbreaker")!;
    const assassin = new PlayerState();
    assassin.huntLoadoutsJson = JSON.stringify({ buildPath: { selectedPathId: "assassin" } });
    const tank = new PlayerState();
    internal.openAreaLeaderAfterFollowerDefeat("northwatch-guard", 10_000);
    expect(boss.combatState).toBe("recover");
    expect(internal.northwatchAssassinOpening(assassin, "northwatch-watchbreaker", 10_001)).toBe(2);
    expect(internal.northwatchAssassinOpening(tank, "northwatch-watchbreaker", 10_001)).toBe(0);
    expect(internal.northwatchAssassinOpening(assassin, "northwatch-watchbreaker", 12_500)).toBe(0);
  });
  it("applies the Northwatch Assassin opening to a real weapon hit", () => {
    const { room, internal } = fixture();
    const boss = room.state.mobs.get("northwatch-watchbreaker")!;
    boss.health = boss.maxHealth = 100; boss.armor = 0;
    const assassin = new PlayerState(); Object.assign(assassin, { x: boss.x + 1, y: boss.y, z: boss.z });
    assassin.huntLoadoutsJson = JSON.stringify({ buildPath: { selectedPathId: "assassin" } });
    room.state.players.set("assassin", assassin);
    internal.applyWeaponHit("assassin", { mainHandId: "longsword", step: 1 }, "northwatch-watchbreaker", 9_000);
    const normalDamage = 100 - boss.health;
    boss.health = 100; boss.combatState = "idle";
    internal.openAreaLeaderAfterFollowerDefeat("northwatch-guard", 10_000);
    internal.applyWeaponHit("assassin", { mainHandId: "longsword", step: 1 }, "northwatch-watchbreaker", 10_001);
    expect(100 - boss.health).toBe(normalDamage + 2);
  });
  it("gives nearby Northwatch damage and defensive contributors personal loot after a long fight", () => {
    vi.useFakeTimers(); vi.setSystemTime(90_000); vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const boss = room.state.mobs.get("northwatch-watchbreaker")!;
    for (const id of ["tank", "assassin", "spectator"]) {
      const player = new PlayerState(); Object.assign(player, { x: boss.x + 2, y: boss.y, z: boss.z });
      room.state.players.set(id, player);
    }
    internal.combatContributions.recordSupport("northwatch-watchbreaker", "tank", 3, 10_000);
    internal.combatContributions.record("northwatch-watchbreaker", "assassin", 3, 10_000);
    internal.defeatMob("northwatch-watchbreaker", boss, "assassin", 90_000);
    const owners = [...room.state.lootDrops.values()].map(drop => drop.ownerId);
    expect(owners).toContain("tank"); expect(owners).toContain("assassin");
    expect(owners).not.toContain("spectator");
  });
  it("resumes a patrol after loading, then collects its cache and reforges the cloak", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    vi.spyOn(Math, "random").mockReturnValue(.99);
    const { room, internal } = fixture();
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const player = new PlayerState();
    player.huntLoadoutsJson = withNorthwatchProgress(player.huntLoadoutsJson, { clears: 1, marks: 0 });
    room.state.players.set("player", player);
    internal.defeatMob("northwatch-scout", room.state.mobs.get("northwatch-scout")!, "player", 10_000);
    const resumed = new PlayerState();
    applyPlayerSave(resumed, parsePlayerSave(serializePlayerSave(player))!);
    expect(parseNorthwatchProgress(resumed.huntLoadoutsJson)).toEqual({ clears: 1, marks: 1 });
    room.state.players.set("player", resumed);
    internal.defeatMob("northwatch-spitter", room.state.mobs.get("northwatch-spitter")!, "player", 10_000);
    expect(parseNorthwatchProgress(resumed.huntLoadoutsJson).marks).toBe(3);
    const leader = room.state.mobs.get("northwatch-watchbreaker")!;
    leader.leaderRematchTier = 1;
    internal.defeatMob("northwatch-watchbreaker", leader, "player", 10_000);
    const [dropId, bag] = [...room.state.lootDrops].find(([, drop]) => drop.ownerId === "player"
      && decodeLootBagItems(drop.contentsJson).some(item => item.itemId === "northwatch_cloak"))!;
    const contents = decodeLootBagItems(bag.contentsJson);
    expect(contents).toContainEqual({ itemId: "ridge_hide", quantity: 3 });
    Object.assign(resumed, { x: bag.x, y: bag.y, z: bag.z });
    const client = { sessionId: "player", send: vi.fn() };
    internal.handleLootCollect(client, { dropId, action: "keep" });
    expect(client.send).toHaveBeenCalledWith("loot:result", expect.objectContaining({ ok: true }));
    expect(room.state.lootDrops.has(dropId)).toBe(false);
    expect(resumed.inventory.get("northwatch_cloak")?.quantity).toBe(1);
    expect(resumed.inventory.get("ridge_hide")?.quantity).toBe(3);
    Object.assign(resumed, TOWN_BLACKSMITH_STALL_POSITION);
    internal.handleBlacksmithReforge(client, { itemId: "northwatch_cloak" });
    expect(equipmentReforgeRank(resumed.reforgeRanksJson, "northwatch_cloak")).toBe(1);
    expect(resumed.inventory.get("ridge_hide")?.quantity).toBe(1);
    expect(parseNorthwatchProgress(resumed.huntLoadoutsJson)).toEqual({ clears: 2, marks: 0 });
    const afterReforge = new PlayerState();
    applyPlayerSave(afterReforge, parsePlayerSave(serializePlayerSave(resumed))!);
    expect(afterReforge.inventory.get("northwatch_cloak")?.quantity).toBe(1);
    expect(afterReforge.inventory.get("ridge_hide")?.quantity).toBe(1);
    expect(equipmentReforgeRank(afterReforge.reforgeRanksJson, "northwatch_cloak")).toBe(1);
    expect(parseNorthwatchProgress(afterReforge.huntLoadoutsJson)).toEqual({ clears: 2, marks: 0 });
  });
  it("patrols generated terrain smoothly without placing mobs in solid blocks or inside town", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const { room, internal } = fixture();
    for (let tick = 0; tick < 150; tick++) {
      vi.setSystemTime(10000 + tick * 100);
      const before = new Map([...room.state.mobs].map(([id, mob]) => [id, { x: mob.x, z: mob.z }]));
      internal.simulatePlayers(.1);
      for (const [id, mob] of room.state.mobs) {
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
        expect(radiusFromSafeCenter(mob)).toBeGreaterThanOrEqual(MOB_TOWN_MINIMUM_RADIUS - .01);
        expect(Math.hypot(mob.x - before.get(id)!.x, mob.z - before.get(id)!.z)).toBeLessThanOrEqual(.091);
      }
    }
  });
});
