import { afterEach, describe, expect, it, vi } from "vitest";
import { GREENWOOD_CRAWLER_HOMES, GREENWOOD_IRON_SEAM, playerCollides, isPlayerSupported } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { GREENWOOD_CAMP_IDS, greenwoodCampAllows } from "../src/wilderness-encounters.js";
import { lootForArchetype } from "../src/loot-rules.js";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  const archetypes = ["moss_crawler", "briar_crawler", "briar_crawler"];
  GREENWOOD_CAMP_IDS.forEach((id, index) => internal.registerMob(id, archetypes[index], GREENWOOD_CRAWLER_HOMES[index]));
  return { room, internal };
}
describe("Greenwood beginner crawler camp", () => {
  it("places three supported crawlers near exposed iron and keeps them in the beginner territory", () => {
    const { room, internal } = fixture();
    expect(room.state.mobs.size).toBe(3);
    for (const mob of room.state.mobs.values()) {
      expect(greenwoodCampAllows(mob)).toBe(true);
      expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
      expect(isPlayerSupported(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(true);
      expect(Math.hypot(mob.x - (GREENWOOD_IRON_SEAM.minX + GREENWOOD_IRON_SEAM.maxX) / 2,
        mob.z - (GREENWOOD_IRON_SEAM.minZ + GREENWOOD_IRON_SEAM.maxZ) / 2)).toBeLessThan(12);
    }
    expect(greenwoodCampAllows({ x: 8.5, y: 8, z: 8.5 })).toBe(false);
    expect(greenwoodCampAllows({ x: 43, y: 3, z: 18 })).toBe(false);
  });
  it("lets all three crawlers engage on real terrain without leaving the camp", () => {
    const { room, internal } = fixture();
    const player = new PlayerState(); Object.assign(player, { x: 43.5, y: 8, z: 18.5, health: 10000, maxHealth: 10000, invulnerableUntil: 100000 });
    room.state.players.set("beginner", player);
    for (let now = 10000; now < 40000; now += 33) {
      vi.setSystemTime(now); internal.simulatePlayers(.033);
      for (const mob of room.state.mobs.values()) {
        expect(greenwoodCampAllows(mob)).toBe(true);
        expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
      }
    }
    for (const mob of room.state.mobs.values()) expect(mob.actionSequence).toBeGreaterThan(0);
  });
  it("keeps beginner drops fixed and item-based", () => {
    expect(lootForArchetype("moss_crawler")).toEqual([
      { itemId: "moss_fibre", quantity: 1 }, { itemId: "crawler_fang", quantity: 1 }, { itemId: "fang_dagger", quantity: 1 },
    ]);
    expect(lootForArchetype("briar_crawler")).toEqual([
      { itemId: "moss_fibre", quantity: 1 }, { itemId: "crawler_fang", quantity: 1 },
    ]);
  });
});
