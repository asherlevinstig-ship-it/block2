import { afterEach, describe, expect, it, vi } from "vitest";
import { CHAMPION_CHARGE, championChargeOutline } from "@blockcraft/protocol";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { FRONTIER_CHAMPION_ID, moveChampionCharge, championChargeHits } from "../src/frontier-champion.js";
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(read = flat) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype: "stone_brute", isChampion: true, attackPattern: "charge", attackDamage: 2, combatState: "strike", yaw: 90 });
  const player = new PlayerState(); Object.assign(player, { x: 102.5, y: 1, z: 100.5 });
  room.state.mobs.set("champion", mob); room.state.players.set("player", player);
  const internal = room as any;
  const arm = () => internal.championCharges.set("champion", { yaw: 90, startedAt: 10000, progress: 0, hit: new Set() });
  return { room, internal, mob, player, arm };
}
describe("frontier champion", () => {
  it("promotes the western rich deposit guard without adding extra mobs", () => {
    vi.spyOn(Math, "random").mockReturnValue(.99); // Preserve the base-loot assertion independently of armour rolls.
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    internal.registerMob(FRONTIER_CHAMPION_ID, "stone_brute", { x: -48.5, y: 8, z: 12.5 });
    const mob = room.state.mobs.get(FRONTIER_CHAMPION_ID)!;
    expect(mob.isChampion).toBe(true); expect(mob.maxHealth).toBe(52); expect(mob.name).toBe("Frontier Stone Champion");
    expect(internal.championAllowed(FRONTIER_CHAMPION_ID, { x: -30, z: 12.5 })).toBe(false);
    internal.spawnLootDrops(FRONTIER_CHAMPION_ID, mob, 10000);
    expect([...room.state.lootDrops.values()].map(drop => [drop.itemId, drop.quantity])).toEqual([["stone_core", 3], ["stone_core_hammer", 1]]);
  });
  it("alternates slam then charge with committed aim and long recovery", () => {
    const { internal, mob, player } = fixture(); mob.combatState = "idle"; player.x = 101.5;
    internal.simulatePlayers(.033); expect(mob.attackPattern).toBe("slam");
    vi.setSystemTime(mob.attackReleaseAt); internal.simulatePlayers(.033); expect(mob.actionSequence).toBe(1);
    vi.setSystemTime(mob.attackRecoveryEndAt + 1); internal.simulatePlayers(.033);
    vi.setSystemTime(14000); internal.simulatePlayers(.033); expect(mob.attackPattern).toBe("charge");
    expect(mob.attackReleaseAt - mob.attackStartedAt).toBe(CHAMPION_CHARGE.windupMs);
    vi.setSystemTime(mob.attackReleaseAt - 650); internal.simulatePlayers(.033); const yaw = mob.yaw;
    player.z += .5;
    vi.setSystemTime(mob.attackReleaseAt); internal.simulatePlayers(.033);
    expect(mob.yaw).toBe(yaw); expect(internal.championCharges.size).toBe(1);
    expect(mob.attackRecoveryEndAt - mob.attackContactEndAt).toBe(CHAMPION_CHARGE.recoveryMs);
  });
  it("respawns with champion health and restarts with a slam", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.registerMob(FRONTIER_CHAMPION_ID, "stone_brute", { x: -48.5, y: 8, z: 12.5 });
    const mob = room.state.mobs.get(FRONTIER_CHAMPION_ID)!;
    mob.actionSequence = 3; mob.attackPattern = "charge";
    internal.defeatMob(FRONTIER_CHAMPION_ID, mob, "absent", 10000);
    expect(mob.respawnAt).toBe(30000);
    vi.setSystemTime(30001); internal.simulatePlayers(.033);
    expect(mob.alive).toBe(true); expect(mob.health).toBe(52);
    expect(mob.attackPattern).toBe("slam"); expect(mob.actionSequence).toBe(0);
  });
  it("sweeps actual travel and hits each player only once", () => {
    const { internal, player, mob, arm } = fixture(); arm();
    internal.advanceChampionCharges(10000); expect(player.health).toBe(5);
    internal.advanceChampionCharges(10300); expect(player.health).toBe(3); expect(mob.x).toBeCloseTo(102.3);
    internal.advanceChampionCharges(10600); expect(player.health).toBe(3); expect(mob.x).toBeCloseTo(104.1);
  });
  it("permits a sidestep under simulated 300 ms RTT and 100 ms reaction", () => {
    const { internal, mob, player } = fixture(); mob.combatState = "idle"; mob.actionSequence = 1;
    internal.simulatePlayers(.033); const release = mob.attackReleaseAt;
    const moveAt = release - 650 + 150 + 100 + 150;
    let sequence = 0;
    for (let now = 10033; now <= release + 700; now += 33) {
      vi.setSystemTime(now);
      if (now >= moveAt && sequence % 2 === 0) internal.handleMove({ sessionId: "player" }, { sequence: sequence + 1, strafe: 0, forward: 1, yaw: 90 });
      sequence++; internal.simulatePlayers(.033);
    }
    expect(player.health).toBe(5);
  });
  it("stops at a wall and cannot hit through it", () => {
    const read: WorldBlockReader = (x, y) => y <= 0 || x === 101 && y <= 3 ? Block.Stone : Block.Air;
    const { internal, mob, player, arm } = fixture(read); arm(); internal.advanceChampionCharges(10600);
    expect(mob.x).toBeLessThan(101); expect(playerCollides(read, mob.x, mob.y, mob.z)).toBe(false); expect(player.health).toBe(5);
  });
  it("does not steer along walls or charge into holes", () => {
    const read: WorldBlockReader = (x, y) => y <= 0 || x === 101 && y <= 3 ? Block.Stone : Block.Air;
    const start = { x: 100.5, y: 1, z: 100.5 };
    const next = moveChampionCharge(start, 45, 3.6, read, () => true);
    expect(Math.abs((next.x - start.x) - (next.z - start.z))).toBeLessThan(.01);
    const shaft: WorldBlockReader = (x, y) => x <= 100 && y <= 0 ? Block.Stone : Block.Air;
    expect(moveChampionCharge(start, 90, 3.6, shaft, () => true).x).toBeLessThan(101.4);
  });
  it("uses a circular sweep width consistent with diagonal warning lanes", () => {
    const start = { x: 0, y: 1, z: 0 }; const end = { x: 3, y: 1, z: 3 };
    expect(championChargeHits(start, end, { x: 1.5 + .8, y: 1, z: 1.5 - .8 })).toBe(false);
    for (const yaw of [0, 45, 90, 180]) expect(championChargeOutline(yaw)).toHaveLength(4);
  });
  it("cancels movement and damage on stagger and respects dodge invulnerability", () => {
    const { internal, mob, player, arm } = fixture(); arm(); mob.combatState = "stagger";
    internal.advanceChampionCharges(10600); expect(mob.x).toBe(100.5); expect(player.health).toBe(5);
    mob.combatState = "strike"; player.invulnerableUntil = 12000; arm(); internal.advanceChampionCharges(10600); expect(player.health).toBe(5);
  });
});
