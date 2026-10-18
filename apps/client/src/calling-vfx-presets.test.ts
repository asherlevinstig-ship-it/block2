import { describe, expect, it } from "vitest";
import { BUILD_PATHS, CALLING_ABILITY_OPTIONS, type BuildPathId } from "@blockcraft/protocol";
import { CALLING_ABILITY_SUSTAIN_PARTICLES, CALLING_ANTICIPATION_PARTICLES, CALLING_IMPACT_PARTICLES, CALLING_SUSTAIN_PARTICLES, callingParticleLifetime } from "./calling-vfx-presets.js";

describe("calling particle identity and budget", () => {
  it("covers every ability and build phase with bounded layers", () => {
    for (const { id } of CALLING_ABILITY_OPTIONS) {
      const layers = CALLING_IMPACT_PARTICLES[id];
      expect(layers.length).toBeGreaterThan(0);
      expect(layers.reduce((sum, entry) => sum + entry.count, 0)).toBeLessThanOrEqual(140);
      expect(callingParticleLifetime(layers)).toBeLessThan(4);
      for (const entry of layers) {
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.life).toBeGreaterThan(0);
        expect(entry.opacity).toBeGreaterThan(0);
        expect(entry.opacity).toBeLessThanOrEqual(1);
      }
    }
    for (const path of Object.keys(BUILD_PATHS) as BuildPathId[]) {
      expect(CALLING_ANTICIPATION_PARTICLES[path].length).toBeGreaterThan(0);
      expect(CALLING_SUSTAIN_PARTICLES[path].length).toBeGreaterThan(0);
    }
  });

  it("uses smoke for concealment, debris for earth, and light for healing", () => {
    expect(CALLING_IMPACT_PARTICLES.thief_smoke_bomb.some(layer => layer.kind === "smoke")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.assassin_vanish.some(layer => layer.kind === "smoke")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.tank_earthbreaker.some(layer => layer.kind === "dust")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.healer_resurrection.some(layer => layer.kind === "glow")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.thief_smoke_bomb?.filter(layer => layer.kind === "smoke")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(80);
  });
});
