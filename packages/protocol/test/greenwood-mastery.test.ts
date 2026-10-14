import { describe, expect, it } from "vitest";
import { greenwoodMasteryRank, greenwoodMasteryStatus } from "../src/index.js";

describe("Greenwood regional mastery", () => {
  it("unlocks three activity ranks after discovery", () => {
    expect(greenwoodMasteryRank(150, false)).toBe(0);
    expect(greenwoodMasteryRank(5, true)).toBe(1);
    expect(greenwoodMasteryRank(40, true)).toBe(2);
    expect(greenwoodMasteryRank(100, true)).toBe(3);
  });
  it("tracks progress toward Packbreaker", () => {
    expect(greenwoodMasteryStatus(22, true)).toMatchObject({ name: "TRAILFINDER", nextThreshold: 40, reward: "Elite crawler packs and improved materials" });
  });
});
