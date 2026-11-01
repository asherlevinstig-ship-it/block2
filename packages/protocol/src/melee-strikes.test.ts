import { describe, expect, it } from "vitest";
import { playerMeleeStrike } from "./melee-strikes.js";

describe("Twin Fang melee identity", () => {
  it("alternates its opening cuts and turns the finisher into a longer narrow execution", () => {
    const first = playerMeleeStrike("fang_dagger", 1)!;
    const second = playerMeleeStrike("fang_dagger", 2)!;
    const finisher = playerMeleeStrike("fang_dagger", 3)!;
    expect(first.startAngle).toBeGreaterThan(0);
    expect(second.startAngle).toBeLessThan(0);
    expect(finisher.reach).toBeGreaterThan(first.reach + .3);
    expect(Math.abs(finisher.startAngle - finisher.endAngle)).toBeLessThan(30);
    expect(finisher.startHeight - finisher.endHeight).toBeLessThan(.25);
  });
});
