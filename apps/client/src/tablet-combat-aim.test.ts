import { describe, expect, it } from "vitest";
import { tabletDragAimYaw, tabletSoftTarget } from "./tablet-combat-aim.js";

describe("tablet combat aim", () => {
  const player = { x: 0, z: 0 };

  it("selects a visible target inside the forward cone", () => {
    const target = tabletSoftTarget(player, 0, 8, [
      { id: "front", x: 1, z: 4, visible: true },
      { id: "behind", x: 0, z: -2, visible: true },
    ]);
    expect(target?.id).toBe("front");
  });

  it("never selects enemies behind walls or outside the cone", () => {
    expect(tabletSoftTarget(player, 0, 8, [
      { id: "blocked", x: 0, z: 3, visible: false },
      { id: "side", x: 4, z: 0, visible: true },
    ])).toBeNull();
  });

  it("prefers directional intent over a closer edge target", () => {
    const target = tabletSoftTarget(player, 0, 8, [
      { id: "centred", x: 0, z: 5, visible: true },
      { id: "edge", x: 2, z: 2, visible: true },
    ]);
    expect(target?.id).toBe("centred");
  });

  it("maps upward and rightward drags relative to the camera", () => {
    expect(tabletDragAimYaw(0, -40, 0, 10, 17)).toBeCloseTo(180);
    expect(tabletDragAimYaw(40, 0, 0, 10, 17)).toBeCloseTo(90);
    expect(tabletDragAimYaw(3, 2, 0, 10, 17)).toBe(17);
  });
});
