import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, TOWN_BLACKSMITH_STALL_POSITION } from "@blockcraft/voxel-world";
import { FAST_WORLD_BLACKSMITH_POSITION, TOWER_FLOOR_ONE_BOSS_ID, decodeLootBagItems, parseTowerProgress } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { crownkeeperFragments, withCrownkeeperFragments } from "./crownkeeper-progress.js";
import { basicStaggerDuration } from "./combat-impact.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(Math, "random").mockReturnValue(.99);
  const hero = new PlayerState(), ally = new PlayerState(), idle = new PlayerState();
  for (const [id, player] of [["hero", hero], ["ally", ally], ["idle", idle]] as const) {
    Object.assign(player, { x: 331, y: 8, z: 105, health: 20, maxHealth: 20, level: 5, coins: 30 });
    room.state.players.set(id, player);
  }
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  const mob = new MobState();
  Object.assign(mob, { x: 330, y: 8, z: 105, health: 20, maxHealth: 20, alive: true,
    level: 4, archetype: "stone_brute", isMiniBoss: true });
  room.state.mobs.set(TOWER_FLOOR_ONE_BOSS_ID, mob);
  const clear = () => {
    mob.alive = true; mob.health = 20;
    internal.combatContributions.record(TOWER_FLOOR_ONE_BOSS_ID, "hero", 10, 10000);
    internal.combatContributions.record(TOWER_FLOOR_ONE_BOSS_ID, "ally", 10, 10000);
    internal.defeatMob(TOWER_FLOOR_ONE_BOSS_ID, mob, "hero", 10000);
  };
  const give = (id: string) => { const item = new InventoryItemState(); item.quantity = 1; hero.inventory.set(id, item); };
  const forge = () => internal.handleFieldForge(client, { region: "crownkeeper" });
  const swordBags = () => [...room.state.lootDrops.values()].filter(bag =>
    decodeLootBagItems(bag.contentsJson, bag.itemId, bag.quantity).some(item => item.itemId === "crownkeeper_blade"));
  return { room, internal, hero, ally, idle, client, mob, clear, give, forge, swordBags };
}

