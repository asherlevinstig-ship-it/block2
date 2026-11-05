import { describe, expect, it } from "vitest";
import { townSoundSpatial } from "./town-ambience.js";

describe("Town positional ambience", () => {
  it("is loudest at its source and silent outside its radius", () => {
    expect(townSoundSpatial({ x: 10, z: 10 }, { x: 10, z: 10 }, 20).gain).toBe(1);
    expect(townSoundSpatial({ x: 30, z: 10 }, { x: 10, z: 10 }, 20).gain).toBe(0);
    expect(townSoundSpatial({ x: 20, z: 10 }, { x: 10, z: 10 }, 20).gain).toBeCloseTo(.25);
  });

  it("pans sources toward their side of the listener", () => {
    expect(townSoundSpatial({ x: 0, z: 0 }, { x: 8, z: 0 }, 20).pan).toBeGreaterThan(0);
    expect(townSoundSpatial({ x: 0, z: 0 }, { x: -8, z: 0 }, 20).pan).toBeLessThan(0);
    expect(townSoundSpatial({ x: 0, z: 0 }, { x: 0, z: 8 }, 20).pan).toBe(0);
  });
});
