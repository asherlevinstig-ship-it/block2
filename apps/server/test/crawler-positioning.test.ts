import { describe, expect, it } from "vitest";
import { circleCrawler, createCrawlerPositioning } from "../src/crawler-positioning.js";
const target = { x: 0, y: 1, z: 0 };
describe("crawler circling", () => {
  it("alternates nearby allies' flanks even when their ID hashes would pick the same side", () => {
    const peers = ["a", "c"];
    const a = createCrawlerPositioning("a", "p", peers);
    const c = createCrawlerPositioning("c", "p", [...peers].reverse());
    expect(a.direction).toBe(-c.direction);
    expect(createCrawlerPositioning("a", "p", peers).direction).toBe(a.direction);
  });
  it("approaches normally until close enough, then circles for only 600ms", () => {
    const state = createCrawlerPositioning("a", "player");
    expect(circleCrawler({ x: 6, y: 1, z: 0 }, target, state, 0, .033, 1.35, 2.1)).toBeNull();
    const mob = { x: 2.3, y: 1, z: 0 };
    const first = circleCrawler(mob, target, state, 100, .033, 1.35, 2.1)!;
    expect(Math.abs(first.z)).toBeGreaterThan(0);
    expect(first.x).toBeCloseTo(mob.x);
    expect(first.inAttackRange).toBe(false);
    expect(circleCrawler(mob, target, state, 699, .033, 1.35, 2.1)).not.toBeNull();
    expect(circleCrawler(mob, target, state, 700, .033, 1.35, 2.1)).toBeNull();
  });
  it("does not restart circling if blocked or the player moves away", () => {
    const state = createCrawlerPositioning("a", "player");
    circleCrawler({ x: 2.3, y: 1, z: 0 }, target, state, 0, .033, 1.35, 2.1);
    expect(circleCrawler({ x: 5, y: 1, z: 0 }, target, state, 700, .033, 1.35, 2.1)).toBeNull();
    expect(circleCrawler({ x: 2, y: 1, z: 0 }, target, state, 800, .033, 1.35, 2.1)).toBeNull();
  });
  it("does not delay a point-blank attack", () => {
    expect(circleCrawler({ x: 1.5, y: 1, z: 0 }, target, createCrawlerPositioning("a", "p"), 0, .033, 1.35, 2.1)).toBeNull();
  });
  it("uses opposite stable flank directions and respects movement speed", () => {
    const mob = { x: 2.3, y: 1, z: 0 };
    const a = circleCrawler(mob, target, createCrawlerPositioning("a", "p"), 0, .033, 1.35, 2.1)!;
    const b = circleCrawler(mob, target, createCrawlerPositioning("b", "p"), 0, .033, 1.35, 2.1)!;
    expect(a.z * b.z).toBeLessThan(0);
    expect(Math.hypot(a.x - mob.x, a.z - mob.z)).toBeCloseTo(.033 * 1.35);
  });
});
