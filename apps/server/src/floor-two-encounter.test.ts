import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { FAST_WORLD_COLLISION_QUERY, RAPID_PRACTICE_ARENA, TOWER_FLOOR_TWO,
  TOWER_FLOOR_TWO_BOSS_ID, TOWER_FLOOR_TWO_FORGEHEART_COMBAT,
  TOWER_FLOOR_TWO_REGULATORS, TOWER_FLOOR_TWO_SPAWNS, parseTowerProgress,
  towerFloorTwoGroundHeight } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(20_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number, z: number) =>
    FAST_WORLD_COLLISION_QUERY.cellSolid(x, y, z) ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "refreshNearbyObjectives").mockImplementation(() => {});
  vi.spyOn(Math, "random").mockReturnValue(.99);
  const player = new PlayerState(); Object.assign(player, { ...TOWER_FLOOR_TWO.entry,
    health: 30, maxHealth: 30, stamina: 100, maxStamina: 100, level: 8, mainHandId: "forged_sword" });
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  return { room, internal, player, client, broadcast };
}

describe("Floor 2 Emberworks encounter", () => {
  it("uses shared XState encounter memory to rally nearby authored allies", () => {
    const f = fixture();
    const first = TOWER_FLOOR_TWO_SPAWNS.find(spawn => spawn.id === "floor2-bellows-hound-a")!;
    const second = TOWER_FLOOR_TWO_SPAWNS.find(spawn => spawn.id === "floor2-bellows-hound-b")!;
    for (const spawn of [first, second]) {
      const mob = new MobState();
      Object.assign(mob, spawn, { alive: true, health: 12, maxHealth: 12, combatState: "idle" });
      f.room.state.mobs.set(spawn.id, mob);
    }
    Object.assign(f.player, { x: first.x, y: first.y, z: first.z });

    f.internal.rallyFloorTwoEncounter(first.id, "hero", 20_000);

    expect(f.internal.mobAwareness.get(second.id)).toMatchObject({ targetId: "hero", provokedUntil: 26_000 });
    expect(f.room.state.mobs.get(second.id)?.awarenessState).toBe("formation:alert");
  });

  it("damages inside a telegraphed active vent and disables branch vents after regulation", () => {
    const active = fixture();
    Object.assign(active.player, { x: 442, y: towerFloorTwoGroundHeight(442, 106), z: 106 });
    active.internal.resolveMobHazards(20_000);
    expect(active.player.health).toBe(29);

    const secured = fixture();
    const regulator = new MobState(); Object.assign(regulator, { alive: false });
    secured.room.state.mobs.set(TOWER_FLOOR_TWO_REGULATORS[0], regulator);
    Object.assign(secured.player, { x: 465, y: towerFloorTwoGroundHeight(465, 72), z: 72 });
    secured.internal.resolveMobHazards(4_400);
    expect(secured.player.health).toBe(30);
  });

  it("builds healer threat from meaningful support but preserves an active tank Challenge", () => {
    const f = fixture();
    const spawn = TOWER_FLOOR_TWO_SPAWNS.find(candidate => candidate.id === "floor2-intake-hound")!;
    const mob = new MobState(); Object.assign(mob, spawn, { alive: true, health: 12, maxHealth: 12, combatState: "idle" });
    f.room.state.mobs.set(spawn.id, mob);
    Object.assign(f.player, { x: spawn.x + 2, y: spawn.y, z: spawn.z });
    const healer = new PlayerState(); Object.assign(healer, { x: spawn.x + 4, y: spawn.y, z: spawn.z,
      health: 20, maxHealth: 20, mainHandId: "magic_focus" });
    f.room.state.players.set("healer", healer);
    f.internal.combatContributions.record(spawn.id, "hero", 2, 20_000);
    f.internal.alertHitMob(spawn.id, "hero", 20_000);

    expect(f.internal.recordFastWorldHealingSupport("healer", "hero", 4, 20_100)).toBe(false);
    expect(f.internal.mobAwareness.get(spawn.id)?.targetId).toBe("healer");
    expect(f.internal.floorTwoEncounterIntelligence.directive(spawn.id, 20_100)).toMatchObject({
      tactic: "punish-healer", tacticTargetId: "healer",
    });

    f.internal.tankChallengeUntil.set("hero", 30_000);
    f.internal.alertHitMob(spawn.id, "hero", 21_000);
    f.internal.recordFastWorldHealingSupport("healer", "hero", 8, 25_000);
    expect(f.internal.mobAwareness.get(spawn.id)?.targetId).toBe("hero");
  });

  it("requires both regulators, awakens the Forgeheart, banks Floor 2 and fully resets", () => {
    const f = fixture();
    for (const id of TOWER_FLOOR_TWO_REGULATORS) {
      const spawn = TOWER_FLOOR_TWO_SPAWNS.find(candidate => candidate.id === id)!;
      const mob = new MobState(); Object.assign(mob, spawn, { health: 44, maxHealth: 44,
        alive: true, isMiniBoss: true, isChampion: true, rewardMultiplier: 2.5 });
      f.room.state.mobs.set(id, mob); f.internal.mobHomes.set(id, spawn);
    }
    const furnace = f.room.state.mobs.get(TOWER_FLOOR_TWO_REGULATORS[0])!;
    Object.assign(f.player, { x: furnace.x - 1, y: furnace.y, z: furnace.z });
    f.internal.combatContributions.record(TOWER_FLOOR_TWO_REGULATORS[0], "hero", furnace.maxHealth, 20_000);
    f.internal.defeatMob(TOWER_FLOOR_TWO_REGULATORS[0], furnace, "hero", 20_000);
    expect(f.room.state.mobs.has(TOWER_FLOOR_TWO_BOSS_ID)).toBe(false);
    expect(furnace.respawnAt).toBe(Number.MAX_SAFE_INTEGER);

    const quench = f.room.state.mobs.get(TOWER_FLOOR_TWO_REGULATORS[1])!;
    Object.assign(f.player, { x: quench.x - 1, y: quench.y, z: quench.z });
    f.internal.combatContributions.record(TOWER_FLOOR_TWO_REGULATORS[1], "hero", quench.maxHealth, 21_000);
    f.internal.defeatMob(TOWER_FLOOR_TWO_REGULATORS[1], quench, "hero", 21_000);
    const boss = f.room.state.mobs.get(TOWER_FLOOR_TWO_BOSS_ID)!;
    expect(boss).toMatchObject({ alive: true, maxHealth: TOWER_FLOOR_TWO_FORGEHEART_COMBAT.health,
      name: "The Forgeheart", attackDamage: 3, armor: 2 });
    expect(f.broadcast).toHaveBeenCalledWith("chat:notice", expect.stringContaining("FORGEHEART AWAKENS"));

    Object.assign(f.player, { x: boss.x - 2, y: boss.y, z: boss.z });
    f.internal.combatContributions.record(TOWER_FLOOR_TWO_BOSS_ID, "hero", boss.maxHealth, 22_000);
    f.internal.defeatMob(TOWER_FLOOR_TWO_BOSS_ID, boss, "hero", 22_000);
    expect(parseTowerProgress(f.player.huntLoadoutsJson).highestFloorCleared).toBe(2);
    expect(f.client.send).toHaveBeenCalledWith("tower:floor-cleared", expect.objectContaining({
      floor: 2, highestFloorCleared: 2, bossName: "The Forgeheart",
    }));

    Object.assign(f.player, RAPID_PRACTICE_ARENA.spawn);
    f.internal.towerFloorWasOccupied = true;
    f.internal.resetTowerFloorAfterDeparture(30_000);
    f.internal.resetTowerFloorAfterDeparture(35_000);
    expect(f.room.state.mobs.has(TOWER_FLOOR_TWO_BOSS_ID)).toBe(false);
    for (const id of TOWER_FLOOR_TWO_REGULATORS)
      expect(f.room.state.mobs.get(id)?.alive, id).toBe(true);
  });
});
