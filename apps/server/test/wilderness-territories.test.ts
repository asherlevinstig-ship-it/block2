import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, MINERAL_DEPOSITS, RENEWABLE_MINERAL_DEPOSITS, wildernessTerritoryAt, wildernessSurfaceBlock, authoredMineralAt, playerCollides } from "@blockcraft/voxel-world";
import { WILDERNESS_ENCOUNTERS } from "../src/wilderness-encounters.js";
import { WorldRoom } from "../src/game-room.js";
import { WorldState } from "../src/schema.js";
import { dangerBandAt, MOB_TOWN_MINIMUM_RADIUS, radiusFromSafeCenter } from "../src/radial-difficulty.js";
import { lootForArchetype } from "../src/loot-rules.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture() {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any; vi.spyOn(room, "broadcast").mockImplementation(() => {});
  for (const spawn of WILDERNESS_ENCOUNTERS) internal.registerMob(spawn.id, spawn.archetype, spawn);
  return { room, internal };
}
describe("distinct radial wilderness territories", () => {
  it("keeps home safe and separates iron outskirts, silver wilds and stone frontier", () => {
    expect(wildernessTerritoryAt(8.5, 8.5)).toBeNull();
    expect(wildernessTerritoryAt(35, -5)?.tier).toBe(1);
    expect(wildernessTerritoryAt(48, 28)?.tier).toBe(2);
    expect(wildernessTerritoryAt(68, 27)?.tier).toBe(3);
    expect(wildernessSurfaceBlock(68, 27)).not.toBe(Block.Grass);
  });
  it("places crawlers in tier one, spitter pairs in tier two and brute guards in tier three", () => {
    const { room } = fixture();
    for (const spawn of WILDERNESS_ENCOUNTERS) {
      const mob = room.state.mobs.get(spawn.id)!;
      expect(mob.difficultyTier).toBe(spawn.archetype === "stone_brute" ? 3 : spawn.archetype === "cave_spitter" ? 2 : 1);
      expect(radiusFromSafeCenter(mob)).toBeGreaterThanOrEqual(MOB_TOWN_MINIMUM_RADIUS - .001);
    }
    expect(WILDERNESS_ENCOUNTERS.filter(e => e.archetype === "cave_spitter")).toHaveLength(4);
    expect(lootForArchetype("stone_brute")).toContainEqual({ itemId: "stone_core_hammer", quantity: 1 });
  });
  it("gives frontier deposits 50 renewable ore cells versus 18 in the wilds", () => {
    const { internal } = fixture();
    const statuses = internal.mineralStatus();
    for (const deposit of MINERAL_DEPOSITS) {
      const status = statuses.find((s: { id: string }) => s.id === `${deposit.x},${deposit.z}`);
      expect(status.available).toBe(status.total);
      expect(status.total).toBe(deposit.radius === 2 ? 50 : 18);
      expect(authoredMineralAt(deposit.x + deposit.radius, 7, deposit.z)).toBe(deposit.block);
    }
    expect(statuses).toHaveLength(RENEWABLE_MINERAL_DEPOSITS.length);
  });
  it("places every guard near the appropriate mineral site", () => {
    for (const spawn of WILDERNESS_ENCOUNTERS) {
      const block = spawn.archetype === "moss_crawler" ? Block.IronOre : Block.SilverOre;
      const nearest = Math.min(...MINERAL_DEPOSITS.filter(d => d.block === block && (spawn.archetype !== "stone_brute" || d.radius === 2))
        .map(d => Math.hypot(spawn.x - d.x, spawn.z - d.z)));
      expect(nearest).toBeLessThan(8);
    }
  });
  it("patrols generated terrain smoothly without placing mobs in solid blocks or inside town", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const { room, internal } = fixture();
    for (let tick = 0; tick < 150; tick++) {
      vi.setSystemTime(10000 + tick * 100);
      const before = new Map([...room.state.mobs].map(([id, mob]) => [id, { x: mob.x, z: mob.z }]));
      internal.simulatePlayers(.1);
      for (const [id, mob] of room.state.mobs) {
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
        expect(radiusFromSafeCenter(mob)).toBeGreaterThanOrEqual(MOB_TOWN_MINIMUM_RADIUS - .01);
        expect(Math.hypot(mob.x - before.get(id)!.x, mob.z - before.get(id)!.z)).toBeLessThanOrEqual(.091);
      }
    }
  });
});
