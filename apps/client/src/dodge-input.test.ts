import { describe, expect, it } from "vitest";
import { canRequestPredictedDodge, DODGE_REQUEST_INTERVAL_MS } from "./dodge-input.js";

describe("dodge input prediction", () => {
  it("blocks rapid repeat predictions until the server dodge interval has elapsed", () => {
    expect(DODGE_REQUEST_INTERVAL_MS).toBe(350);
    expect(canRequestPredictedDodge(1_000, Number.NEGATIVE_INFINITY)).toBe(true);
    expect(canRequestPredictedDodge(1_349, 1_000)).toBe(false);
    expect(canRequestPredictedDodge(1_350, 1_000)).toBe(true);
  });
});
