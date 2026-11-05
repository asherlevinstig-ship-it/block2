import { describe, expect, it } from "vitest";
import { worldPromptCssPoint, worldPromptProjectionVisible } from "./world-prompt-placement.js";

describe("world prompt placement", () => {
  it("uses PlayCanvas CSS-pixel projection without applying render-resolution scaling again", () => {
    const point = worldPromptCssPoint({ x: 690, y: 318 }, { left: 0, top: 32 }, 12);
    expect(point).toEqual({ x: 690, y: 338 });
    // A 944px backing buffer rendered into an 1180px client rect used to turn
    // x=690 into x=862.5, visibly detaching the prompt from its actor.
    expect(point.x).not.toBe(690 * 1180 / 944);
  });

  it("clips against the CSS viewport returned by the graphics device", () => {
    const rect = { left: 0, top: 32, width: 1180, height: 788 };
    expect(worldPromptProjectionVisible({ x: 690, y: 318, z: .8 }, rect)).toBe(true);
    expect(worldPromptProjectionVisible({ x: 1181, y: 318, z: .8 }, rect)).toBe(false);
    expect(worldPromptProjectionVisible({ x: 690, y: 318, z: -.1 }, rect)).toBe(false);
  });
});
