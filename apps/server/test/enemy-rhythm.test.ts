import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { retreatCrawler } from "../src/crawler-positioning.js";
import { WorldRoom } from "../src/game-room.js";
import { MobState, WorldState } from "../src/schema.js";
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
const pose = { x: 100.5, y: 1, z: 100.5 };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("enemy combat rhythms", () => {
  it("backs up slowly on the committed axis for 420ms, then rests", () => {
    let mob = pose;
    for (let now = 10100; now <= 10700; now += 100) mob = retreatCrawler(mob, 90, now, .1, 10000, 10700, flat, () => true);
    expect(mob.x).toBeCloseTo(pose.x - .85 * .42);
    expect(mob.z).toBeCloseTo(pose.z);
    expect(retreatCrawler(pose, 90, 11000, 10, 10000, 10700, flat, () => true)).toEqual(pose);
  });
  it("does not retreat during contact or cross walls, ledges, or protected boundaries", () => {
    expect(retreatCrawler(pose, 90, 9950, .1, 10000, 10700, flat, () => true)).toEqual(pose);
    expect(retreatCrawler(pose, 90, 10100, .1, 10000, 10700, flat, () => false)).toEqual(pose);
    const wall: WorldBlockReader = (x, y) => y <= 0 || x < 100 ? Block.Stone : Block.Air;
    const edge = { ...pose, x: 100.33 };
    expect(retreatCrawler(edge, 90, 10100, .1, 10000, 10700, wall, () => true)).toEqual(edge);
    const unsupported: WorldBlockReader = () => Block.Air;
    expect(retreatCrawler(pose, 90, 10100, .1, 10000, 10700, unsupported, () => true)).toEqual(pose);
  });
  it.each(["moss_crawler", "briar_crawler", "stone_brute", "cave_spitter"])("%s respects recovery and stagger in the authoritative room", archetype => {
    vi.useFakeTimers(); vi.setSystemTime(10100);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: flat });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const mob = new MobState(); Object.assign(mob, pose, { archetype, yaw: 90, combatState: "recover",
      stateUntil: 10700, attackContactEndAt: 10000, attackRecoveryEndAt: 10700 });
    room.state.mobs.set("test-mob", mob);
    const internal = room as any; internal.mobHomes.set("test-mob", pose);
    internal.simulatePlayers(.1);
    expect(mob.combatState).toBe("recover");
    expect(mob.x).toBeCloseTo(archetype.includes("crawler") ? pose.x - .085 : pose.x);
    expect(mob.yaw).toBe(90);
    const before = mob.x; mob.combatState = "stagger";
    vi.setSystemTime(10200); internal.simulatePlayers(.1);
    expect(mob.x).toBe(before);
  });
});
