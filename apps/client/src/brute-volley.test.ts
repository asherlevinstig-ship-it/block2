import { describe, expect, it } from "vitest";
import { BRUTE_VOLLEY, bruteRockEndpoints, bruteRockLanes, bruteVolleyReady } from "@blockcraft/protocol";
describe("brute rock volley geometry", () => {
  it("uses three separate lanes with gaps wide enough for a player", () => {
    const shots = bruteRockEndpoints({ x: 0, y: 8, z: 0 }, 0);
    expect(shots).toHaveLength(3); expect(shots[1]!.x).toBe(0);
    expect(shots[0]!.x).toBeCloseTo(-shots[2]!.x);
    const gapAt4m = Math.sin(26 * Math.PI / 180) * 4 - BRUTE_VOLLEY.laneHalfWidth * 2;
    expect(gapAt4m).toBeGreaterThan(.76);
    const lanes = bruteRockLanes(0, [2, 3, 4]);
    expect(lanes).toHaveLength(3);
    expect(lanes[1]![2]!.z).toBe(3);
  });
  it("avoids point-blank volleys and retains melee turns", () => {
    expect(bruteVolleyReady(0, 6)).toBe(true);
    expect(bruteVolleyReady(0, 2)).toBe(false);
    expect(bruteVolleyReady(1, 6)).toBe(false);
    expect(bruteVolleyReady(0, 10)).toBe(false);
  });
});
