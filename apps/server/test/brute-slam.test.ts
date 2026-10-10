import { afterEach, describe, expect, it, vi } from "vitest";
import { BRUTE_SLAM, bruteSlamCenter, bruteSlamOutline } from "@blockcraft/protocol";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture(read = flat) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype: "stone_brute", attackDamage: 2 });
  room.state.mobs.set("brute", mob);
  const internal = room as any;
  const add = (id: string, x = 101.9, z = 100.5, y = 1) => {
    const player = new PlayerState(); Object.assign(player, { x, y, z }); room.state.players.set(id, player); return player;
  };
  const arm = () => {
    const center = bruteSlamCenter(mob, 90);
    Object.assign(mob, { combatState: "strike", attackStrikeX: center.x, attackStrikeY: center.y, attackStrikeZ: center.z });
    internal.pendingMobMelee.set("brute", { targetId: "first", yaw: 90, impactAt: 11000 });
  };
  return { room, internal, mob, add, arm };
}
describe("brute ground slam", () => {
  it("tracks slowly before commitment, stays planted, and freezes afterwards", () => {
    const { internal, mob, add } = fixture(); const player = add("first");
    internal.simulatePlayers(.033);
    const yaw = mob.yaw; player.x = mob.x; player.z = mob.z + 1.4;
    vi.setSystemTime(10033); internal.simulatePlayers(.033);
    expect(Math.abs(mob.yaw - yaw)).toBeCloseTo(3.96);
    expect(mob.x).toBe(100.5); expect(mob.z).toBe(100.5);
    vi.setSystemTime(10500); internal.simulatePlayers(.033);
    const locked = mob.yaw;
    player.z = mob.z - 1.4;
    vi.setSystemTime(10800); internal.simulatePlayers(.033);
    expect(mob.yaw).toBe(locked); expect(mob.aimCommitted).toBe(true);
  });
  it("draws the same radius as damage with upward-facing warning triangles", () => {
    const points = bruteSlamOutline();
    for (const point of points) expect(Math.hypot(point.x, point.z)).toBeCloseTo(BRUTE_SLAM.radius);
    const [a, b, c] = [points[0]!, points[2]!, points[1]!];
    expect((b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z)).toBeGreaterThan(0);
  });
  it("locks its impact centre before release even when its target circles", () => {
    const { internal, mob, add } = fixture(); const player = add("first");
    internal.simulatePlayers(.033);
    vi.setSystemTime(10500); internal.simulatePlayers(.033);
    const center = [mob.attackStrikeX, mob.attackStrikeY, mob.attackStrikeZ];
    player.z += 1;
    vi.setSystemTime(11000); internal.simulatePlayers(.033);
    expect([mob.attackStrikeX, mob.attackStrikeY, mob.attackStrikeZ]).toEqual(center);
    vi.setSystemTime(11150); internal.simulatePlayers(.033);
    expect([mob.attackStrikeX, mob.attackStrikeY, mob.attackStrikeZ]).toEqual(center);
    expect(mob.x).toBe(100.5); expect(mob.attackRecoveryEndAt - mob.attackContactEndAt).toBe(BRUTE_SLAM.recoveryMs);
  });
  it("hits everyone in the circle only at actual impact and only once", () => {
    const { internal, add, arm } = fixture(); const first = add("first"); const second = add("second", 101.9, 102);
    arm(); internal.resolveMobMelee(10999); expect(first.health).toBe(5);
    internal.resolveMobMelee(11000); expect(first.health).toBe(3); expect(second.health).toBe(3);
    internal.resolveMobMelee(11500); expect(first.health).toBe(3);
  });
  it("lets a dodge out of the marked radius avoid damage", () => {
    const { internal, add, arm } = fixture(); const first = add("first"); arm();
    first.z += BRUTE_SLAM.radius + .01;
    internal.resolveMobMelee(11000); expect(first.health).toBe(5);
  });
  it("respects walls between the slam and a player", () => {
    const wall: WorldBlockReader = (x, y) => y <= 0 || x === 103 && y <= 3 ? Block.Stone : Block.Air;
    const { internal, add, arm } = fixture(wall); const first = add("first", 103.5);
    arm(); internal.resolveMobMelee(11000); expect(first.health).toBe(5);
  });
  it("does not hit another floor or an invulnerable player", () => {
    const { internal, add, arm } = fixture(); const first = add("first"); first.invulnerableUntil = 12000;
    const upstairs = add("upstairs", 101.9, 100.5, 3);
    arm(); internal.resolveMobMelee(11000); expect(first.health).toBe(5); expect(upstairs.health).toBe(5);
  });
  it("does not need the original target to remain connected at impact", () => {
    const { internal, add, arm } = fixture(); const second = add("second");
    arm(); internal.resolveMobMelee(11000); expect(second.health).toBe(3);
  });
  it("cancels a staggered slam without phantom damage", () => {
    const { internal, add, arm, mob } = fixture(); const first = add("first"); arm(); mob.combatState = "stagger";
    internal.resolveMobMelee(11000); expect(first.health).toBe(5); expect(internal.pendingMobMelee.size).toBe(0);
  });
});
