import { describe, expect, it } from "vitest";
import {
  RAPID_PRACTICE_ARENA,
  RAPID_PRACTICE_SPAWNS,
  rapidPracticeMovementSpeed,
  rapidPracticeProjectileTravelMs,
} from "./rapid-practice.js";

describe("rapid 2.5D practice", () => {
  it("provides a dense but bounded combat wave", () => {
    expect(RAPID_PRACTICE_SPAWNS).toHaveLength(18);
    expect(new Set(RAPID_PRACTICE_SPAWNS.map(spawn => spawn.id)).size).toBe(18);
    for (const spawn of RAPID_PRACTICE_SPAWNS) {
      expect(spawn.x).toBeGreaterThan(RAPID_PRACTICE_ARENA.minX);
      expect(spawn.x).toBeLessThan(RAPID_PRACTICE_ARENA.maxX);
      expect(spawn.z).toBeGreaterThan(RAPID_PRACTICE_ARENA.minZ);
      expect(spawn.z).toBeLessThan(RAPID_PRACTICE_ARENA.maxZ);
    }
  });

  it("speeds up play only inside the prototype", () => {
    expect(rapidPracticeMovementSpeed(4.2, false)).toBe(4.2);
    expect(rapidPracticeMovementSpeed(4.2, true)).toBeCloseTo(5.796);
    expect(rapidPracticeProjectileTravelMs(900, false)).toBe(900);
    expect(rapidPracticeProjectileTravelMs(900, true)).toBe(612);
    expect(rapidPracticeProjectileTravelMs(200, true)).toBe(180);
  });
});
