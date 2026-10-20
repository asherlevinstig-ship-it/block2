import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, playerCollides, wildernessTerritoryAt, type WorldBlockReader } from "@blockcraft/voxel-world";
import { ROAMING_PACKS, roamingMemberArchetype, roamingMemberId, roamingGoal, roamingPackAllows, createRoamingRouteState, advanceRoamingRoute } from "../src/roaming-packs.js";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { decodeLootBagItems } from "@blockcraft/protocol";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(flat = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  if (flat) Object.defineProperty(room, "readWorldBlock", { value: ((_x, y) => y <= 7 ? Block.Stone : Block.Air) satisfies WorldBlockReader });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) internal.registerMob(roamingMemberId(pack, index), roamingMemberArchetype(pack, index), roamingGoal(pack, index, 0));
  return { room, internal };
}
describe("bounded roaming enemy packs", () => {
  it("adds two fixed roaming packs to every major region with correct bands and spacing", () => {
    const { room } = fixture(); expect(room.state.mobs.size).toBe(34);
    expect(ROAMING_PACKS.filter(pack => pack.id.startsWith("greenwood-")).length).toBe(2);
    expect(ROAMING_PACKS.filter(pack => pack.id.startsWith("mistfen-")).length).toBe(2);
    expect(ROAMING_PACKS.filter(pack => pack.id.startsWith("stoneheart-")).length).toBe(2);
    expect(ROAMING_PACKS.filter(pack => pack.id.startsWith("ashen-")).length).toBe(2);
    expect(ROAMING_PACKS.filter(pack => /^(greenwood|mistfen|stoneheart|ashen)-/.test(pack.id))
      .every(pack => pack.eliteIndex === 0)).toBe(true);
    for (const pack of ROAMING_PACKS) for (let index = 0; index < pack.offsets.length; index++) {
      const mob = room.state.mobs.get(roamingMemberId(pack, index))!;
      expect(mob.difficultyTier).toBe(pack.tier); expect(mob.name).toContain("Roaming");
      expect(mob.archetype).toBe(roamingMemberArchetype(pack, index));
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
    for (const [id, mob] of room.state.mobs)
      expect(Math.hypot(mob.x - starts.get(id)!.x, mob.z - starts.get(id)!.z), id).toBeGreaterThan(1);
  });
  it("engages every authored regional pack in formation without leaving its regional combat leash", () => {
    for (const pack of ROAMING_PACKS.filter(candidate => candidate.eliteIndex !== undefined)) {
      const { room, internal } = fixture();
      const player = new PlayerState();
      Object.assign(player, pack.route[1], { health: 100, maxHealth: 100, invulnerableUntil: 120_000 });
      room.state.players.set("player", player);
      const starts = pack.offsets.map((_, index) => {
        const mob = room.state.mobs.get(roamingMemberId(pack, index))!;
        return { x: mob.x, z: mob.z };
      });
      internal.alertHitMob(roamingMemberId(pack, pack.eliteIndex!), "player", 10_000);
      vi.setSystemTime(10_100); internal.simulatePlayers(.1);
      expect(room.state.mobs.get(roamingMemberId(pack, pack.eliteIndex!))!.awarenessState, pack.id).toMatch(/^pack:/);
      for (let tick = 2; tick < 62; tick++) {
        vi.setSystemTime(10_000 + tick * 100); internal.simulatePlayers(.1);
      }
      let moved = 0;
      for (let index = 0; index < pack.offsets.length; index++) {
        const mob = room.state.mobs.get(roamingMemberId(pack, index))!;
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z), `${pack.id}:${index}`).toBe(false);
        expect(wildernessTerritoryAt(mob.x, mob.z)?.tier, `${pack.id}:${index}:tier`).toBe(pack.tier);
        expect(pack.route.some(point => Math.hypot(point.x - mob.x, point.z - mob.z) <= 12),
          `${pack.id}:${index}@${mob.x.toFixed(2)},${mob.y.toFixed(2)},${mob.z.toFixed(2)}`).toBe(true);
        if (Math.hypot(mob.x - starts[index]!.x, mob.z - starts[index]!.z) > .5) moved++;
      }
      expect(moved, pack.id).toBeGreaterThanOrEqual(1);
    }
  });
  it("breaks the formation for 3.5 seconds when its veteran falls", () => {
    const { room, internal } = fixture();
    const pack = ROAMING_PACKS.find(candidate => candidate.id === "greenwood-south-pack")!;
    const player = new PlayerState(); Object.assign(player, pack.route[0], { health: 5 });
    room.state.players.set("player", player);
    const leader = room.state.mobs.get(roamingMemberId(pack, pack.eliteIndex!))!;
    leader.isElite = true;
    internal.defeatMob(roamingMemberId(pack, pack.eliteIndex!), leader, "player", 10_000);
    expect(internal.roamingPackDisruptedUntil.get(pack.id)).toBe(13_500);
    for (let index = 1; index < pack.offsets.length; index++) {
      const follower = room.state.mobs.get(roamingMemberId(pack, index))!;
      expect(follower.awarenessState).toBe("disrupted");
      expect(follower.alertUntil).toBe(13_500);
      expect(follower.combatState).toBe("stagger");
    }
  });
  it("adds personal regional loot and a swift-clear reward to the existing bags", () => {
    const { room, internal } = fixture();
    const pack = ROAMING_PACKS.find(candidate => candidate.id === "ashen-east-pack")!;
    const player = new PlayerState(); Object.assign(player, pack.route[0], { health: 5 });
    room.state.players.set("player", player);
    const defeat = (index: number, now: number) => {
      const mob = room.state.mobs.get(roamingMemberId(pack, index))!;
      internal.defeatMob(roamingMemberId(pack, index), mob, "player", now);
    };
    defeat(pack.eliteIndex!, 10_000);
    const veteranBag = [...room.state.lootDrops.values()].at(-1)!;
    expect(veteranBag.ownerId).toBe("player");
    const veteranItems = decodeLootBagItems(veteranBag.contentsJson);
    expect(veteranItems.find(item => item.itemId === "ember_ore")?.quantity).toBeGreaterThanOrEqual(3);
    expect(veteranItems.find(item => item.itemId === "stone_core")?.quantity).toBeGreaterThanOrEqual(1);
    defeat(1, 15_000); defeat(2, 18_000);
    const clearBag = [...room.state.lootDrops.values()].at(-1)!;
    expect(clearBag.ownerId).toBe("player");
    const clearItems = decodeLootBagItems(clearBag.contentsJson);
    expect(clearItems.find(item => item.itemId === "ember_ore")?.quantity).toBeGreaterThanOrEqual(2);
    expect(clearItems.find(item => item.itemId === "healing_potion")?.quantity).toBe(1);
    expect(internal.roamingPackRewardCycles.has(pack.id)).toBe(false);
  });
  it("restores an authored veteran instead of replacing it with a random respawn roll", () => {
    const { room, internal } = fixture();
    const pack = ROAMING_PACKS.find(candidate => candidate.id === "ashen-east-pack")!;
    const leader = room.state.mobs.get(roamingMemberId(pack, pack.eliteIndex!))!;
    Object.assign(leader, { alive: false, isElite: false, eliteKind: "", respawnAt: 10_000, materializeUntil: 0 });
    vi.spyOn(Math, "random").mockReturnValue(.99);
    internal.simulatePlayers(.1);
    expect(leader.isElite).toBe(true);
    expect(leader.name).toBe(`${pack.name} Veteran`);
    expect(leader.materializeUntil).toBeGreaterThan(10_000);
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
