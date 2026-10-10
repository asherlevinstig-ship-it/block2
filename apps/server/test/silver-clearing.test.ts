import { afterEach, describe, expect, it, vi } from "vitest";
import { SILVER_GUARD_HOMES, playerCollides, isPlayerSupported } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { SILVER_GUARD_IDS, silverGuardAllows } from "../src/wilderness-encounters.js";
import { lootForArchetype } from "../src/loot-rules.js";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const internal = room as any;
  SILVER_GUARD_IDS.forEach((id, index) => internal.registerMob(id, "cave_spitter", SILVER_GUARD_HOMES[index]));
  return { room, internal };
}
describe("polished silver guard clearing", () => {
  it("preserves supported guard spawns and gives the pair contrasting opening patterns", () => {
    const { room, internal } = fixture(); internal.simulatePlayers(.033);
    for (const mob of room.state.mobs.values()) {
      expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
      expect(isPlayerSupported(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(true);
    }
    expect(room.state.mobs.get("cave-spitter")!.attackPattern).toBe("aimed");
    expect(room.state.mobs.get("frontier-spitter")!.attackPattern).toBe("fan");
    expect(silverGuardAllows({ x: 8.5, y: 8, z: 8.5 })).toBe(false);
    expect(silverGuardAllows({ x: 48.5, y: 2, z: 28.5 })).toBe(false);
  });
  it("lets both guards attack on actual generated terrain without leaving their area", () => {
    const { room, internal } = fixture();
    const player = new PlayerState(); Object.assign(player, { x: 48.5, y: 8, z: 28.5, health: 10000, maxHealth: 10000 });
    room.state.players.set("p", player);
    for (let now = 10000; now < 40000; now += 33) {
      vi.setSystemTime(now); internal.simulatePlayers(.033);
      for (const mob of room.state.mobs.values()) expect(silverGuardAllows(mob)).toBe(true);
    }
    for (const mob of room.state.mobs.values()) expect(mob.actionSequence).toBeGreaterThan(1);
  });
  it("creates fixed personal focus and potion drops without changing ordinary spitters", () => {
    const { room, internal } = fixture();
    for (const id of SILVER_GUARD_IDS) internal.spawnLootDrops(id, room.state.mobs.get(id), 10000, "contributor");
    const drops = [...room.state.lootDrops.values()];
    expect(drops.every(drop => drop.ownerId === "contributor")).toBe(true);
    expect(drops.filter(drop => drop.itemId === "healing_potion")).toHaveLength(2);
    expect(drops.filter(drop => drop.itemId === "acid_gland_focus")).toHaveLength(2);
    expect(lootForArchetype("cave_spitter").some(drop => drop.itemId === "healing_potion")).toBe(false);
  });
});
