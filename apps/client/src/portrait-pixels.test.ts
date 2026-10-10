import { describe, expect, it } from "vitest";
import { flipPortraitRows } from "./portrait-pixels.js";
describe("inventory portrait capture", () => {
  it("flips rows without reversing pixels or colour channels", () => {
    const source = new Uint8Array(Array.from({ length: 16 }, (_, i) => i));
    const result = new Uint8ClampedArray(16);
    flipPortraitRows(source, result, 2, 2);
    expect([...result]).toEqual([8,9,10,11,12,13,14,15,0,1,2,3,4,5,6,7]);
    expect(source[0]).toBe(0);
  });
  it("preserves a single row", () => {
    const result = new Uint8ClampedArray(4);
    flipPortraitRows(new Uint8Array([10,20,30,255]), result, 1, 1);
    expect([...result]).toEqual([10,20,30,255]);
  });
});
