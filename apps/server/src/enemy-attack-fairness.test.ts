import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { BRUTE_SLAM, FRONTIER_BRUTE, TOWER_FLOOR_ONE_BOSS_ID, TOWER_FLOOR_ONE_NORTH_WARDEN_ID } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(id: string, archetype = "stone_brute", pattern = "slam", wall = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) =>
    y <= 0 || wall && x === 201 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 201.4, y: 1, z: 200, health: 20, maxHealth: 20 });
  const mob = new MobState(); Object.assign(mob, { x: 200, y: 1, z: 200, archetype, yaw: 90,
    attackPattern: pattern, combatState: "strike", attackDamage: 2, attackStrikeX: pattern === "smash" ? 200 : 201.4,
    attackStrikeY: 1, attackStrikeZ: 200, aimCommitted: true });
  room.state.players.set("hero", player); room.state.mobs.set(id, mob);
  internal.setMobAttackTimeline(mob, 10000, 11000, id);
  internal.pendingMobMelee.set(id, { targetId: "hero", yaw: 90, impactAt: mob.attackContactAt });
  return { internal, player, mob };
}

describe("Fast World enemy attack fairness", () => {
  it.each([["brute", "stone_brute", "slam"], [TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", "smash"],
    [TOWER_FLOOR_ONE_NORTH_WARDEN_ID, "stone_brute", "root-slam"], ["crawler", "moss_crawler", "bite"]])(
    "%s only hits during contact, once, and leaves recovery harmless", (id, archetype, pattern) => {
      const { internal, player, mob } = fixture(id, archetype, pattern);
      internal.resolveMobMelee(mob.attackContactAt - 71); expect(player.health).toBe(20);
      internal.resolveMobMelee(mob.attackContactAt); expect(player.health).toBe(18);
      internal.resolveMobMelee(mob.attackContactEndAt); expect(player.health).toBe(18);
      internal.resolveMobMelee(mob.attackRecoveryEndAt - 1); expect(player.health).toBe(18);
    });
  it.each([["brute", "stone_brute", "slam"], [TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", "smash"],
    [TOWER_FLOOR_ONE_NORTH_WARDEN_ID, "stone_brute", "root-slam"], ["crawler", "moss_crawler", "bite"]])(
    "%s cannot hit someone entering the danger area after an expired attack", (id, archetype, pattern) => {
      const { internal, player, mob } = fixture(id, archetype, pattern);
      internal.resolveMobMelee(mob.attackContactEndAt + 1);
      expect(player.health).toBe(20); expect(internal.pendingMobMelee.size).toBe(0);
    });
  it.each(["slam", "smash"])("lets players step outside the locked %s footprint", pattern => {
    const { internal, player, mob } = fixture(TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", pattern);
    const lockedX = mob.attackStrikeX;
    player.z += pattern === "slam" ? BRUTE_SLAM.radius + .02 : FRONTIER_BRUTE.halfWidth + .02;
    internal.resolveMobMelee(mob.attackContactAt);
    expect(player.health).toBe(20); expect(mob.attackStrikeX).toBe(lockedX);
  });
  it.each(["slam", "smash"])("still punishes standing just inside the %s footprint", pattern => {
    const { internal, player, mob } = fixture(TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", pattern);
    player.z += pattern === "slam" ? BRUTE_SLAM.radius - .02 : FRONTIER_BRUTE.halfWidth - .02;
    internal.resolveMobMelee(mob.attackContactAt); expect(player.health).toBe(18);
  });
  it("respects solid cover at the Crownkeeper's smash impact", () => {
    const { internal, player, mob } = fixture(TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", "smash", true);
    internal.resolveMobMelee(mob.attackContactAt); expect(player.health).toBe(20);
  });
  it("expires a delayed charge before it can move or deal recovery damage", () => {
    const { internal, player, mob } = fixture(TOWER_FLOOR_ONE_BOSS_ID, "stone_brute", "charge");
    mob.isMiniBoss = true; internal.setMobAttackTimeline(mob, 10000, 11000, TOWER_FLOOR_ONE_BOSS_ID);
    internal.championCharges.set(TOWER_FLOOR_ONE_BOSS_ID, { yaw: 90, startedAt: 11000, progress: 0, hit: new Set() });
    internal.advanceChampionCharges(mob.attackContactEndAt + 1);
    expect(player.health).toBe(20); expect(mob.x).toBe(200); expect(internal.championCharges.size).toBe(0);
  });
  it.each([20, 500])("keeps the published melee schedule when a release tick is %s ms late", late => {
    const { internal, mob, player } = fixture("brute");
    mob.combatState = "windup"; mob.targetId = "hero"; mob.stateUntil = mob.attackReleaseAt;
    internal.mobCommittedAim.set("brute", { x: player.x, y: player.y, z: player.z, yaw: 90 });
    const contactAt = mob.attackContactAt, recoveryAt = mob.attackRecoveryEndAt;
    vi.setSystemTime(mob.attackReleaseAt + late); internal.simulatePlayers(.033);
    expect(mob.attackContactAt).toBe(contactAt); expect(mob.attackRecoveryEndAt).toBe(recoveryAt);
    if (late === 500) {
      expect(mob.combatState).toBe("recover"); expect(internal.pendingMobMelee.size).toBe(0);
      expect(player.health).toBe(20);
    }
  });
});
