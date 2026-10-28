import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { TOWER_FLOOR_ONE_BOSS_ID, type FloorAttemptSummary } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { InventoryItemState, MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";
import { withCrownkeeperFragments } from "./crownkeeper-progress.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined); vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 375, y: 8, z: 106,
    health: 5, maxHealth: 5, level: 5, experience: 19, coins: 44 });
  player.huntLoadoutsJson = withCrownkeeperFragments(serializeBuildPathState(
    grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), "assassin"), 140).state), 3);
  const sword = new InventoryItemState(); sword.quantity = 1; player.inventory.set("forged_sword", sword);
  const ore = new InventoryItemState(); ore.quantity = 5; player.inventory.set("iron_ore", ore);
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  const boss = new MobState(); Object.assign(boss, { x: 378, y: 8, z: 106, name: "The Crownkeeper", health: 31,
    maxHealth: 52, alive: true, isMiniBoss: true, archetype: "stone_brute", attackPattern: "smash" });
  room.state.mobs.set(TOWER_FLOOR_ONE_BOSS_ID, boss);
  internal.floorRunUpgrades.start("hero"); internal.floorRunUpgrades.earn("hero", "north");
  const offer = internal.floorRunUpgrades.state("hero", "assassin", internal.floorUpgradeAbilities(player));
  internal.floorRunUpgrades.choose("hero", offer.offerId, offer.choices[0], "assassin", internal.floorUpgradeAbilities(player));
  internal.floorRunUpgrades.earn("hero", "south");
  const die = () => internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 50, 10000, false);
  const summaries = (): FloorAttemptSummary[] => client.send.mock.calls.filter(([type]) => type === "floor:attempt-ended").map(([, data]) => data);
  return { room, internal, player, boss, client, die, summaries };
}

describe("Floor 1 defeat summary", () => {
  it("captures the real build and earned choices before clearing the attempt", () => {
    const f = fixture(); const picked = f.internal.floorRunUpgrades.state("hero", "assassin", f.internal.floorUpgradeAbilities(f.player)).picked;
    f.die(); const summary = f.summaries()[0]!;
    expect(summary).toMatchObject({ floor: 1, calling: "assassin", wardensDefeated: 2, picked, unusedChoices: 1,
      boss: { health: 31, maxHealth: 52, lastSeen: false },
      kept: { level: 5, experience: 19, gold: 44, crownFragments: 3 },
      cause: { name: "The Crownkeeper", pattern: "smash", kind: "melee" } });
    expect(summary.tip).toContain("Parry the cleave");
    expect(f.internal.floorRunUpgrades.active("hero")).toBe(false);
    f.die(); expect(f.summaries()).toHaveLength(1);
  });
  it("reports kept gear and currency accurately while minerals move to a recovery bag", () => {
    const f = fixture(); f.die();
    expect(f.player.inventory.get("forged_sword")?.quantity).toBe(1);
    expect(f.player.inventory.get("iron_ore")?.quantity).toBe(0);
    expect([...f.player.recoveryBags.values()][0]?.items.get("iron_ore")?.quantity).toBe(5);
    expect(f.player.coins).toBe(f.summaries()[0]!.kept.gold);
    expect(f.player.experience).toBe(f.summaries()[0]!.kept.experience);
  });
  it("does not reveal a boss the character has not approached", () => {
    const f = fixture(); f.player.x = 330; f.die();
    expect(f.summaries()[0]?.boss).toBeNull();
  });
  it("labels a previously observed boss snapshot when the player dies elsewhere", () => {
    const f = fixture(); f.internal.sendFloorRunUpgrades(f.client);
    f.player.x = 330; f.boss.health = 52; f.die();
    expect(f.summaries()[0]?.boss).toEqual({ health: 31, maxHealth: 52, lastSeen: true });
  });
  it("recognises a boss that fell before its final projectile hit", () => {
    const f = fixture(); f.boss.health = 0; f.boss.alive = false;
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 50, 10000, false, "projectile", undefined, "rocks");
    expect(f.summaries()[0]?.boss?.health).toBe(0);
    expect(f.summaries()[0]?.tip).toContain("shots");
  });
  it("uses the queued projectile's original pattern rather than the boss's next move", () => {
    const f = fixture();
    f.internal.queueIncomingHit(TOWER_FLOOR_ONE_BOSS_ID, "hero", 50, 10000, "projectile", "rocks");
    f.boss.attackPattern = "charge"; f.internal.resolvePendingIncomingHits(11000);
    expect(f.summaries()[0]?.cause.pattern).toBe("rocks");
    expect(f.summaries()[0]?.tip).toContain("Move sideways");
    expect(f.summaries()[0]?.tip).not.toContain("charge lane");
  });
  it("retains the original move through a delayed second volley", () => {
    const f = fixture();
    f.internal.delayedMatriarchVolleys.set(TOWER_FLOOR_ONE_BOSS_ID, { origin: { x: 378, y: 8, z: 106 },
      shots: [{ x: 370, y: 8, z: 106 }], releaseAt: 10000, damage: 2, travelMs: 1000, attackPattern: "rocks" });
    f.boss.attackPattern = "smash"; f.internal.resolveMobProjectiles(10000);
    expect([...f.internal.pendingMobProjectiles.values()][0]?.attackPattern).toBe("rocks");
  });
  it("gives ground-hazard advice without guessing the boss's current melee move", () => {
    const f = fixture(); f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 50, 10000, false, "hazard");
    expect(f.summaries()[0]?.cause.pattern).toBe(""); expect(f.summaries()[0]?.tip).toContain("marked ground");
  });
  it("does not emit a Floor 1 summary for the archived mode or an inactive attempt", () => {
    const archived = fixture(); archived.internal.rapidPractice = false; archived.internal.roomKind = "overworld"; archived.die();
    expect(archived.summaries()).toHaveLength(0);
    const inactive = fixture(); inactive.internal.clearFloorRunUpgrades("hero"); inactive.die();
    expect(inactive.summaries()).toHaveLength(0);
  });
  it("starts a new summary with no old perks or boss progress after a fresh attempt", async () => {
    const f = fixture(); f.die(); const first = f.summaries()[0]!;
    await f.internal.returnPlayerToTown(f.client);
    expect(f.player.health).toBe(f.player.maxHealth); expect(f.player.coins).toBe(44);
    Object.assign(f.player, { x: 330, y: 8, z: 106, invulnerableUntil: 0 });
    f.internal.sendFloorRunUpgrades(f.client); f.die();
    const second = f.summaries()[1]!;
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({ wardensDefeated: 0, picked: [], unusedChoices: 0, boss: null });
  });
  it("does not mistake a parried old rock projectile for a cleave counter", () => {
    const f = fixture(); f.player.yaw = 90; f.player.defending = true; f.player.defenseStartedAt = 9950;
    f.boss.combatState = "strike"; f.boss.attackPattern = "smash";
    f.internal.damagePlayer(TOWER_FLOOR_ONE_BOSS_ID, "hero", 2, 10000, true, "projectile", undefined, "rocks");
    expect(f.internal.crownkeeperOpeningUntil).toBe(0);
  });
});
