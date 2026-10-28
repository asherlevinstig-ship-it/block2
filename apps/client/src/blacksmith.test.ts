import { describe, expect, it } from "vitest";
import { canTradeAtBlacksmithStall } from "./blacksmith.js";

describe("blacksmith stall interaction", () => {
  it("uses the new town smith only in Fast World, including when legacy dressing is hidden", () => {
    expect(canTradeAtBlacksmithStall({ x: 79, y: 8, z: 137 }, false, true)).toBe(true);
    expect(canTradeAtBlacksmithStall({ x: 79, y: 8, z: 137 }, true)).toBe(false);
    expect(canTradeAtBlacksmithStall({ x: 22.5, y: 8, z: 4.3 }, true, true)).toBe(false);
    expect(canTradeAtBlacksmithStall({ x: 79, y: 4, z: 137 }, false, true)).toBe(false);
  });
  it("opens from the customer side but not from town centre or underground", () => {
    expect(canTradeAtBlacksmithStall({ x: 22.5, y: 8, z: 4.3 }, true)).toBe(true);
    expect(canTradeAtBlacksmithStall({ x: 8.5, y: 8, z: 8.5 }, true)).toBe(false);
    expect(canTradeAtBlacksmithStall({ x: 22.5, y: 4, z: 2.5 }, true)).toBe(false);
    expect(canTradeAtBlacksmithStall({ x: 22.5, y: 8, z: 4.3 }, false)).toBe(false);
  });
});
