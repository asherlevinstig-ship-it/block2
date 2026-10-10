import { afterEach, describe, expect, it, vi } from "vitest";
import { SPITTER_PATTERN, spitterPattern, spitterShotEndpoints, spitterWarningLanes } from "@blockcraft/protocol";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { projectileImpact } from "../src/combat-impact.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(sequence = 0) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 0 ? Block.Stone : Block.Air });
  const events: any[] = []; vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type, payload }); });
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype: "cave_spitter", actionSequence: sequence, attackDamage: 1 });
  const player = new PlayerState(); Object.assign(player, { x: 100.5, y: 1, z: 106.5 });
  room.state.mobs.set("test", mob); room.state.players.set("player", player);
  const release = () => { internal.simulatePlayers(.033); vi.setSystemTime(mob.attackReleaseAt); internal.simulatePlayers(.033); };
  return { internal, mob, player, release, events };
}
describe("readable spitter patterns", () => {
  it("alternates aimed and fan without changing mid-windup", () => {
    expect([0, 1, 2, 3].map(spitterPattern)).toEqual(["aimed", "fan", "aimed", "fan"]);
    for (const sequence of [0, 1]) {
      const { internal, mob, release } = fixture(sequence); release();
      expect(mob.attackPattern).toBe(spitterPattern(sequence));
      expect(internal.pendingMobProjectiles.size).toBe(sequence ? 4 : 1);
    }
  });
  it.each([4.7, 7, 9])("has a genuine central gap at %s blocks", distance => {
    const start = { x: 0, y: 1, z: 0 };
    const target = { id: "player", x: 0, y: 1, z: distance };
    for (const end of spitterShotEndpoints(start, 0, "fan")) {
      expect(projectileImpact({ ...start, y: 2.05 }, { ...end, y: end.y + .08 }, [target], () => Block.Air)).toBeNull();
    }
    const lanes = spitterWarningLanes(0, "fan");
    expect(lanes).toHaveLength(4);
    for (const [i, lane] of lanes.entries()) {
      const centre = { x: (lane[2]!.x + lane[3]!.x) / 2, z: (lane[2]!.z + lane[3]!.z) / 2 };
      const end = spitterShotEndpoints(start, 0, "fan")[i]!;
      expect(centre.x).toBeCloseTo(end.x); expect(centre.z).toBeCloseTo(end.z);
    }
  });
  it("fan lanes hurt on contact but not at release; they stop at terrain", () => {
    const { internal, player, mob, release } = fixture(1); release(); expect(player.health).toBe(5);
    player.x = mob.x + Math.sin(12 * Math.PI / 180) * 6;
    player.z = mob.z + Math.cos(12 * Math.PI / 180) * 6;
    internal.resolveMobProjectiles(mob.attackReleaseAt + SPITTER_PATTERN.travelMs);
    expect(player.health).toBe(4); expect(internal.mobHazards.size).toBe(0);
    const start = { x: 0, y: 2, z: 0 }, end = { x: 0, y: 2, z: 10 };
    expect(projectileImpact(start, end, [{ id: "target", x: 0, y: 1, z: 6 }], (_x, _y, z) => z === 3 ? Block.Stone : Block.Air)?.kind).toBe("terrain");
  });
  it.each([0, 1])("locks pattern %s before release despite late movement and 300ms RTT", sequence => {
    const { internal, mob, player, events } = fixture(sequence);
    internal.simulatePlayers(.033);
    const releaseAt = mob.attackReleaseAt;
    vi.setSystemTime(releaseAt - 450); internal.simulatePlayers(.033); expect(mob.aimCommitted).toBe(true);
    player.x += 3; vi.setSystemTime(releaseAt); internal.simulatePlayers(.033);
    const shots = [...internal.pendingMobProjectiles.values()] as any[];
    expect(shots.map(shot => shot.end)).toEqual(spitterShotEndpoints(mob, 0, spitterPattern(sequence)).map(end => ({ ...end, y: end.y + .08 })));
    expect(events.filter(event => event.type === "combat:mob-projectile").every(event => event.payload.releasedAt === releaseAt)).toBe(true);
    // Packet reaches the client 150ms after release; shots are still in flight.
    internal.resolveMobProjectiles(releaseAt + 150); expect(player.health).toBe(5);
    player.x += 3; internal.resolveMobProjectiles(releaseAt + SPITTER_PATTERN.travelMs); expect(player.health).toBe(5);
  });
});
