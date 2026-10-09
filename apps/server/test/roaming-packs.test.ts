import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, playerCollides, wildernessTerritoryAt, type WorldBlockReader } from "@blockcraft/voxel-world";
import { ROAMING_PACKS, roamingMemberId, roamingGoal, roamingPackAllows, createRoamingRouteState, advanceRoamingRoute } from "../src/roaming-packs.js";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(flat = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  if (flat) Object.defineProperty(room, "readWorldBlock", { value: ((_x, y) => y <= 7 ? Block.Stone : Block.Air) satisfies WorldBlockReader });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) internal.registerMob(roamingMemberId(pack, index), pack.archetype, roamingGoal(pack, index, 0));
  return { room, internal };
}
describe("bounded roaming enemy packs", () => {
  it("adds six outskirts crawlers and four wilds spitters with correct bands and spacing", () => {
    const { room } = fixture(); expect(room.state.mobs.size).toBe(10);
    for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) {
      const mob = room.state.mobs.get(roamingMemberId(pack, index))!;
      expect(mob.difficultyTier).toBe(pack.tier); expect(mob.name).toContain("Roaming");
      expect(roamingPackAllows(pack, mob)).toBe(true);
      for (let route = 0; route < pack.route.length; route++) expect(roamingPackAllows(pack, roamingGoal(pack, index, route))).toBe(true);
    }
  });
  it("waits for the whole living pack and pauses between shared route legs", () => {
    const pack = ROAMING_PACKS[0]!; const state = createRoamingRouteState(10000);
    const members = pack.offsets.map((_, index) => ({ index, pose: roamingGoal(pack, index, 0), idle: true }));
    advanceRoamingRoute(pack, state, 11000, members); expect(state.index).toBe(0);
    members[1]!.idle = false; advanceRoamingRoute(pack, state, 12000, members); expect(state.index).toBe(0);
    members[1]!.idle = true; advanceRoamingRoute(pack, state, 12000, members); expect(state.index).toBe(1); expect(state.pauseUntil).toBe(13200);
  });
  it("reverses the route without an end-to-start teleport and tolerates missing members", () => {
    const pack = ROAMING_PACKS[0]!; const state = { index: 2, direction: 1, pauseUntil: 0, expiresAt: 0 };
    advanceRoamingRoute(pack, state, 10000, [{ index: 0, pose: roamingGoal(pack, 0, 2), idle: true }]);
    expect(state.index).toBe(1); expect(state.direction).toBe(-1);
  });
  it("rejects town, another territory and positions too far from the patrol corridor", () => {
    const pack = ROAMING_PACKS[0]!;
    expect(roamingPackAllows(pack, { x: 8.5, y: 8, z: 8.5 })).toBe(false);
    expect(roamingPackAllows(pack, ROAMING_PACKS[2]!.route[0]!)).toBe(false);
    expect(roamingPackAllows(pack, { x: 40, y: 8, z: 8 })).toBe(false);
  });
  it("walks generated terrain for a minute without colliding, snapping or leaving its band", () => {
    const { room, internal } = fixture();
    const starts = new Map([...room.state.mobs].map(([id, mob]) => [id, { x: mob.x, z: mob.z }]));
    for (let tick = 0; tick < 600; tick++) {
      vi.setSystemTime(10000 + tick * 100);
      const before = new Map([...room.state.mobs].map(([id, mob]) => [id, { x: mob.x, z: mob.z }]));
      internal.simulatePlayers(.1);
      for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) {
        const id = roamingMemberId(pack, index); const mob = room.state.mobs.get(id)!;
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
        expect(wildernessTerritoryAt(mob.x, mob.z)?.tier).toBe(pack.tier);
        expect(roamingPackAllows(pack, mob)).toBe(true);
        expect(Math.hypot(mob.x - before.get(id)!.x, mob.z - before.get(id)!.z)).toBeLessThanOrEqual(.111);
      }
    }
    for (const [id, mob] of room.state.mobs) expect(Math.hypot(mob.x - starts.get(id)!.x, mob.z - starts.get(id)!.z)).toBeGreaterThan(1);
  });
  it("drops an out-of-band target and returns to its route instead of endless pursuit", () => {
    const { room, internal } = fixture(true); const pack = ROAMING_PACKS[0]!; const id = roamingMemberId(pack, 0);
    const mob = room.state.mobs.get(id)!;
    const player = new PlayerState(); Object.assign(player, { x: mob.x + 3, y: 8, z: mob.z });
    room.state.players.set("player", player); internal.simulatePlayers(.1);
    expect(internal.roamingEngaged.has(id)).toBe(true);
    Object.assign(player, { x: -40, z: -2.5 });
    const before = { x: mob.x, z: mob.z };
    for (let tick = 1; tick < 30; tick++) { vi.setSystemTime(10000 + tick * 100); internal.simulatePlayers(.1); }
    expect(internal.roamingEngaged.has(id)).toBe(false);
    expect(Math.hypot(mob.x - before.x, mob.z - before.z)).toBeGreaterThan(0);
    expect(roamingPackAllows(pack, mob)).toBe(true);
  });
});
