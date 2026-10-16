import { describe, expect, it } from "vitest";
import { compensatedActionAt } from "./combat-lag.js";

describe("combat action timing", () => {
  it("accepts a recent server-clock action time", () => {
    expect(compensatedActionAt(10_000, 9_940)).toBe(9_940);
  });

  it("caps old or forged times and ignores future times", () => {
    expect(compensatedActionAt(10_000, 1)).toBe(9_900);
    expect(compensatedActionAt(10_000, 10_100)).toBe(10_000);
  });

  it("preserves legacy clients without a synchronized clock", () => {
    expect(compensatedActionAt(10_000, undefined)).toBe(10_000);
  });
});
