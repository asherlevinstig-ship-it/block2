import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { TOWER_FLOOR_ONE_BOSS_ID, TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_SOUTH_WARDEN_ID,
  TOWER_FLOOR_ONE, TOWER_FLOOR_ONE_SPAWNS, RAPID_PRACTICE_ARENA } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { ForestPortalState, InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";
import { crownkeeperFragments } from "./crownkeeper-progress.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(pattern = "smash", state = "strike") {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(Math, "random").mockReturnValue(.99);
  const boss = new MobState(); Object.assign(boss, { x: 375, y: 8, z: 106, health: 52, maxHealth: 52,
    armor: 1, archetype: "stone_brute", isMiniBoss: true, level: 4, attackDamage: 2, attackPattern: pattern,
    combatState: state, targetId: "hero", actionSequence: 1, yaw: -90, stateUntil: 12000 });
  room.state.mobs.set(TOWER_FLOOR_ONE_BOSS_ID, boss);
  internal.mobHomes.set(TOWER_FLOOR_ONE_BOSS_ID, { x: 375, y: 8, z: 106 });
  const player = new PlayerState();
  Object.assign(player, { x: 372, y: 8, z: 106, health: 30, maxHealth: 30, level: 5, mainHandId: "forged_sword", yaw: 90 });
  player.huntLoadoutsJson = serializeBuildPathState(grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "tank"), 140).state);
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  const ally = new PlayerState(); Object.assign(ally, { x: 373, y: 8, z: 106, health: 20, maxHealth: 20, level: 5, mainHandId: "forged_sword" });
  room.state.players.set("ally", ally);
  const allyClient = { sessionId: "ally", send: vi.fn() }; internal.clients.push(allyClient);
  const attack = (id = "hero", hand = "forged_sword", step = 1, now = 10000) => {
    internal.pendingAttacks.set(id, { requestId: "attack-counter", mainHandId: hand, step, yaw: 90, impactAt: now });
    internal.resolvePendingAttacks(now);
    for (let at = now + 20; at <= now + 300; at += 20) internal.resolveWeaponProjectiles(at);
  };
  return { room, internal, boss, player, client, ally, allyClient, broadcast, attack };
}

