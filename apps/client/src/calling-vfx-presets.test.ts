import { describe, expect, it } from "vitest";
import { BUILD_PATHS, CALLING_ABILITY_OPTIONS, type BuildPathId } from "@blockcraft/protocol";
import { CALLING_ABILITY_SUSTAIN_PARTICLES, CALLING_ANTICIPATION_PARTICLES, CALLING_CAST_PARTICLES, CALLING_IMPACT_PARTICLES, CALLING_SUSTAIN_PARTICLES, callingParticleLifetime } from "./calling-vfx-presets.js";

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
      expect(CALLING_CAST_PARTICLES[path].length).toBeGreaterThan(0);
      expect(CALLING_CAST_PARTICLES[path].every(layer => layer.texture !== undefined)).toBe(true);
      expect(CALLING_SUSTAIN_PARTICLES[path].length).toBeGreaterThan(0);
    }
  });

  it("gives every non-Mage role a character-bound authored casting flourish", () => {
    for (const path of ["tank", "assassin", "thief", "ranger", "healer"] as const) {
      expect(CALLING_CAST_PARTICLES[path].reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(28);
      expect(new Set(CALLING_CAST_PARTICLES[path].map(layer => layer.texture)).size).toBeGreaterThanOrEqual(2);
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

  it("gives every Mage ability a distinct high-energy signature", () => {
    expect(CALLING_IMPACT_PARTICLES.mage_arcane_surge.reduce((sum, entry) => sum + entry.count, 0)).toBeGreaterThanOrEqual(120);
    expect(CALLING_IMPACT_PARTICLES.mage_mana_shield.some(layer => layer.color[2] === 1)).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.mage_overload.filter(layer => layer.kind === "streak" || layer.kind === "spark")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(80);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.mage_mana_shield?.length).toBeGreaterThanOrEqual(2);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.mage_overload?.some(layer => layer.kind === "streak")).toBe(true);
    expect(new Set(CALLING_IMPACT_PARTICLES.mage_arcane_surge.map(layer => layer.texture)))
      .toEqual(new Set(["rune", "streak", "orb"]));
    expect(CALLING_IMPACT_PARTICLES.mage_mana_shield.some(layer => layer.texture === "orb")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.mage_overload.some(layer => layer.texture === "lightning")).toBe(true);
  });

  it("separates Tank bracing, provocation, and terrain-breaking impacts", () => {
    expect(CALLING_IMPACT_PARTICLES.tank_bulwark.some(layer => layer.kind === "glow")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.tank_challenge.some(layer => layer.kind === "streak")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.tank_earthbreaker.filter(layer => layer.kind === "dust" || layer.kind === "smoke")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(90);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.tank_bulwark?.some(layer => layer.kind === "glow")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.tank_challenge?.some(layer => layer.kind === "dust")).toBe(true);
  });

  it("gives Assassin abilities distinct concealment, execution, and flurry signatures", () => {
    expect(CALLING_IMPACT_PARTICLES.assassin_vanish.some(layer => layer.kind === "smoke")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.assassin_death_mark.some(layer => layer.kind === "glow" && layer.color[0] === 1)).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.assassin_blade_dance.reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(90);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.assassin_vanish?.some(layer => layer.kind === "smoke")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.assassin_blade_dance?.some(layer => layer.kind === "streak")).toBe(true);
  });

  it("separates Thief concealment, deception, and escape signatures", () => {
    expect(CALLING_IMPACT_PARTICLES.thief_smoke_bomb.filter(layer => layer.kind === "smoke")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(70);
    expect(CALLING_IMPACT_PARTICLES.thief_decoy.some(layer => layer.kind === "glow")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.thief_decoy.some(layer => layer.kind === "streak")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.thief_escape_artist.filter(layer => layer.kind === "streak" || layer.kind === "spark")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(80);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.thief_decoy?.length).toBeGreaterThanOrEqual(3);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.thief_escape_artist?.some(layer => layer.kind === "streak")).toBe(true);
  });

  it("separates Ranger volleys, retreat movement, and precision aiming", () => {
    expect(CALLING_IMPACT_PARTICLES.ranger_volley_focus.filter(layer => layer.kind === "streak")
      .reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(40);
    expect(CALLING_IMPACT_PARTICLES.ranger_disengage.some(layer => layer.kind === "dust")).toBe(true);
    expect(CALLING_IMPACT_PARTICLES.ranger_deadeye.some(layer => layer.kind === "glow")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.ranger_volley_focus?.some(layer => layer.kind === "streak")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.ranger_disengage?.some(layer => layer.kind === "dust")).toBe(true);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.ranger_deadeye?.length).toBeGreaterThanOrEqual(2);
  });

  it("separates focused healing, area renewal, and resurrection", () => {
    expect(CALLING_IMPACT_PARTICLES.healer_field_mend.some(layer => layer.kind === "streak")).toBe(true);
    expect(Math.max(...CALLING_IMPACT_PARTICLES.healer_renewal.map(layer => layer.radius))).toBeGreaterThanOrEqual(2);
    expect(CALLING_IMPACT_PARTICLES.healer_resurrection.reduce((sum, layer) => sum + layer.count, 0)).toBeGreaterThanOrEqual(130);
    expect(CALLING_ABILITY_SUSTAIN_PARTICLES.healer_resurrection?.some(layer => layer.color[1] === 1)).toBe(true);
  });
});
