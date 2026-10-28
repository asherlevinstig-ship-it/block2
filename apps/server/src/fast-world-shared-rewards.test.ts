import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { TOWER_FLOOR_ONE_NORTH_WARDEN_ID, type BuildPathId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(leader = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(room, "broadcast").mockImplementation(() => {}); vi.spyOn(Math, "random").mockReturnValue(.99);
  const id = leader ? TOWER_FLOOR_ONE_NORTH_WARDEN_ID : "floor1-mossling-a";
  const mob = new MobState(); Object.assign(mob, { x: 330, y: 8, z: 105, health: 20, maxHealth: 20,
    level: 4, archetype: leader ? "stone_brute" : "moss_crawler", isMiniBoss: leader, combatState: "windup", targetId: "damage" });
  room.state.mobs.set(id, mob);
  function add(playerId: string, path: BuildPathId = "assassin") {
    const player = new PlayerState(); Object.assign(player, { x: 331, y: 8, z: 105, health: 20, maxHealth: 20, level: 5, coins: 0 });
    player.huntLoadoutsJson = serializeBuildPathState(grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), path), 70).state);
    room.state.players.set(playerId, player);
    const client = { sessionId: playerId, send: vi.fn() }; internal.clients.push(client);
    return { player, client };
  }
  const damage = add("damage"), helper = add("helper", "healer"), tank = add("tank", "tank"), watcher = add("watcher");
  const contribute = (playerId: string, value = 4, now = 10000) => internal.combatContributions.record(id, playerId, value, now);
  const defeat = (killer = "damage", now = 10000) => internal.defeatMob(id, mob, killer, now);
  const owners = () => [...room.state.lootDrops.values()].map(bag => bag.ownerId).sort();
  return { room, internal, mob, id, damage, helper, tank, watcher, add, contribute, defeat, owners };
}