describe("Crownkeeper signature reward", () => {
  it("banks a personal fragment for each contributor, without awarding spectators or duplicate defeats", () => {
    const f = fixture(); f.clear();
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(1);
    expect(crownkeeperFragments(f.ally.huntLoadoutsJson)).toBe(1);
    expect(crownkeeperFragments(f.idle.huntLoadoutsJson)).toBe(0);
    f.internal.defeatMob(TOWER_FLOOR_ONE_BOSS_ID, f.mob, "hero", 10000);
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(1);
  });
  it("records the first floor clear once and announces only the new victory", () => {
    const f = fixture(); f.clear();
    expect(parseTowerProgress(f.hero.huntLoadoutsJson)).toEqual({ highestFloorCleared: 1, clearedFloors: [1] });
    expect(f.client.send).toHaveBeenCalledWith("tower:floor-cleared",
      { floor: 1, firstClear: true, highestFloorCleared: 1, bossName: "The Crownkeeper" });
    f.clear();
    expect(f.client.send).toHaveBeenCalledWith("tower:floor-cleared",
      { floor: 1, firstClear: false, highestFloorCleared: 1, bossName: "The Crownkeeper" });
  });
  it.each(["dead", "far", "other-floor"])("excludes a %s contributor", reason => {
    const f = fixture();
    if (reason === "dead") f.ally.health = 0;
    if (reason === "far") f.ally.x += 40;
    if (reason === "other-floor") f.ally.y -= 8;
    f.clear(); expect(crownkeeperFragments(f.ally.huntLoadoutsJson)).toBe(0);
  });
  it("guarantees a forge after five unlucky clears even with a full pack and uncollected bags", () => {
    const f = fixture();
    for (const id of ["iron_ore", "silver_ore", "moonstone", "ember_core", "stone_core", "acid_gland",
      "crawler_fang", "ridge_hide", "rootguard_armour", "fang_dagger", "moss_fibre", "timber"]) f.give(id);
    for (let i = 0; i < 5; i++) f.clear();
    expect(f.swordBags()).toHaveLength(0);
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(5);
    expect(f.room.state.lootDrops.size).toBeGreaterThan(0);
    Object.assign(f.hero, FAST_WORLD_BLACKSMITH_POSITION); const gold = f.hero.coins;
    f.forge(); expect(f.hero.coins).toBe(gold); expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(5);
    f.hero.inventory.get("timber")!.quantity = 0;
    f.forge();
    expect(f.hero.inventory.get("crownkeeper_blade")?.quantity).toBe(1);
    expect(f.hero.coins).toBe(gold - 30); expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(0);
    f.forge(); expect(f.hero.inventory.get("crownkeeper_blade")?.quantity).toBe(1);
  });
  it("drops private signature swords on lucky rolls and suppresses owned or pending duplicates", () => {
    const f = fixture(); vi.mocked(Math.random).mockReturnValue(0);
    f.clear(); expect(f.swordBags().map(bag => bag.ownerId).sort()).toEqual(["ally", "hero"]);
    f.clear(); expect(f.swordBags()).toHaveLength(2);
    f.room.state.lootDrops.clear(); f.give("crownkeeper_blade");
    f.clear(); expect(f.swordBags().map(bag => bag.ownerId)).toEqual(["ally"]);
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(3);
  });
  it.each(["marks", "gold", "distance", "dead", "archive"])("does not consume rewards when blocked by %s", reason => {
    const f = fixture(); Object.assign(f.hero, FAST_WORLD_BLACKSMITH_POSITION);
    f.hero.huntLoadoutsJson = withCrownkeeperFragments("{}", reason === "marks" ? 4 : 5);
    if (reason === "gold") f.hero.coins = 29;
    if (reason === "distance") f.hero.x += 10;
    if (reason === "dead") f.hero.health = 0;
    if (reason === "archive") { f.internal.rapidPractice = false; Object.assign(f.hero, TOWN_BLACKSMITH_STALL_POSITION); }
    const before = [f.hero.coins, f.hero.huntLoadoutsJson]; f.forge();
    expect([f.hero.coins, f.hero.huntLoadoutsJson]).toEqual(before);
    expect(f.hero.inventory.get("crownkeeper_blade")).toBeUndefined();
  });
  it("retains banked fragments through Calling and equipment save rewrites", () => {
    const f = fixture(); f.hero.huntLoadoutsJson = withCrownkeeperFragments("{\"towerProgress\":{\"highestFloorCleared\":1,\"clearedFloors\":[1]}}", 4);
    f.internal.setPlayerBuildData(f.hero, []);
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(4);
    expect(parseTowerProgress(f.hero.huntLoadoutsJson).highestFloorCleared).toBe(1);
    f.internal.setEquipmentAttunements(f.hero, {}, 7, {});
    expect(crownkeeperFragments(f.hero.huntLoadoutsJson)).toBe(4);
    expect(parseTowerProgress(f.hero.huntLoadoutsJson).highestFloorCleared).toBe(1);
  });
  it("equips a forged sword through the real request handler and refuses unowned copies", () => {
    const f = fixture();
    f.internal.handleMainHandEquip(f.client, { requestId: "before-forge", mainHandId: "crownkeeper_blade" });
    expect(f.hero.mainHandId).not.toBe("crownkeeper_blade");
    Object.assign(f.hero, FAST_WORLD_BLACKSMITH_POSITION);
    f.hero.huntLoadoutsJson = withCrownkeeperFragments("{}", 5); f.forge();
    f.internal.handleMainHandEquip(f.client, { requestId: "after-forge", mainHandId: "crownkeeper_blade" });
    expect(f.hero.mainHandId).toBe("crownkeeper_blade");
    expect(f.client.send).toHaveBeenCalledWith("main-hand:equipped",
      { requestId: "after-forge", mainHandId: "crownkeeper_blade" });
  });
  it("preserves loadouts and rejects malformed or unbounded balances", () => {
    expect(JSON.parse(withCrownkeeperFragments('[{"slot":1}]', 5))).toEqual({ loadouts: [{ slot: 1 }], crownkeeperFragments: 5 });
    expect(JSON.parse(withCrownkeeperFragments('{"starterKitClaimed":true}', 5)).starterKitClaimed).toBe(true);
    expect(crownkeeperFragments("bad")).toBe(0);
    expect(crownkeeperFragments('{"crownkeeperFragments":"5"}')).toBe(0);
    expect(crownkeeperFragments(withCrownkeeperFragments("bad", 999999))).toBe(65535);
    expect(crownkeeperFragments(withCrownkeeperFragments("{}", NaN))).toBe(0);
  });
  it("gives the third cut its interrupt without turning ordinary cuts or active strikes into stuns", () => {
    expect(basicStaggerDuration("crownkeeper_blade", 3, "stone_brute", "windup")).toBe(350);
    expect(basicStaggerDuration("forged_sword", 3, "stone_brute", "windup")).toBe(0);
    expect(basicStaggerDuration("crownkeeper_blade", 3, "moss_crawler", "windup")).toBe(650);
    expect(basicStaggerDuration("crownkeeper_blade", 1, "stone_brute", "windup")).toBe(0);
    expect(basicStaggerDuration("crownkeeper_blade", 3, "stone_brute", "strike")).toBe(0);
  });
  it.each([1, 2, 3])("resolves real crescent hit %s and only interrupts on the third", step => {
    const f = fixture(); f.hero.mainHandId = "crownkeeper_blade"; f.mob.x = 334;
    f.mob.combatState = "windup"; f.mob.attackPattern = "smash"; f.mob.armor = 0;
    f.internal.pendingAttacks.set("hero", { requestId: "royal-break", mainHandId: "crownkeeper_blade",
      step, yaw: 90, impactAt: 10000 });
    f.internal.resolvePendingAttacks(10000);
    for (let now = 10020; now <= 10400; now += 20) f.internal.resolveWeaponProjectiles(now);
    expect(f.mob.health).toBeLessThan(20);
    expect(f.mob.combatState).toBe(step === 3 ? "stagger" : "windup");
  });
});
