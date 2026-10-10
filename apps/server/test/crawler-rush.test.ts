import { afterEach, describe, expect, it, vi } from "vitest";
import { CRAWLER_RUSH_MS, crawlerRushDistance, mobStrikeGroundOutline } from "@blockcraft/protocol";
import { Block, playerCollides, isPlayerSupported, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture(read = flat, archetype = "moss_crawler") {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype, combatState: "strike", yaw: 90 });
  room.state.mobs.set("crawler", mob);
  const player = new PlayerState(); Object.assign(player, { x: 102.4, y: 1, z: 100.5 });
  room.state.players.set("player", player);
  const internal = room as any;
  const arm = () => internal.crawlerRushes.set("crawler", { yaw: 90, distance: crawlerRushDistance(archetype), startedAt: 10000, progress: 0 });
  return { mob, player, internal, arm };
}
describe("committed crawler rush", () => {
  it("circles briefly on approach then begins the normal warned strike", () => {
    const { mob, player, internal } = fixture(); mob.combatState = "idle"; player.x = 103;
    internal.simulatePlayers(.033);
    expect(mob.combatState).toBe("idle");
    expect(mob.z).not.toBe(100.5);
    for (let now = 10033; now < 12000 && mob.combatState === "idle"; now += 33) {
      vi.setSystemTime(now); internal.simulatePlayers(.033);
    }
    expect(mob.combatState).toBe("windup");
    expect(mob.attackReleaseAt).toBeGreaterThan(Date.now());
    expect(internal.crawlerRushes.size).toBe(0);
  });
  it.each(["moss_crawler", "briar_crawler"])("moves %s progressively along a fixed direction", archetype => {
    const { mob, player, internal, arm } = fixture(flat, archetype); arm();
    internal.advanceCrawlerRushes(10000); expect(mob.x).toBe(100.5);
    internal.advanceCrawlerRushes(10030); expect(mob.x).toBeCloseTo(100.5 + crawlerRushDistance(archetype) / 4);
    player.z += 4; mob.yaw = 0;
    internal.advanceCrawlerRushes(10060); expect(mob.z).toBe(100.5); expect(mob.yaw).toBe(90);
    internal.advanceCrawlerRushes(10000 + CRAWLER_RUSH_MS);
    expect(mob.x).toBeCloseTo(100.5 + crawlerRushDistance(archetype));
    expect(internal.crawlerRushes.size).toBe(0);
  });
  it("stops at walls without tunnelling or restarting the rush", () => {
    const wall: WorldBlockReader = (x, y) => y <= 0 || x === 101 && y <= 3 ? Block.Stone : Block.Air;
    const { mob, internal, arm } = fixture(wall); arm();
    internal.advanceCrawlerRushes(10120);
    expect(playerCollides(wall, mob.x, mob.y, mob.z)).toBe(false);
    expect(mob.x).toBeLessThan(101); expect(internal.crawlerRushes.size).toBe(0);
  });
  it("does not rush into a mined shaft", () => {
    const shaft: WorldBlockReader = (x, y) => x <= 100 && y <= 0 ? Block.Stone : Block.Air;
    const { mob, internal, arm } = fixture(shaft); arm(); internal.advanceCrawlerRushes(10120);
    expect(isPlayerSupported(shaft, mob.x, mob.y, mob.z)).toBe(true); expect(internal.crawlerRushes.size).toBe(0);
  });
  it.each(["stagger", "recover"])("stops movement during %s", combatState => {
    const { mob, internal, arm } = fixture(); arm(); mob.combatState = combatState;
    internal.advanceCrawlerRushes(10120); expect(mob.x).toBe(100.5); expect(internal.crawlerRushes.size).toBe(0);
  });
  it("releases only after windup and keeps the landing corridor locked", () => {
    const { mob, player, internal } = fixture(); mob.combatState = "idle";
    internal.simulatePlayers(.033); expect(mob.combatState).toBe("windup");
    const release = mob.attackReleaseAt;
    vi.setSystemTime(release - 550); internal.simulatePlayers(.033); const yaw = mob.yaw;
    player.z += .2;
    vi.setSystemTime(release); internal.simulatePlayers(.033);
    expect(mob.x).toBe(100.5); expect(mob.yaw).toBe(yaw); expect(internal.crawlerRushes.size).toBe(1);
    vi.setSystemTime(release + 60); internal.simulatePlayers(.033);
    expect(mob.x).toBeCloseTo(100.95); expect(mob.z).toBe(100.5);
    expect(mob.attackStrikeX).toBe(100.5); expect(mob.attackStrikeZ).toBe(100.5);
  });
  it("includes the start and end of the rush in the warning corridor", () => {
    const outline = mobStrikeGroundOutline("moss_crawler", 90);
    expect(Math.max(...outline.map(p => p.x))).toBeGreaterThan(2.9);
    expect(Math.min(...outline.map(p => p.x))).toBeLessThan(0);
  });
});
