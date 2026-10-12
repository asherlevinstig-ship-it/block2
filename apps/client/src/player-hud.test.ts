import { describe, expect, it } from "vitest";
import { hudFraction } from "./player-hud.js";

describe("reactive player HUD", () => {
  it("clamps network values to a safe bar width", () => {
    expect(hudFraction(5, 5)).toBe(1);
    expect(hudFraction(25, 100)).toBe(.25);
    expect(hudFraction(-2, 5)).toBe(0);
    expect(hudFraction(8, 5)).toBe(1);
  });

  it("handles a missing or zero maximum without producing an invalid width", () => {
    expect(hudFraction(0, 0)).toBe(0);
    expect(hudFraction(1, 0)).toBe(1);
  });
});
