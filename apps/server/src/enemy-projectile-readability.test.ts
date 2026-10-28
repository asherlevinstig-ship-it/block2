import { describe, expect, it, vi } from "vitest";
import { Block, projectileTerrainImpact, type WorldBlockReader } from "@blockcraft/voxel-world";
import { ENEMY_PROJECTILE_RADIUS, bruteRockEndpoints, spitterShotEndpoints, matriarchSecondVolleyYaw,
  fastWorldProjectileFan, mobProjectileWarningLane } from "@blockcraft/protocol";
import { projectileImpact } from "./combat-impact.js";
import { WorldRoom } from "./game-room.js";
import { MobState, WorldState } from "./schema.js";

const clear: WorldBlockReader = () => Block.Air;
const start = { x: 0, y: 1, z: 0 }, end = { x: 0, y: 1, z: 8 };
describe("hostile projectile core and escape routes", () => {
  it.each([0, 45, 90])("contains every possible body contact in the warning, including end caps, at yaw %s", yaw => {
    const angle = yaw * Math.PI / 180;
    const finish = { x: Math.sin(angle) * 8, y: 1, z: Math.cos(angle) * 8 };
    const lane = mobProjectileWarningLane(yaw, 8, .42, true);
    let contacts = 0;
    for (let x = -1; x <= 9; x += .2) for (let z = -1; z <= 9; z += .2) {
      if (!projectileImpact(start, finish, [{ id: "hero", x, y: 0, z }], clear, ENEMY_PROJECTILE_RADIUS)) continue;
      contacts++;
      expect(lane.every((a, i) => { const b = lane[(i + 1) % lane.length]!;
        return (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x) <= .00001; })).toBe(true);
    }
    expect(contacts).toBeGreaterThan(0);
  });
  it("hits a grazing body edge, but not outside the visible core", () => {
    expect(projectileImpact(start, end, [{ id: "edge", x: .52, y: 0, z: 4 }], clear, ENEMY_PROJECTILE_RADIUS)?.targetId).toBe("edge");
    expect(projectileImpact(start, end, [{ id: "clear", x: .54, y: 0, z: 4 }], clear, ENEMY_PROJECTILE_RADIUS)).toBeNull();
  });
  it("uses the same radius vertically", () => {
    expect(projectileImpact({ ...start, y: 1.54 }, { ...end, y: 1.54 }, [{ id: "head", x: 0, y: 0, z: 4 }], clear, ENEMY_PROJECTILE_RADIUS)?.kind).toBe("entity");
    expect(projectileImpact({ ...start, y: 1.56 }, { ...end, y: 1.56 }, [{ id: "head", x: 0, y: 0, z: 4 }], clear, ENEMY_PROJECTILE_RADIUS)).toBeNull();
  });
  it("stops a projectile edge at cover even when its centre ray clears the wall", () => {
    const wall: WorldBlockReader = (x, y, z) => x === 0 && y === 1 && z === 3 ? Block.Stone : Block.Air;
    const from = { x: -.1, y: 1.5, z: 0 }, to = { ...from, z: 8 };
    expect(projectileImpact(from, to, [{ id: "behind", x: -.1, y: 1, z: 5 }], wall, ENEMY_PROJECTILE_RADIUS)?.kind).toBe("terrain");
    expect(projectileTerrainImpact(from, to, ENEMY_PROJECTILE_RADIUS, wall)?.point.z).toBeCloseTo(2.85);
  });
  it("also stops the bottom of the core on continuous slopes", () => {
    const ground: WorldBlockReader = Object.assign(clear, { groundHeight: () => .9 });
    expect(projectileTerrainImpact({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 1, z: 4 }, ENEMY_PROJECTILE_RADIUS, ground)?.point.y).toBeCloseTo(1.05, 2);
    delete ground.groundHeight;
  });
  it.each(["rocks", "fan", "venom-ring", "double-fan"])("leaves an actual body-sized escape route through %s", pattern => {
    const origin = { x: 0, y: 0, z: 0 };
    const shots = pattern === "rocks" ? bruteRockEndpoints(origin, 0) : spitterShotEndpoints(origin, 0, pattern);
    if (pattern === "double-fan") shots.push(...spitterShotEndpoints(origin, matriarchSecondVolleyYaw(0, 0), pattern));
    const expanded = fastWorldProjectileFan(origin, shots, true);
    const angle = (pattern === "rocks" ? 13 : pattern === "double-fan" ? -60 : 0) * Math.PI / 180;
    const target = { id: "dodging", x: Math.sin(angle) * 4, y: 0, z: Math.cos(angle) * 4 };
    for (const shot of expanded) expect(projectileImpact({ x: 0, y: 1.05, z: 0 },
      { x: shot.x, y: shot.y + .08, z: shot.z }, [target], clear, ENEMY_PROJECTILE_RADIUS)).toBeNull();
  });
  it("publishes the same core size used by the authoritative shot", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    internal.rapidPractice = true;
    const send = vi.spyOn(internal, "broadcastToInterest").mockImplementation(() => {});
    const mob = new MobState(); mob.archetype = "stone_brute";
    internal.releaseMobVolley("brute", mob, { x: 0, y: 0, z: 0 }, bruteRockEndpoints({ x: 0, y: 0, z: 0 }, 0), 1000, 1000, 2, 0, 0);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.every(call => (call[1] as any).coreRadius === ENEMY_PROJECTILE_RADIUS)).toBe(true);
    expect([...internal.pendingMobProjectiles.values()].every((p: any) => p.coreRadius === ENEMY_PROJECTILE_RADIUS)).toBe(true);
  });
  it("also expands direct aimed releases to the three displayed lanes", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    internal.rapidPractice = true;
    const send = vi.spyOn(internal, "broadcastToInterest").mockImplementation(() => {});
    const mob = new MobState(); mob.archetype = "thornbinder";
    internal.releaseMobVolley("caster", mob, { x: 0, y: 0, z: 0 }, spitterShotEndpoints({ x: 0, y: 0, z: 0 }, 0, "aimed"), 1000, 1000, 1, 0, 0);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls.map(call => (call[1] as any).targetX)).toEqual([-.72, 0, .72]);
  });
});
