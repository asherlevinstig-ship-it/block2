import { describe, expect, it } from "vitest";
import { DODGE_CHAIN_WINDOW_MS, dodgeChainStaminaCost, nextDodgeChain } from "../src/dodge-pressure.js";

describe("dodge pressure", () => {
  it("ramps consecutive dodge costs and caps the penalty", () => {
    expect(dodgeChainStaminaCost(0)).toBe(35);
    expect(dodgeChainStaminaCost(1)).toBe(45);
    expect(dodgeChainStaminaCost(2)).toBe(55);
    expect(dodgeChainStaminaCost(20)).toBe(55);
  });

  it("resets the chain after a deliberate pause", () => {
    expect(nextDodgeChain(0, 1_000, 1_350)).toBe(1);
    expect(nextDodgeChain(1, 1_000, 1_000 + DODGE_CHAIN_WINDOW_MS + 1)).toBe(0);
  });
});
