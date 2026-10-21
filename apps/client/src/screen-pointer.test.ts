import { describe, expect, it } from "vitest";
import { canvasScreenPoint } from "./screen-pointer.js";

describe("canvas pointer coordinates", () => {
  it("uses CSS pixels so picking stays beneath the cursor on a scaled backing buffer", () => {
    const bounds = { left: 100, top: 50, width: 1200, height: 700 };
    expect(canvasScreenPoint(700, 400, bounds)).toEqual({ x: 600, y: 350 });
  });

  it("keeps a pointer at the canvas edge inside the camera viewport", () => {
    const bounds = { left: 20, top: 30, width: 800, height: 450 };
    expect(canvasScreenPoint(10, 500, bounds)).toEqual({ x: 0, y: 450 });
  });
});
