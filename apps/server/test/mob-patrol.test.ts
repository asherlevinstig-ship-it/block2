import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { MOB_PATROL_RADIUS, patrolDestination } from "../src/mob-patrol.js";

const flat: WorldBlockReader = (_x, y, _z) => y <= 0 ? Block.Stone : Block.Air;
const home = { x: 100.5, y: 1, z: 100.5 };
function fixture(read = flat) {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  const internal = room as unknown as {
    simulatePlayers(dt: number): void;
    mobHomes: Map<string, typeof home>;
    mobPatrols: Map<string, { goal: typeof home | null }>;
  };
  const mob = new MobState(); Object.assign(mob, home);
  room.state.mobs.set("patroller", mob); internal.mobHomes.set("patroller", home);
  const tick = () => { vi.setSystemTime(Date.now() + 100); internal.simulatePlayers(0.1); };
  return { room, mob, internal, tick };
}
afterEach(() => vi.useRealTimers());

describe("local mob patrols", () => {
  it("selects stable, varied destinations within the home area and respects exclusion zones", () => {
    const points = Array.from({ length: 8 }, (_, sequence) => patrolDestination("one", home, sequence, flat, p => p.x >= home.x));
    for (const point of points) {
      expect(point).not.toBeNull();
      expect(point!.x).toBeGreaterThanOrEqual(home.x);
      expect(Math.hypot(point!.x - home.x, point!.z - home.z)).toBeLessThanOrEqual(MOB_PATROL_RADIUS);
    }
    expect(new Set(points.map(p => `${p!.x},${p!.z}`)).size).toBeGreaterThan(2);
    expect(patrolDestination("one", home, 0, flat, p => p.x >= home.x)).toEqual(points[0]);
    expect(patrolDestination("one", home, 0, () => Block.Air, () => true)).toBeNull();
  });
  it("walks, pauses, and stays within its area for multiple patrol legs", () => {
    const { mob, tick } = fixture(); let moving = 0; let paused = 0;
    const positions = new Set<string>();
    for (let i = 0; i < 900; i++) {
      const previous = { x: mob.x, z: mob.z }; tick();
      const travel = Math.hypot(mob.x - previous.x, mob.z - previous.z);
      if (travel > 0.001) moving++; else paused++;
      expect(Math.hypot(mob.x - home.x, mob.z - home.z)).toBeLessThanOrEqual(MOB_PATROL_RADIUS + 0.51);
      expect(travel).toBeLessThanOrEqual(0.091);
      positions.add(`${Math.round(mob.x)},${Math.round(mob.z)}`);
    }
    expect(moving).toBeGreaterThan(300); expect(paused).toBeGreaterThan(50);
    expect(positions.size).toBeGreaterThan(10);
  });
  it("does not collide with obstacles while patrolling", () => {
    const read: WorldBlockReader = (x, y, z) => y <= 0 || (x === 102 && z >= 99 && z <= 101 && y <= 3) ? Block.Stone : Block.Air;
    const { mob, tick } = fixture(read);
    for (let i = 0; i < 500; i++) { tick(); expect(playerCollides(read, mob.x, mob.y, mob.z)).toBe(false); }
  });
  it("switches to chase immediately, then returns to the local area after losing the player", () => {
    const { mob, room, internal, tick } = fixture();
    for (let i = 0; i < 20; i++) tick();
    expect(internal.mobPatrols.has("patroller")).toBe(true);
    const player = new PlayerState(); Object.assign(player, { x: mob.x + 6, y: 1, z: mob.z });
    room.state.players.set("visitor", player);
    const before = mob.x; tick();
    expect(internal.mobPatrols.has("patroller")).toBe(false);
    expect(mob.x).toBeGreaterThan(before);
    room.state.players.clear(); mob.x = home.x + 8; mob.z = home.z;
    for (let i = 0; i < 200; i++) tick();
    expect(Math.hypot(mob.x - home.x, mob.z - home.z)).toBeLessThanOrEqual(MOB_PATROL_RADIUS + 0.5);
  });
});