describe("Crownkeeper earned counter openings", () => {
  it("parrying the cleave opens a shared window and consumes its queued attack", () => {
    const f = fixture(); f.player.defending = true; f.player.defenseStartedAt = 9950;
    f.internal.pendingMobMelee.set(TOWER_FLOOR_ONE_BOSS_ID, { targetId: "hero", impactAt: 10100, yaw: -90 });
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(f.player.health).toBe(30);
    expect(f.boss).toMatchObject({ combatState: "recover", stateUntil: 12000, actionSequence: 1, targetId: "" });
    expect(f.internal.pendingMobMelee.has(TOWER_FLOOR_ONE_BOSS_ID)).toBe(false);
    for (const client of [f.client, f.allyClient]) expect(client.send).toHaveBeenCalledWith("leader:exposed",
      { mobId: TOWER_FLOOR_ONE_BOSS_ID, durationMs: 2000, expiresAt: 12000, reason: "crown-parry" });
  });
  it("holding guard on a cleave reduces damage but does not earn the parry window", () => {
    const f = fixture(); f.player.defending = true; f.player.defenseStartedAt = 9000;
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(f.internal.crownkeeperOpeningUntil).toBe(0);
  });
  it("counts creating a shared opening as meaningful support even without weapon damage", () => {
    const f = fixture(); f.player.defending = true; f.player.defenseStartedAt = 9950;
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    f.internal.combatContributions.record(TOWER_FLOOR_ONE_BOSS_ID, "ally", 40, 10000);
    expect(f.internal.combatContributions.eligiblePersistent(TOWER_FLOOR_ONE_BOSS_ID, f.boss, f.room.state.players)).toContain("hero");
    f.internal.defeatMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, "ally", 10500);
    expect(crownkeeperFragments(f.player.huntLoadoutsJson)).toBe(1);
    expect(crownkeeperFragments(f.ally.huntLoadoutsJson)).toBe(1);
  });
  it("a timed Crowncleaver hit interrupts the slam, advances its rotation and leaves no contact pending", () => {
    const f = fixture("slam", "windup"); f.player.mainHandId = "crownkeeper_blade"; f.attack("hero", "crownkeeper_blade", 3);
    expect(f.boss).toMatchObject({ combatState: "recover", actionSequence: 2 });
    expect(f.internal.crownkeeperOpeningUntil).toBeGreaterThan(12000);
    expect(f.internal.pendingMobMelee.has(TOWER_FLOOR_ONE_BOSS_ID)).toBe(false);
    expect(f.client.send).toHaveBeenCalledWith("leader:exposed", expect.objectContaining({ reason: "crown-interrupt", durationMs: 2500 }));
  });
  it("does not turn an interrupt of the active slam into a counter opening", () => {
    const f = fixture("slam", "strike");
    f.internal.staggerMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 10000, 350, true);
    expect(f.internal.crownkeeperOpeningUntil).toBe(0);
  });
  it("a perfect dodge of the charge cancels further charge travel", () => {
    const f = fixture("charge"); f.player.invulnerableUntil = 10300;
    f.internal.activeDodgeWindows.set("hero", { startedAt: 9950, until: 10300 });
    f.internal.championCharges.set(TOWER_FLOOR_ONE_BOSS_ID, { yaw: -90, startedAt: 9900, progress: .2, hit: new Set(["hero"]) });
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(f.player.health).toBe(30); expect(f.internal.championCharges.has(TOWER_FLOOR_ONE_BOSS_ID)).toBe(false);
    expect(f.internal.crownkeeperOpeningUntil).toBe(12500);
  });
  it("portal invulnerability alone does not award a charge dodge", () => {
    const f = fixture("charge"); f.player.invulnerableUntil = 10300;
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(f.internal.crownkeeperOpeningUntil).toBe(0);
  });
  it("confirms a frontal charge guard but rejects a guard facing away", () => {
    const good = fixture("charge"); good.player.defending = true; good.player.defenseStartedAt = 9000;
    good.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(good.internal.crownkeeperOpeningUntil).toBe(13500);
    const wrong = fixture("charge"); wrong.player.defending = true; wrong.player.defenseStartedAt = 9000; wrong.player.yaw = -90;
    wrong.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(wrong.internal.crownkeeperOpeningUntil).toBe(0);
  });
  it("also rewards a perfectly timed charge guard rather than losing it to the generic parry stagger", () => {
    const f = fixture("charge"); f.player.defending = true; f.player.defenseStartedAt = 9950;
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true);
    expect(f.internal.crownkeeperOpeningUntil).toBe(13500); expect(f.boss.combatState).toBe("recover");
  });
  it("gives the whole party +1 weapon damage only inside the earned window", () => {
    const base = fixture("charge"); base.attack("ally"); const normal = 52 - base.boss.health;
    const open = fixture("charge"); open.internal.openCrownkeeperCounter(open.boss, "evade", 10000); open.attack("ally");
    expect(52 - open.boss.health).toBe(normal + 1);
    const expired = fixture("charge"); expired.internal.openCrownkeeperCounter(expired.boss, "evade", 7000); expired.attack("ally");
    expect(52 - expired.boss.health).toBe(normal);
  });
  it("cannot extend or truncate an opening by spamming forced staggers", () => {
    const f = fixture("slam", "windup"); f.internal.staggerMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 10000, 350);
    expect(f.internal.staggerMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 10500, 9000, true)).toBe(false);
    expect(f.boss.stateUntil).toBe(12500); expect(f.internal.crownkeeperOpeningUntil).toBe(12500);
  });
  it("keeps its earned opening through a phase transition and resets it after a wipe", () => {
    const f = fixture("slam", "windup"); f.internal.staggerMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 10000, 350);
    f.internal.enterAreaLeaderPhase(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 1, 2, 10200);
    expect(f.boss.stateUntil).toBeGreaterThanOrEqual(12500);
    f.internal.resetCrownkeeperEncounter(f.boss, 13000);
    expect(f.internal.crownkeeperOpeningUntil).toBe(0); expect(f.boss.health).toBe(52);
  });
  it("does not apply Crownkeeper counter rules to the archived mode", () => {
    const f = fixture("slam", "windup"); f.internal.rapidPractice = false;
    f.internal.staggerMob(TOWER_FLOOR_ONE_BOSS_ID, f.boss, 10000, 350, true);
    expect(f.internal.crownkeeperOpeningUntil).toBe(0); expect(f.boss.combatState).toBe("stagger");
  });
  it("completes the server flow: portal, two Warden choices, boss counter, personal reward, town reset", () => {
    const f = fixture(); f.room.state.mobs.clear();
    vi.spyOn(f.internal, "bootstrapPayload").mockReturnValue({});
    vi.spyOn(f.internal, "refreshNearbyObjectives").mockImplementation(() => {});
    const entry = new ForestPortalState(); Object.assign(entry, TOWER_FLOOR_ONE.townPortal, { kind: "tower-entry" });
    const exit = new ForestPortalState(); Object.assign(exit, TOWER_FLOOR_ONE.returnPortal, { kind: "tower-return" });
    f.room.state.portals.set("tower-floor-1-entry", entry); f.room.state.portals.set("tower-floor-1-return", exit);
    Object.assign(f.player, TOWER_FLOOR_ONE.townPortal);
    f.internal.useTowerPortal(f.client, "tower-floor-1-entry");
    expect(f.player.x).toBe(TOWER_FLOOR_ONE.entry.x); expect(f.internal.floorRunUpgrades.active("hero")).toBe(true);
    const build = parseBuildPathState(f.player.huntLoadoutsJson); build.callingAbilities.tank = "tank_earthbreaker";
    f.player.huntLoadoutsJson = serializeBuildPathState(build);
    const sword = new InventoryItemState(); sword.quantity = 1; f.player.inventory.set("forged_sword", sword);
    for (const id of [TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_SOUTH_WARDEN_ID]) {
      const spawn = TOWER_FLOOR_ONE_SPAWNS.find(entry => entry.id === id)!;
      const warden = new MobState(); Object.assign(warden, spawn, { health: 30, maxHealth: 30, alive: true, isMiniBoss: true });
      f.room.state.mobs.set(id, warden);
    }
    for (const id of [TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_SOUTH_WARDEN_ID]) {
      const warden = f.room.state.mobs.get(id)!;
      Object.assign(f.player, { x: warden.x - 1, y: warden.y, z: warden.z });
      f.internal.combatContributions.record(id, "hero", 30, 10000);
      f.internal.defeatMob(id, warden, "hero", 10000);
      expect(warden.respawnAt).toBe(Number.MAX_SAFE_INTEGER);
      const offer = f.internal.floorRunUpgrades.state("hero", "tank", f.internal.floorUpgradeAbilities(f.player));
      expect(offer.choices.length).toBeGreaterThan(0);
      f.internal.chooseFloorRunUpgrade(f.client, { offerId: offer.offerId, upgradeId: offer.choices[0] });
    }
    expect(f.internal.floorRunUpgrades.state("hero", "tank", f.internal.floorUpgradeAbilities(f.player)).picked).toHaveLength(2);
    const boss = f.room.state.mobs.get(TOWER_FLOOR_ONE_BOSS_ID)!; expect(boss.maxHealth).toBe(52);
    Object.assign(f.player, { x: boss.x - 3, y: boss.y, z: boss.z });
    boss.attackPattern = "slam"; boss.combatState = "windup";
    f.internal.handleCallingAbility(f.client, { requestId: "floor-finale", yaw: 90 });
    expect(boss.combatState).toBe("recover"); expect(f.internal.crownkeeperOpeningUntil).toBe(12500);
    for (let attempt = 0; boss.alive && attempt < 30; attempt++) f.attack("hero", "forged_sword", 3, 10200 + attempt * 700);
    expect(boss.alive).toBe(false);
    expect(crownkeeperFragments(f.player.huntLoadoutsJson)).toBe(1);
    expect([...f.room.state.lootDrops.values()].some(bag => bag.ownerId === "hero")).toBe(true);
    const xp = f.player.experience, coins = f.player.coins;
    vi.setSystemTime(40000); Object.assign(f.player, TOWER_FLOOR_ONE.returnPortal);
    f.internal.useTowerPortal(f.client, "tower-floor-1-return");
    expect(f.player.x).toBe(RAPID_PRACTICE_ARENA.spawn.x); expect(f.internal.floorRunUpgrades.active("hero")).toBe(false);
    expect(crownkeeperFragments(f.player.huntLoadoutsJson)).toBe(1); expect(f.player.experience).toBe(xp); expect(f.player.coins).toBe(coins);
    Object.assign(f.ally, RAPID_PRACTICE_ARENA.spawn);
    f.internal.towerFloorWasOccupied = true;
    f.internal.resetTowerFloorAfterDeparture(40_000);
    f.internal.resetTowerFloorAfterDeparture(44_999);
    expect(f.room.state.mobs.has(TOWER_FLOOR_ONE_BOSS_ID)).toBe(true);
    f.internal.resetTowerFloorAfterDeparture(45_000);
    expect(f.room.state.mobs.has(TOWER_FLOOR_ONE_BOSS_ID)).toBe(false);
    expect(f.room.state.mobs.get(TOWER_FLOOR_ONE_NORTH_WARDEN_ID)?.alive).toBe(true);
    expect(f.room.state.mobs.get(TOWER_FLOOR_ONE_SOUTH_WARDEN_ID)?.alive).toBe(true);
    expect([...f.room.state.lootDrops.values()].some(drop =>
      drop.x >= TOWER_FLOOR_ONE.bounds.minX && drop.x <= TOWER_FLOOR_ONE.bounds.maxX
      && drop.z >= TOWER_FLOOR_ONE.bounds.minZ && drop.z <= TOWER_FLOOR_ONE.bounds.maxZ)).toBe(false);
  });
});
