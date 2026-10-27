import { describe, expect, it } from "vitest";
import { thornBindingDeadline } from "./thorn-binding.js";

describe("thorn binding movement deadline", () => {
  it("uses the synchronized server clock and caps a root at 3.5 seconds", () => {
    expect(thornBindingDeadline(103_500, 100_000, 500, 0, false)).toBe(4_000);
    expect(thornBindingDeadline(1_000_000, 100_000, 500, 0, false)).toBe(4_000);
  });
  it("does not restart the lock when damaged, but accepts an authoritative reapplication", () => {
    expect(thornBindingDeadline(104_500, 101_000, 1_500, 4_000, true)).toBe(4_000);
    expect(thornBindingDeadline(110_000, 106_000, 6_500, 4_000, true)).toBe(4_000);
    expect(thornBindingDeadline(104_500, 101_000, 1_500, 4_000, false)).toBe(5_000);
  });
  it("cannot permanently lock movement with a missing or invalid expiry", () => {
    expect(thornBindingDeadline(Number.NaN, 100_000, 500, 0, false)).toBe(0);
    expect(thornBindingDeadline(Infinity, 100_000, 500, 0, false)).toBe(0);
    expect(thornBindingDeadline(99_000, 100_000, 500, 0, false)).toBe(500);
  });
});
