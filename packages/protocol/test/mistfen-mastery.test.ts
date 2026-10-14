import { describe, expect, it } from "vitest";
import { mistfenMasteryRank, mistfenMasteryStatus } from "../src/index.js";

describe("Mistfen regional mastery", () => {
  it("stays hidden until discovered and advances through all three ranks", () => {
    expect(mistfenMasteryRank(150, false)).toBe(0);
    expect(mistfenMasteryRank(5, true)).toBe(1);
    expect(mistfenMasteryRank(40, true)).toBe(2);
    expect(mistfenMasteryRank(100, true)).toBe(3);
  });

  it("reports progress toward the next regional reward", () => {
    const status = mistfenMasteryStatus(22, true);
    expect(status.name).toBe("PATHFINDER");
    expect(status.nextThreshold).toBe(40);
    expect(status.progress).toBeCloseTo(17 / 35);
    expect(status.reward).toBe("Bonus marsh materials");
  });
});
