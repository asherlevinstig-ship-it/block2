import { describe, expect, it } from "vitest";
import { FLOOR_TWO_OBJECTIVE_LIGHTS, FLOOR_TWO_WALL_SCONCES } from "./tower-floor-two-lighting.js";

describe("Floor 2 authored lighting", () => {
  it("marks the full critical route with wall sconces without excessive real-time lights", () => {
    expect(FLOOR_TWO_WALL_SCONCES).toHaveLength(14);
    expect(new Set(FLOOR_TWO_WALL_SCONCES.map(torch => torch.id)).size).toBe(FLOOR_TWO_WALL_SCONCES.length);
    expect(FLOOR_TWO_WALL_SCONCES.filter(torch => torch.castsLight).length).toBeLessThanOrEqual(8);
    for (const area of ["entry", "intake", "furnace", "quench", "crucible", "boss"])
      expect(FLOOR_TWO_WALL_SCONCES.some(torch => torch.id.startsWith(area))).toBe(true);
  });

  it("gives each major objective a distinct pool of light", () => {
    expect(FLOOR_TWO_OBJECTIVE_LIGHTS.map(light => light.id))
      .toEqual(["entry", "hub", "furnace", "quench", "crucible", "boss"]);
    expect(FLOOR_TWO_OBJECTIVE_LIGHTS.every(light => light.range >= 18)).toBe(true);
  });
});
