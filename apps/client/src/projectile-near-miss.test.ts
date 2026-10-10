import { describe, expect, it } from "vitest";
import { projectileNearMiss } from "./projectile-near-miss.js";
const player = { x: 0, y: 8, z: 0 };
const shot = (x: number, z: number, y = 9.05) => ({ x, y, z });
describe("projectile near-miss presentation", () => {
  it("detects a close shot only once it passes and starts moving away", () => {
    expect(projectileNearMiss(shot(1, -.5), shot(1, -.1), player)).toBeNull();
    expect(projectileNearMiss(shot(1, -.1), shot(1, .2), player)).toEqual(shot(1, 0));
  });
  it("excludes body contact, distant shots and another floor", () => {
    for (const x of [0, .38, .6, .77, 1.5, 4])
      expect(projectileNearMiss(shot(x, -.1), shot(x, .2), player)).toBeNull();
    expect(projectileNearMiss(shot(1, -.1, 3), shot(1, .2, 3), player)).toBeNull();
  });
  it("does not replay cues on a stalled frame, delayed packet or stationary projectile", () => {
    expect(projectileNearMiss(shot(1, -4), shot(1, 4), player)).toBeNull();
    expect(projectileNearMiss(shot(1, 0), shot(1, 0), player)).toBeNull();
  });
});
