import { describe, expect, it } from "vitest";
import { spacedMobDesired, mobPersonalSpace } from "../src/mob-spacing.js";
const start = { x: 0, y: 1, z: 0 };
describe("mob personal space", () => {
  it("leaves more room around brutes, with smaller allies yielding sooner but never moving faster", () => {
    expect(mobPersonalSpace("moss_crawler", "stone_brute")).toBe(1.15);
    expect(mobPersonalSpace("moss_crawler", "cave_spitter")).toBe(.75);
    const crawler = spacedMobDesired("a", start, { x: .1, z: 0 }, [{ id: "b", x: 1, y: 1, z: 0, archetype: "stone_brute" }], "moss_crawler");
    const brute = spacedMobDesired("b", start, { x: .1, z: 0 }, [{ id: "a", x: 1, y: 1, z: 0, archetype: "moss_crawler" }], "stone_brute");
    expect(crawler.x).toBeLessThan(brute.x);
    expect(Math.hypot(crawler.x, crawler.z)).toBeLessThanOrEqual(.1);
    expect(Math.hypot(brute.x, brute.z)).toBeLessThanOrEqual(.1);
  });
  it("leaves isolated movement unchanged", () => {
    expect(spacedMobDesired("a", start, { x: .1, z: 0 }, [])).toEqual({ x: .1, z: 0 });
  });
  it("steers away from a touching neighbour without increasing movement speed", () => {
    const next = spacedMobDesired("a", start, { x: .1, z: 0 }, [{ id: "b", x: .5, y: 1, z: 0 }]);
    expect(next.x).toBeLessThanOrEqual(0);
    expect(Math.hypot(next.x, next.z)).toBeLessThanOrEqual(.1);
  });
  it("splits exact overlaps deterministically and ignores other floors", () => {
    expect(spacedMobDesired("a", start, { x: 0, z: .1 }, [{ id: "b", ...start }]).x).toBeLessThan(0);
    expect(spacedMobDesired("b", start, { x: 0, z: .1 }, [{ id: "a", ...start }]).x).toBeGreaterThan(0);
    expect(spacedMobDesired("a", start, { x: .1, z: 0 }, [{ id: "b", ...start, y: 3 }])).toEqual({ x: .1, z: 0 });
  });
});
