import { describe, expect, it } from "vitest";
import { canStartHighLow, drawTavernCard, highLowPayout, highLowResult } from "./tavern-high-low.js";

describe("tavern higher or lower", () => {
  it("draws all ranks and suits within the deck", () => {
    expect(drawTavernCard(() => 0)).toEqual({ rank: 2, suit: "hearts" });
    expect(drawTavernCard(() => .999)).toEqual({ rank: 14, suit: "spades" });
  });

  it("resolves higher, lower and equal cards", () => {
    const seven = { rank: 7, suit: "hearts" as const };
    expect(highLowResult(seven, { rank: 9, suit: "clubs" }, "higher")).toBe("correct");
    expect(highLowResult(seven, { rank: 4, suit: "clubs" }, "higher")).toBe("wrong");
    expect(highLowResult(seven, { rank: 7, suit: "spades" }, "lower")).toBe("push");
  });

  it("doubles winnings with a cap and requires table proximity", () => {
    expect(highLowPayout(5, 3)).toBe(40);
    expect(highLowPayout(10, 10)).toBe(640);
    expect(canStartHighLow({ x: 5.6, y: 9, z: 5.5 }, 10, 5)).toBe(true);
    expect(canStartHighLow({ x: 5.6, y: 9, z: 5.5 }, 10, 2)).toBe(false);
    expect(canStartHighLow({ x: 0, y: 9, z: 0 }, 10, 5)).toBe(false);
  });
});
