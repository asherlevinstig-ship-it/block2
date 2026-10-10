import { describe, expect, it } from "vitest";
import { heldFireStep } from "./held-fire.js";
import { WEAPON_ATTACK_DEFINITIONS } from "@blockcraft/protocol";
describe("ranged hold to fire", () => {
  it.each(["bow", "acid_gland_focus", "venom_focus"] as const)("keeps %s firing on local cadence without waiting for delayed hit confirmation", weapon => {
    const duration = WEAPON_ATTACK_DEFINITIONS[weapon].attacks[0].durationMs;
    for (const rtt of [150, 300, 600]) {
      let readyAt = 0;
      const shots: number[] = [], confirmations: number[] = [];
      for (let now = 0; now < 3000; now += 16) {
        // Delayed confirmations do not alter readyAt or emit catch-up shot batches.
        while (confirmations.length && confirmations[0]! <= now) confirmations.shift();
        if (!heldFireStep(true, true, now, readyAt).fire) continue;
        shots.push(now); confirmations.push(now + rtt);
        readyAt = now + duration;
      }
      expect(shots.length).toBeGreaterThanOrEqual(5);
      for (let index = 1; index < shots.length; index++) {
        expect(shots[index]! - shots[index - 1]!).toBeGreaterThanOrEqual(duration);
        expect(shots[index]! - shots[index - 1]!).toBeLessThan(duration + 16);
      }
    }
  });
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
