import { describe, expect, it } from "vitest";
import { heldFireStep } from "./held-fire.js";
describe("ranged hold to fire", () => {
  it("waits until the weapon's recovery is finished", () => {
    expect(heldFireStep(true, true, 1559, 1560)).toEqual({ held: true, fire: false });
    expect(heldFireStep(true, true, 1560, 1560)).toEqual({ held: true, fire: true });
  });
  it("cancels when a menu, mode, focus or combat action blocks firing", () => {
    const cancelled = heldFireStep(true, false, 2000, 1560);
    expect(cancelled).toEqual({ held: false, fire: false });
    expect(heldFireStep(cancelled.held, true, 2100, 1560).fire).toBe(false);
  });
  it("does not fire after release and never returns catch-up shot batches", () => {
    expect(heldFireStep(false, true, 10000, 1560).fire).toBe(false);
    expect(heldFireStep(true, true, 10000, 1560)).toEqual({ held: true, fire: true });
  });
});
