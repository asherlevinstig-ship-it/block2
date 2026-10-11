import { afterEach, describe, expect, it, vi } from "vitest";
import { FRONTIER_BRUTE, bruteSmashHits, bruteSmashOutline } from "@blockcraft/protocol";
import { Block, chunkIndex, generateChunk, worldToChunk, playerCollides, isPlayerSupported, frontierBruteArenaBlock, FRONTIER_BRUTE_COVER, voxelRaycast } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { frontierBruteAllows } from "../src/wilderness-encounters.js";
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(wall = false) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 7 || wall && x === 66 && y <= 10 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  internal.registerMob("frontier-brute", "stone_brute", { x: 65.5, y: 8, z: 23.5 });
  const mob = room.state.mobs.get("frontier-brute")!;
  const player = new PlayerState(); Object.assign(player, { x: 67, y: 8, z: 23.5 }); room.state.players.set("tester", player);
  return { room, internal, mob, player };
}
describe("frontier brute ruins", () => {
  it.each(["blockcraft-dev", "other-seed"])("keeps rich ore, approach and spawn accessible (%s)", seed => {
    const chunks = new Map<string, ReturnType<typeof generateChunk>>();
    const read = (x: number, y: number, z: number) => {
      const a = worldToChunk(x, z), key = `${a.chunkX},${a.chunkZ}`;
      let c = chunks.get(key); if (!c) { c = generateChunk(seed, a.chunkX, a.chunkZ); chunks.set(key, c); }
      return c.blocks[chunkIndex(a.localX, y, a.localZ)] as Block;
    };
    for (let x = 66; x <= 70; x++) for (let z = 25; z <= 29; z++) {
      expect(read(x, 7, z)).toBe(Block.SilverOre); expect(read(x, 8, z)).toBe(Block.Air);
    }
    for (const [x, z] of [[55.5, 28.5], [58.5, 28.5], [60.5, 28.5], [65.5, 23.5], [68.5, 27.5]]) {
      expect(playerCollides(read, x!, 8, z!)).toBe(false); expect(isPlayerSupported(read, x!, 8, z!)).toBe(true);
    }
    expect(read(60, 7, 20)).toBe(Block.Dirt); expect(read(72, 9, 31)).toBe(Block.Stone);
    expect(FRONTIER_BRUTE_COVER).toHaveLength(6);
    for (const cover of FRONTIER_BRUTE_COVER) {
      expect(read(cover.x, 8, cover.z)).toBe(Block.Stone);
      expect(read(cover.x, 7 + cover.height, cover.z)).toBe(Block.Stone);
      expect(read(cover.x, 8 + cover.height, cover.z)).toBe(Block.Air);
      expect(voxelRaycast({ x: cover.x - 1, y: 8.72, z: cover.z + .5 }, { x: 1, y: 0, z: 0 }, 3, read)?.x).toBe(cover.x);
    }
    for (const [x, z] of [[68.5, 20.5], [68.5, 24.5], [68.5, 30.5], [68.5, 33.5]]) {
      expect(playerCollides(read, x!, 8, z!)).toBe(false);
    }
    expect(frontierBruteArenaBlock(68, 4, 27)).toBeNull();
  });
  it("keeps the named brute in its ruins while leaving the western approach usable", () => {
    expect(frontierBruteAllows({ x: 56, y: 8, z: 28 })).toBe(true);
    expect(frontierBruteAllows({ x: 76, y: 8, z: 35 })).toBe(true);
    expect(frontierBruteAllows({ x: 55.99, y: 8, z: 28 })).toBe(false);
    expect(frontierBruteAllows({ x: 68, y: 5, z: 27 })).toBe(false);
  });
  it("opens at range with a rock volley, follows with a slam, and exposes long recovery windows", () => {
    const { internal, mob, player } = fixture();
    Object.assign(player, { x: 65.5, z: 30.5, invulnerableUntil: 1000000 });
    const releases: { pattern: string; recovery: number }[] = []; let sequence = 0;
    for (let tick = 0; tick < 450 && releases.length < 2; tick++) {
      vi.setSystemTime(10000 + tick * 100); internal.simulatePlayers(.1);
      if (mob.actionSequence === sequence) continue;
      sequence = mob.actionSequence;
      releases.push({ pattern: mob.attackPattern, recovery: mob.attackRecoveryEndAt - mob.attackContactEndAt });
    }
    expect(releases.map(release => release.pattern)).toEqual(["rocks", "slam"]);
    expect(releases[0]!.recovery).toBeGreaterThanOrEqual(2400);
    expect(releases[1]!.recovery).toBeGreaterThanOrEqual(1800);
  });
  it("uses the same narrow directional rectangle for the warning and impact", () => {
    const origin = { x: 0, y: 8, z: 0 };
    for (const yaw of [0, 45, 90, 180, 270]) {
      for (const point of bruteSmashOutline(yaw)) expect(bruteSmashHits(origin, yaw, { ...point, y: 8 })).toBe(true);
    }
    expect(bruteSmashHits(origin, 0, { x: .9, y: 8, z: 2 })).toBe(false);
    expect(bruteSmashHits(origin, 0, { x: 0, y: 8, z: -1 })).toBe(false);
    expect(bruteSmashHits(origin, 0, { x: 0, y: 10, z: 2 })).toBe(false);
  });
  it("alternates committed attacks and remains planted through the counterattack windows", () => {
    const { internal, mob, player } = fixture(); player.invulnerableUntil = 1000000;
    const releases: string[] = []; let sequence = 0;
    for (let tick = 0; tick < 250; tick++) {
      const x = mob.x, z = mob.z, recovering = mob.combatState === "recover" && Date.now() + 100 < mob.stateUntil;
      vi.setSystemTime(10000 + tick * 100); internal.simulatePlayers(.1);
      if (recovering) { expect(mob.x).toBe(x); expect(mob.z).toBe(z); }
      if (mob.actionSequence !== sequence) {
        sequence = mob.actionSequence; releases.push(mob.attackPattern);
        const timing = FRONTIER_BRUTE[mob.attackPattern === "smash" ? "smash" : "slam"];
        expect(mob.attackContactAt - mob.attackReleaseAt).toBe(timing.impactMs);
        expect(mob.attackRecoveryEndAt - mob.attackContactEndAt).toBe(timing.recoveryMs);
      }
    }
    expect(releases.length).toBeGreaterThanOrEqual(4);
    expect(releases.slice(0, 4)).toEqual(["smash", "slam", "smash", "slam"]);
  });
  it("deals smash damage once at impact, not windup, and allows sidestepping", () => {
    const { internal, mob, player } = fixture();
    Object.assign(mob, { combatState: "strike", attackPattern: "smash", attackStrikeX: mob.x, attackStrikeY: mob.y, attackStrikeZ: mob.z });
    internal.pendingMobMelee.set("frontier-brute", { targetId: "tester", yaw: 90, impactAt: 11000 });
    internal.resolveMobMelee(10999); expect(player.health).toBe(5);
    player.z += 1; internal.resolveMobMelee(11000); expect(player.health).toBe(5);
    player.z -= 1; internal.resolveMobMelee(12000); expect(player.health).toBe(5);
    internal.pendingMobMelee.set("frontier-brute", { targetId: "tester", yaw: 90, impactAt: 13000 });
    internal.resolveMobMelee(13000); expect(player.health).toBeLessThan(5);
    const health = player.health; internal.resolveMobMelee(13100); expect(player.health).toBe(health);
  });
  it("blocks the smash with intervening terrain", () => {
    const { internal, mob, player } = fixture(true);
    Object.assign(mob, { combatState: "strike", attackPattern: "smash", attackStrikeX: mob.x, attackStrikeY: mob.y, attackStrikeZ: mob.z });
    internal.pendingMobMelee.set("frontier-brute", { targetId: "tester", yaw: 90, impactAt: 11000 });
    internal.resolveMobMelee(11000); expect(player.health).toBe(5);
  });
  it("freezes the directional warning before release even if the player circles late", () => {
    const { internal, mob, player } = fixture();
    internal.simulatePlayers(.033);
    expect(mob.attackPattern).toBe("smash");
    vi.setSystemTime(mob.attackReleaseAt - 600); internal.simulatePlayers(.033);
    expect(mob.aimCommitted).toBe(true);
    const yaw = mob.yaw, strike = [mob.attackStrikeX, mob.attackStrikeY, mob.attackStrikeZ];
    player.x = mob.x; player.z = mob.z - 1.5;
    vi.setSystemTime(mob.attackReleaseAt - 100); internal.simulatePlayers(.033);
    expect(mob.yaw).toBe(yaw); expect([mob.attackStrikeX, mob.attackStrikeY, mob.attackStrikeZ]).toEqual(strike);
    vi.setSystemTime(mob.attackReleaseAt); internal.simulatePlayers(.033);
    expect(mob.yaw).toBe(yaw); expect(mob.combatState).toBe("strike");
  });
  it("guarantees a personal hammer drop without a rarity roll", () => {
    const { internal, room, mob } = fixture(); vi.spyOn(Math, "random").mockReturnValue(.99);
    internal.spawnLootDrops("frontier-brute", mob, 10000, "tester");
    const hammer = [...room.state.lootDrops.values()].find(drop => drop.itemId === "stone_core_hammer");
    expect(hammer?.quantity).toBe(1); expect(hammer?.ownerId).toBe("tester");
  });
});
