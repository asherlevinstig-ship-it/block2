import { describe, expect, it } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import { basicStaggerDuration, hasCombatLineOfSight, isInsideCommittedArc, projectileImpact } from "../src/combat-impact.js";

const clear: WorldBlockReader = () => Block.Air;
const wall: WorldBlockReader = (x) => x === 102 ? Block.Stone : Block.Air;
const start = { x: 100.5, y: 1.72, z: 100.5 };
const end = { x: 106.5, y: 1.72, z: 100.5 };
describe("combat collision and stagger rules", () => {
  it("blocks melee sight through a voxel wall", () => {
    expect(hasCombatLineOfSight({ ...start, y: 1 }, { ...end, y: 1 }, wall)).toBe(false);
    expect(hasCombatLineOfSight({ ...start, y: 1 }, { ...end, y: 1 }, clear)).toBe(true);
  });
  it("stops at terrain before an enemy behind it", () => {
    expect(projectileImpact(start, end, [{ id: "enemy", x: 105, y: 1, z: 100.5 }], wall)?.kind).toBe("terrain");
  });
  it("hits an intervening body before terrain behind it", () => {
    expect(projectileImpact(start, end, [{ id: "enemy", x: 101.3, y: 1, z: 100.5 }], wall)?.targetId).toBe("enemy");
  });
  it("sweeps fast projectiles and selects the first body", () => {
    const hit = projectileImpact(start, end, [
      { id: "far", x: 105, y: 1, z: 100.5 }, { id: "near", x: 103, y: 1, z: 100.5 },
    ], clear);
    expect(hit?.targetId).toBe("near");
    expect(hit?.point.x).toBeCloseTo(102.62);
  });
  it("does not hit a target that sidestepped or is on another floor", () => {
    expect(projectileImpact(start, end, [{ id: "sidestep", x: 105, y: 1, z: 102 }], clear)).toBeNull();
    expect(projectileImpact(start, end, [{ id: "below", x: 105, y: -2, z: 100.5 }], clear)).toBeNull();
  });
  it("committed melee aim excludes players behind or beside the swing", () => {
    expect(isInsideCommittedArc(start, { ...start, x: 102 }, 90)).toBe(true);
    expect(isInsideCommittedArc(start, { ...start, z: 102 }, 90)).toBe(false);
    expect(isInsideCommittedArc(start, { ...start, x: 99 }, 90)).toBe(false);
  });
  it("light hits and projectiles never universally interrupt windup", () => {
    expect(basicStaggerDuration("longsword", 1, "moss_crawler", "windup")).toBe(0);
    expect(basicStaggerDuration("fang_dagger", 2, "moss_crawler", "windup")).toBe(0);
    expect(basicStaggerDuration("bow", 1, "moss_crawler", "windup")).toBe(0);
    expect(basicStaggerDuration("magic_focus", 1, "moss_crawler", "windup")).toBe(0);
  });
  it("finishers interrupt light enemies but brutes require a hammer", () => {
    expect(basicStaggerDuration("longsword", 3, "moss_crawler", "windup")).toBe(650);
    expect(basicStaggerDuration("longsword", 3, "stone_brute", "windup")).toBe(0);
    expect(basicStaggerDuration("stone_core_hammer", 1, "stone_brute", "windup")).toBe(450);
    expect(basicStaggerDuration("stone_core_hammer", 1, "moss_crawler", "recover")).toBe(0);
  });
});
