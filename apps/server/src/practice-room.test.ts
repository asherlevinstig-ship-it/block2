import { describe, expect, it, vi } from "vitest";
import { CALLING_ABILITY_OPTIONS } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { effectiveBuildPathRank, parseBuildPathState } from "./build-paths.js";

describe("private Calling practice", () => {
  function fixture() {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "practice";
    const player = new PlayerState();
    Object.assign(player, { x: 99.5, y: 8, z: 106.5, level: 10 });
    room.state.players.set("trainee", player);
    const client = { sessionId: "trainee", send: vi.fn() };
    return { room, internal, player, client };
  }

  it.each(CALLING_ABILITY_OPTIONS)("temporarily equips $id at Master rank", option => {
    const { internal, player, client } = fixture();
    internal.selectPracticeAbility(client, { abilityId: option.id });
    const state = parseBuildPathState(player.huntLoadoutsJson);
    expect(state.selectedPathId).toBe(option.pathId);
    expect(state.callingAbilities[option.pathId]).toBe(option.id);
    expect(effectiveBuildPathRank(state, option.pathId)).toBe(4);
    expect(player.mainHandTag).toBe(option.pathId === "ranger" ? "ranged"
      : option.pathId === "mage" || option.pathId === "healer" ? "focus" : "melee");
    expect(client.send).toHaveBeenCalledWith("practice:state", expect.objectContaining({ active: true, abilityId: option.id }));
  });

  it("never saves practice changes or produces loot from a training kill", async () => {
    const { room, internal, player } = fixture();
    internal.profileTokens.set("trainee", "test-profile");
    await expect(internal.persistPlayer("trainee", player, true)).resolves.toBeUndefined();
    const mob = new MobState(); Object.assign(mob, { alive: true, health: 1, maxHealth: 10 });
    room.state.mobs.set("practice-crawler", mob);
    internal.defeatMob("practice-crawler", mob, "trainee", 10_000);
    expect(mob.alive).toBe(false);
    expect(mob.respawnAt).toBe(13_000);
    expect(room.state.lootDrops.size).toBe(0);
  });

  it("uses the authored static respawn rhythm for Fast World defeats", () => {
    const { room, internal } = fixture();
    internal.rapidPractice = true;
    const mob = new MobState(); Object.assign(mob, { alive: true, health: 1, maxHealth: 6 });
    room.state.mobs.set("greenwood-mosswatch-crawler", mob);
    internal.defeatMob("greenwood-mosswatch-crawler", mob, "trainee", 10_000);
    expect(mob.alive).toBe(false);
    expect(mob.respawnAt).toBe(50_000);
  });

  it("always pays out the guarded Fenward cache discovery", () => {
    const { room, internal, player } = fixture();
    internal.rapidPractice = true;
    internal.spawnLootDrops = vi.fn();
    internal.persistPlayer = vi.fn().mockResolvedValue(undefined);
    const mob = new MobState(); Object.assign(mob, { alive: true, health: 1, maxHealth: 12,
      archetype: "thornbinder", level: 4, rewardMultiplier: 1 });
    room.state.mobs.set("greenwood-fenward-guard-b", mob);
    const coinsBefore = player.coins;
    internal.defeatMob("greenwood-fenward-guard-b", mob, "trainee", 10_000);
    expect(internal.spawnLootDrops).toHaveBeenCalledWith("greenwood-fenward-guard-b", mob, 10_000, "trainee");
    expect(player.coins).toBe(coinsBefore + 4);
    expect(mob.respawnAt).toBe(76_000);
  });

  it("reuses the archived Greenwood leader phases and follower opening in Fast World", () => {
    const { room, internal } = fixture();
    internal.rapidPractice = true;
    internal.spawnLootDrops = vi.fn();
    internal.persistPlayer = vi.fn().mockResolvedValue(undefined);
    const leader = new MobState(); Object.assign(leader, { alive: true, health: 34, maxHealth: 34,
      archetype: "thornbinder", combatState: "windup", targetId: "trainee" });
    internal.configureRapidWorldMob("greenwood-elderthorn", leader);
    expect(leader).toMatchObject({ name: "Elderthorn Keeper", isMiniBoss: true, isChampion: false, attackPattern: "rush" });
    const follower = new MobState(); Object.assign(follower, { alive: true, health: 1, maxHealth: 10,
      archetype: "briar_crawler", level: 3, rewardMultiplier: 1 });
    room.state.mobs.set("greenwood-elderthorn", leader);
    room.state.mobs.set("greenwood-elderthorn-rootguard", follower);
    internal.defeatMob("greenwood-elderthorn-rootguard", follower, "trainee", 10_000);
    expect(leader.combatState).toBe("recover");
    expect(leader.stateUntil).toBe(12_500);
    expect(leader.targetId).toBe("");
  });

  it("adapts Miremother to toxic phases and the shared follower opening", () => {
    const { room, internal } = fixture();
    internal.rapidPractice = true;
    internal.spawnLootDrops = vi.fn();
    internal.persistPlayer = vi.fn().mockResolvedValue(undefined);
    const leader = new MobState(); Object.assign(leader, { alive: true, health: 46, maxHealth: 46,
      archetype: "fen_bloater", combatState: "windup", targetId: "trainee" });
    internal.configureRapidWorldMob("mistfen-miremother", leader);
    expect(leader).toMatchObject({ name: "Miremother", level: 7, isMiniBoss: true,
      isChampion: false, attackPattern: "toxic-bloom" });
    const follower = new MobState(); Object.assign(follower, { alive: true, health: 1, maxHealth: 16,
      archetype: "cave_spitter", level: 6, rewardMultiplier: 1 });
    room.state.mobs.set("mistfen-miremother", leader);
    room.state.mobs.set("mistfen-miremother-spitter", follower);
    internal.defeatMob("mistfen-miremother-spitter", follower, "trainee", 20_000);
    expect(leader.combatState).toBe("recover");
    expect(leader.stateUntil).toBe(22_500);
    expect(leader.targetId).toBe("");
  });

  it("adapts Tidecaller to the shared coastal leader encounter", () => {
    const { room, internal } = fixture();
    internal.rapidPractice = true;
    internal.spawnLootDrops = vi.fn();
    internal.persistPlayer = vi.fn().mockResolvedValue(undefined);
    const leader = new MobState(); Object.assign(leader, { alive: true, health: 50, maxHealth: 50,
      archetype: "fen_bloater", combatState: "windup", targetId: "trainee" });
    internal.configureRapidWorldMob("sunken-coast-tidecaller", leader);
    expect(leader).toMatchObject({ name: "Tidecaller Behemoth", level: 8, isMiniBoss: true,
      isChampion: false, attackPattern: "toxic-bloom" });
    const follower = new MobState(); Object.assign(follower, { alive: true, health: 1, maxHealth: 18,
      archetype: "cave_spitter", level: 7, rewardMultiplier: 1 });
    room.state.mobs.set("sunken-coast-tidecaller", leader);
    room.state.mobs.set("coast-tidecaller-shoalguard", follower);
    internal.defeatMob("coast-tidecaller-shoalguard", follower, "trainee", 30_000);
    expect(leader.combatState).toBe("recover");
    expect(leader.stateUntil).toBe(32_500);
    expect(leader.targetId).toBe("");
  });

  it("configures the Crownkeeper as a true floor boss above the Root Wardens", () => {
    const { internal } = fixture();
    internal.rapidPractice = true;
    const boss = new MobState();
    Object.assign(boss, { alive: true, archetype: "stone_brute", combatState: "idle" });
    internal.configureRapidWorldMob("floor1-crownkeeper", boss);
    expect(boss).toMatchObject({
      name: "The Crownkeeper", level: 4, isMiniBoss: true, isChampion: true,
      maxHealth: 52, health: 52, attackDamage: 2, attackPattern: "smash",
    });
    expect(boss.rewardMultiplier).toBe(3);
  });

  it("fully reforms the Crownkeeper court after a withdrawn encounter", () => {
    const { room, internal } = fixture();
    internal.rapidPractice = true;
    const boss = new MobState();
    Object.assign(boss, { alive: true, archetype: "stone_brute" });
    internal.configureRapidWorldMob("floor1-crownkeeper", boss);
    Object.assign(boss, { health: 7, armor: 3, combatState: "windup", targetId: "trainee", enraged: true });
    room.state.mobs.set("floor1-crownkeeper", boss);
    internal.mobHomes.set("floor1-crownkeeper", { x: 375, y: 9.55, z: 106 });
    internal.bruteLeaderArmourBonus.set("floor1-crownkeeper", 2);
    internal.areaLeaderPhases.set("floor1-crownkeeper", 3);
    internal.miniBossEngagedAt.set("floor1-crownkeeper", 1_000);
    for (const [id, z] of [["floor1-court-briar-a", 98], ["floor1-court-briar-b", 114]] as const) {
      const follower = new MobState();
      Object.assign(follower, { alive: false, health: 0, maxHealth: 10, archetype: "briar_crawler", combatState: "idle" });
      room.state.mobs.set(id, follower);
      internal.mobHomes.set(id, { x: 361, y: 9, z });
    }
    internal.resetCrownkeeperEncounter(boss, 20_000);
    expect(boss).toMatchObject({ health: 52, maxHealth: 52, armor: 3, combatState: "idle",
      targetId: "", enraged: false, attackPattern: "smash", x: 375, z: 106 });
    expect(internal.areaLeaderPhases.get("floor1-crownkeeper")).toBe(1);
    for (const id of ["floor1-court-briar-a", "floor1-court-briar-b"])
      expect(room.state.mobs.get(id)).toMatchObject({ alive: true, health: 10, combatState: "recover", materializeUntil: 20_900 });
  });

  it("applies quick upgrades without saving or opening inventory", () => {
    const { internal, player, client } = fixture();
    internal.rapidPractice = true;
    player.maxHealth = 30; player.health = 20;
    internal.rapidPracticePendingRewards.set("trainee", { wave: 2, rare: false, weapon: false });
    internal.chooseRapidPracticeUpgrade(client, { upgradeId: "bloodstone" });
    expect(player.maxHealth).toBe(35);
    expect(player.health).toBe(25);
    expect(internal.rapidPracticeUpgrades.get("trainee")).toEqual({ damage: 0, haste: 0, vitality: 1, relics: 0 });
    expect(client.send).toHaveBeenCalledWith("practice:reward-applied", expect.objectContaining({ upgradeId: "bloodstone", vitality: 1 }));
  });

  it("makes every Warden choice a doubled rare relic", () => {
    const { internal, client } = fixture();
    internal.rapidPractice = true;
    internal.rapidPracticePendingRewards.set("trainee", { wave: 3, rare: true, weapon: false });
    internal.chooseRapidPracticeUpgrade(client, { upgradeId: "swift_hands" });
    expect(internal.rapidPracticeUpgrades.get("trainee")).toEqual({ damage: 0, haste: 2, vitality: 0, relics: 1 });
    expect(client.send).toHaveBeenCalledWith("practice:reward-applied", expect.objectContaining({ rare: true, haste: 2, relics: 1 }));
  });

  it("swaps Fast World weapons without adding inventory clutter", () => {
    const { internal, player, client } = fixture();
    internal.rapidPractice = true;
    internal.rapidPracticePendingRewards.set("trainee", { wave: 1, rare: false, weapon: true });
    internal.chooseRapidPracticeUpgrade(client, { upgradeId: "weapon_bow" });
    expect(player.mainHandId).toBe("forged_bow");
    expect(player.mainHandTag).toBe("ranged");
    expect(player.inventory.size).toBe(0);
    expect(client.send).toHaveBeenCalledWith("practice:reward-applied",
      expect.objectContaining({ weapon: true, mainHandId: "forged_bow", name: "Deadeye Bow" }));
  });
});