describe("Fast World personal contribution rewards", () => {
  it("grants independent loot, full XP, gold and Calling progress to contributors", () => {
    const { damage, helper, watcher, contribute, defeat, owners } = fixture();
    const beforeDamage = parseBuildPathState(damage.player.huntLoadoutsJson).xp.assassin!;
    const beforeHealer = parseBuildPathState(helper.player.huntLoadoutsJson).xp.healer!;
    contribute("damage", 10); contribute("helper", 4); defeat();
    expect(owners()).toEqual(["damage", "helper"]);
    expect(damage.player.coins).toBeGreaterThan(0); expect(helper.player.coins).toBe(damage.player.coins);
    expect(damage.player.experience).toBeGreaterThan(0); expect(helper.player.experience).toBe(damage.player.experience);
    expect(parseBuildPathState(damage.player.huntLoadoutsJson).xp.assassin).toBe(beforeDamage + 1);
    expect(parseBuildPathState(helper.player.huntLoadoutsJson).xp.healer).toBe(beforeHealer + 1);
    expect(watcher.player.experience).toBe(0); expect(watcher.player.coins).toBe(0);
    const coins = helper.player.coins; defeat(); expect(helper.player.coins).toBe(coins); expect(owners()).toHaveLength(2);
  });
  it("does not let a tiny finishing hit take credit from meaningful participants", () => {
    const { contribute, defeat, owners, watcher } = fixture();
    contribute("damage", 19); contribute("watcher", 1); defeat("watcher");
    expect(owners()).toEqual(["damage"]); expect(watcher.player.coins).toBe(0);
  });
  it("keeps a solo finishing blow reward when no one reaches the threshold", () => {
    const { defeat, owners, damage } = fixture(); defeat();
    expect(owners()).toEqual(["damage"]); expect(damage.player.experience).toBeGreaterThan(0);
  });
  it.each(["dead", "far"])("does not bypass participation rules for a %s fallback killer", condition => {
    const f = fixture();
    if (condition === "dead") f.damage.player.health = 0; else f.damage.player.x += 40;
    f.defeat(); expect(f.owners()).toEqual([]); expect(f.damage.player.coins).toBe(0);
  });
  it("keeps meaningful early boss credit but expires ordinary mob participation", () => {
    const boss = fixture(true); boss.contribute("helper", 1); boss.contribute("damage", 19, 80000); boss.defeat("damage", 80000);
    expect(boss.owners()).toEqual(["damage", "helper"]);
    const normal = fixture(); normal.contribute("helper", 4); normal.contribute("damage", 16, 80000); normal.defeat("damage", 80000);
    expect(normal.owners()).toEqual(["damage"]);
  });
  it("does not carry participation into the next boss life", () => {
    const f = fixture(true); f.contribute("damage", 10); f.contribute("helper", 10); f.defeat();
    f.mob.alive = true; f.mob.health = 20; f.defeat("damage", 20000);
    expect(f.owners()).toEqual(["damage", "damage", "helper"]);
  });
  it("keeps each participant's loot private and collectible only once", () => {
    const f = fixture(); f.contribute("damage", 10); f.contribute("helper", 10); f.defeat();
    const [bagId, bag] = [...f.room.state.lootDrops].find(([, drop]) => drop.ownerId === "damage")!;
    Object.assign(f.helper.player, { x: bag.x, y: bag.y, z: bag.z });
    f.internal.handleLootCollect(f.helper.client, { dropId: bagId, equip: false });
    expect(f.room.state.lootDrops.has(bagId)).toBe(true); expect(f.helper.player.inventory.size).toBe(0);
    Object.assign(f.damage.player, { x: bag.x, y: bag.y, z: bag.z });
    f.internal.handleLootCollect(f.damage.client, { dropId: bagId, equip: false });
    expect(f.room.state.lootDrops.has(bagId)).toBe(false);
    const inventory = [...f.damage.player.inventory].map(([id, item]) => [id, item.quantity]);
    f.internal.handleLootCollect(f.damage.client, { dropId: bagId, equip: false });
    expect([...f.damage.player.inventory].map(([id, item]) => [id, item.quantity])).toEqual(inventory);
  });
  it.each(["dead", "far", "other-floor", "disconnected"])("excludes %s contributors", condition => {
    const f = fixture(true); f.contribute("helper", 4); f.contribute("damage", 16);
    if (condition === "dead") f.helper.player.health = 0;
    if (condition === "far") f.helper.player.x += 40;
    if (condition === "other-floor") f.helper.player.y -= 8;
    if (condition === "disconnected") { f.internal.combatContributions.disconnect("helper"); f.room.state.players.delete("helper"); }
    f.defeat(); expect(f.owners()).toEqual(["damage"]);
  });
  it("counts actual Field Mend healing for an ally involved in the fight", () => {
    const f = fixture(true); f.contribute("damage", 10); f.damage.player.health = 10;
    f.internal.handleCallingAbility(f.helper.client, { requestId: "mend" });
    expect(f.damage.player.health).toBeGreaterThan(10);
    f.defeat(); expect(f.owners()).toEqual(["damage", "helper"]);
  });
  it("counts Renewal's real ally healing rather than just placing its field", () => {
    const f = fixture(); f.contribute("damage", 10); f.damage.player.health = 10;
    f.internal.handleCallingAbilityEquip(f.helper.client, { abilityId: "healer_renewal" });
    f.internal.handleCallingAbility(f.helper.client, { requestId: "renewal" });
    expect(f.internal.combatContributions.eligible(f.id, f.mob, f.room.state.players, 10000)).not.toContain("helper");
    f.internal.resolveRenewalFields(10500); f.internal.resolveRenewalFields(11500);
    f.defeat("damage", 11500); expect(f.owners()).toEqual(["damage", "helper"]);
  });
  it("counts a completed resurrection of a contributor", () => {
    const f = fixture(true); f.contribute("damage", 10); f.damage.player.health = 0;
    const build = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "healer"), 140).state;
    build.specializations.healer = "lifebinder"; build.mastered.push("lifebinder");
    f.helper.player.huntLoadoutsJson = serializeBuildPathState(build);
    f.internal.parties.restore(["helper", "damage"]); f.internal.resurrectionWindows.set("damage", 22000);
    f.internal.handleCallingAbilityEquip(f.helper.client, { abilityId: "healer_resurrection" });
    f.internal.handleCallingAbility(f.helper.client, { requestId: "rescue" });
    expect(f.damage.player.health).toBe(0);
    f.internal.resolvePendingResurrections(12500); expect(f.damage.player.health).toBeGreaterThan(0);
    f.defeat("damage", 12500); expect(f.owners()).toEqual(["damage", "helper"]);
  });
  it("rejects self-healing, overhealing, unrelated healing and expired participation", () => {
    const f = fixture(); f.mob.targetId = "damage";
    f.internal.recordFastWorldHealingSupport("helper", "helper", 10, 10000);
    f.internal.recordFastWorldHealingSupport("helper", "damage", 0, 10000);
    f.internal.recordFastWorldHealingSupport("helper", "watcher", 10, 10000);
    f.contribute("watcher", 4, 1000);
    f.internal.recordFastWorldHealingSupport("helper", "watcher", 10, 22000);
    f.contribute("damage", 16, 22000); f.defeat("damage", 22000);
    expect(f.owners()).toEqual(["damage"]);
  });
  it("counts a real parry without requiring the Tank to deal damage", () => {
    const f = fixture(true); f.contribute("damage", 15);
    Object.assign(f.tank.player, { x: 332, yaw: -90, defending: true, defenseStartedAt: 10000 });
    f.internal.damagePlayer(f.id, "tank", 4, 10000, true);
    f.defeat(); expect(f.owners()).toEqual(["damage", "tank"]);
  });
  it("credits Challenge when it actually redirects an enemy off an ally", () => {
    const f = fixture(true); f.contribute("damage", 15);
    f.internal.mobAwareness.set(f.id, { targetId: "damage", lastSeen: { x: 331, y: 8, z: 105 }, seenAt: 10000 });
    f.internal.handleCallingAbilityEquip(f.tank.client, { abilityId: "tank_challenge" });
    f.internal.handleCallingAbility(f.tank.client, { requestId: "challenge" });
    expect(f.internal.mobAwareness.get(f.id).targetId).toBe("tank");
    f.defeat(); expect(f.owners()).toEqual(["damage", "tank"]);
  });
  it("credits Bulwark damage prevented for an ally", () => {
    const f = fixture(true); f.contribute("damage", 15);
    Object.assign(f.tank.player, { x: 332, z: 105, yaw: -90 });
    Object.assign(f.damage.player, { x: 334, z: 105 });
    f.internal.handleCallingAbility(f.tank.client, { requestId: "bulwark" });
    f.internal.damagePlayer(f.id, "damage", 3, 10001, false);
    f.defeat("damage", 10002); expect(f.owners()).toEqual(["damage", "tank"]);
  });
  it("does not count challenging an enemy targeting a fallen player", () => {
    const f = fixture(true); f.contribute("damage", 15); f.watcher.player.health = 0;
    f.internal.mobAwareness.set(f.id, { targetId: "watcher", lastSeen: { x: 331, y: 8, z: 105 }, seenAt: 10000 });
    f.internal.handleCallingAbilityEquip(f.tank.client, { abilityId: "tank_challenge" });
    f.internal.handleCallingAbility(f.tank.client, { requestId: "challenge-dead" });
    f.defeat(); expect(f.owners()).toEqual(["damage"]);
  });
});
