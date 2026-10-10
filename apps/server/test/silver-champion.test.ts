import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { SILVER_CHAMPION_ID, spitterChampionShots } from "../src/frontier-champion.js";
import { WILDERNESS_ENCOUNTERS } from "../src/wilderness-encounters.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(pattern = "fan", wall = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 0 || wall && x === 103 && y <= 3 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype: "cave_spitter", isChampion: true,
    attackPattern: pattern, actionSequence: pattern === "pool" ? 1 : 0, attackDamage: 1 });
  const player = new PlayerState(); Object.assign(player, { x: 106.5, y: 1, z: 100.5 });
  room.state.mobs.set("test", mob); room.state.players.set("player", player);
  const release = () => { internal.simulatePlayers(.033); vi.setSystemTime(mob.attackReleaseAt); internal.simulatePlayers(.033); };
  return { room, internal, mob, player, release };
}
describe("Silver Venom Champion", () => {
  it("promotes a real silver guard with fixed focus loot", () => {
    expect(WILDERNESS_ENCOUNTERS.some(mob => mob.id === SILVER_CHAMPION_ID)).toBe(true);
    const { room, internal } = fixture();
    internal.registerMob(SILVER_CHAMPION_ID, "cave_spitter", { x: -30.5, y: 8, z: 12.5 });
    const mob = room.state.mobs.get(SILVER_CHAMPION_ID)!;
    expect(mob.name).toBe("Silver Venom Champion"); expect(mob.isChampion).toBe(true);
    internal.spawnLootDrops(SILVER_CHAMPION_ID, mob, 10000);
    expect([...room.state.lootDrops.values()].some(drop => drop.itemId === "acid_gland_focus" && drop.quantity === 1)).toBe(true);
  });
  it("releases four committed shots with a safe central gap and no fan pools", () => {
    const { internal, mob, player, release } = fixture(); release();
    expect(internal.pendingMobProjectiles.size).toBe(4); expect(player.health).toBe(5);
    expect(mob.attackRecoveryEndAt - mob.attackContactEndAt).toBe(1900);
    internal.resolveMobProjectiles(mob.attackReleaseAt + 1250);
    expect(player.health).toBe(5); expect(internal.mobHazards.size).toBe(0);
  });
  it("alternates to a pool with delayed damage and finite expiry", () => {
    const { internal, mob, player, release } = fixture("pool"); release();
    expect(internal.pendingMobProjectiles.size).toBe(1);
    const impactAt = mob.attackReleaseAt + 1100; internal.resolveMobProjectiles(impactAt);
    expect(internal.mobHazards.size).toBe(1); const health = player.health;
    internal.resolveMobHazards(impactAt + 699); expect(player.health).toBe(health);
    internal.resolveMobHazards(impactAt + 800); expect(player.health).toBeLessThan(health);
    internal.resolveMobHazards(impactAt + 4000); expect(internal.mobHazards.size).toBe(0);
    vi.setSystemTime(mob.attackRecoveryEndAt + 1); internal.simulatePlayers(.033);
    vi.setSystemTime(mob.attackRecoveryEndAt + 2000); internal.simulatePlayers(.033);
    expect(mob.attackPattern).toBe("fan");
  });
  it("terrain blocks a pool shot without spawning acid through the wall", () => {
    const { internal, mob, player } = fixture("pool", true);
    internal.pendingMobProjectiles.set("wall", { projectileId: "wall", mobId: "test", archetype: "cave_spitter", damage: 1,
      start: { x: mob.x, y: 2, z: mob.z }, end: { x: player.x, y: 1.08, z: player.z }, position: { x: mob.x, y: 2, z: mob.z },
      startedAt: 10000, impactAt: 11100, hazardRadius: 1.6, hazardDurationMs: 4000 });
    internal.resolveMobProjectiles(11100); expect(player.health).toBe(5); expect(internal.mobHazards.size).toBe(0);
  });
  it("spreads fan endpoints symmetrically around committed aim", () => {
    const shots = spitterChampionShots({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 6 }, "fan");
    expect(shots).toHaveLength(4); expect(shots[0]!.x).toBeCloseTo(-shots[3]!.x);
    expect(shots[1]!.x).toBeCloseTo(-shots[2]!.x);
    expect(shots.every(shot => Math.abs(shot.x) > 2)).toBe(true);
  });
});
