import type { BuildPathId, CallingAbilityId } from "@blockcraft/protocol";

export type ParticleKind = "smoke" | "dust" | "glow" | "spark" | "streak";
export type ParticleTexture = "smoke" | "debris" | "orb" | "rune" | "lightning" | "streak";
export type ParticleColor = readonly [number, number, number];
export type ParticleLayer = {
  kind: ParticleKind;
  color: ParticleColor;
  count: number;
  life: number;
  size: number;
  radius: number;
  speed: number;
  rise: number;
  opacity: number;
  offsetY?: number;
  forward?: boolean;
  /** Optional authored sprite. The particle kind still owns motion and blending. */
  texture?: ParticleTexture;
};

const layer = (kind: ParticleKind, color: ParticleColor, count: number, life: number,
  size: number, radius: number, speed: number, rise: number, opacity: number,
  offsetY = 0, forward = false, texture?: ParticleTexture): ParticleLayer =>
  ({ kind, color, count, life, size, radius, speed, rise, opacity, offsetY, forward, texture });

const steel: ParticleColor = [.4, .8, 1];
const silver: ParticleColor = [.86, .94, 1];
const amber: ParticleColor = [1, .68, .24];
const earth: ParticleColor = [.54, .39, .25];
const violet: ParticleColor = [.61, .36, 1];
const azure: ParticleColor = [.34, .65, 1];
const magenta: ParticleColor = [1, .31, .8];
const shadow: ParticleColor = [.26, .18, .37];
const crimson: ParticleColor = [1, .17, .25];
const paleBlade: ParticleColor = [1, .84, .88];
const smoke: ParticleColor = [.37, .42, .42];
const green: ParticleColor = [.33, .87, .5];
const teal: ParticleColor = [.25, .9, .78];
const lime: ParticleColor = [.76, 1, .35];
const gold: ParticleColor = [1, .78, .28];
const mint: ParticleColor = [.37, 1, .78];
const warmWhite: ParticleColor = [1, .97, .75];

/** A small, bounded particle budget for each real ability impact. */
export const CALLING_IMPACT_PARTICLES: Record<CallingAbilityId, readonly ParticleLayer[]> = {
  tank_bulwark: [
    layer("spark", steel, 32, .82, .18, .92, 1.65, 1.05, .86, .8),
    layer("glow", silver, 20, 1.12, .4, .84, .72, .62, .56, .86),
    layer("streak", [.42, .72, 1], 12, .58, .22, .72, 2.3, .5, .78, .72),
  ],
  tank_challenge: [
    layer("dust", earth, 36, 1.18, .58, 1.5, 2.4, .34, .44, .08),
    layer("spark", amber, 32, .78, .18, 1.42, 2.9, 1.28, .9, .72),
    layer("streak", silver, 16, .62, .24, 1.18, 2.35, .65, .76, .62),
  ],
  tank_earthbreaker: [
    layer("dust", earth, 68, 1.72, .88, 2.15, 3.45, .9, .66, .06),
    layer("spark", amber, 36, .88, .18, 1.36, 4.25, 2.5, .94, .08),
    layer("smoke", [.42, .39, .34], 24, 1.92, .98, 2.55, 1.42, .52, .4, .16),
  ],
  mage_arcane_surge: [
    layer("glow", violet, 64, 1.28, .5, 1.95, 3.25, 1.22, .9, .22, false, "rune"),
    layer("streak", [.84, .72, 1], 38, .72, .4, 1.2, 4.45, 2, .9, .44, false, "streak"),
    layer("spark", silver, 22, .54, .12, 1.55, 5, 1.5, .94, .2, false, "orb"),
  ],
  mage_mana_shield: [
    layer("glow", azure, 46, 1.42, .52, 1.12, 1.42, .86, .76, .7, false, "orb"),
    layer("spark", silver, 30, .96, .14, 1.16, 2.25, 1.18, .88, .84, false, "rune"),
  ],
  mage_overload: [
    layer("streak", magenta, 62, 1.1, .48, 1.14, 4.2, 1.55, .96, .5, false, "lightning"),
    layer("glow", violet, 38, 1.44, .5, .8, 1.3, 1.26, .8, .84, false, "orb"),
    layer("spark", silver, 24, .65, .11, .98, 3.65, 1.6, .9, .74, false, "rune"),
  ],
  assassin_vanish: [
    layer("smoke", shadow, 54, 1.55, .74, .78, 1.45, 1.05, .62, .68),
    layer("streak", violet, 20, .62, .27, .58, 3.1, .5, .62, .88),
    layer("spark", [.48, .7, 1], 14, .48, .1, .46, 2.6, .72, .78, .7),
  ],
  assassin_death_mark: [
    layer("glow", crimson, 32, 1.18, .31, .54, .92, .9, .86, 1.12),
    layer("streak", paleBlade, 18, .7, .36, .42, 2.35, 1.28, .82, 1.08),
    layer("spark", [1, .16, .24], 12, .52, .1, .48, 2.8, 1.05, .84, .72),
  ],
  assassin_blade_dance: [
    layer("streak", paleBlade, 58, .78, .44, 1.08, 4.5, .48, .9, .82),
    layer("spark", crimson, 30, .9, .17, .82, 3.35, 1.5, .84, .76),
    layer("glow", violet, 12, .66, .22, .72, 1.4, .72, .72, .68),
  ],
  thief_smoke_bomb: [
    layer("smoke", smoke, 74, 2.2, 1.1, 1.45, 1.35, .8, .72, .35),
    layer("dust", [.26, .33, .3], 26, 1.5, .62, 1.2, 1.8, .35, .4, .08),
    layer("glow", green, 12, 1, .24, .8, 1.2, .7, .38, .5),
  ],
  thief_decoy: [
    layer("smoke", [.29, .43, .34], 34, 1.75, .6, .62, .82, .35, .58, .82),
    layer("glow", green, 32, 1.65, .3, .42, .58, .82, .62, 1.08),
    layer("streak", lime, 20, .76, .24, .48, 1.55, .72, .7, .88),
  ],
  thief_escape_artist: [
    layer("streak", lime, 58, .72, .46, .62, 5.2, .58, .82, .78, true),
    layer("spark", warmWhite, 24, .62, .12, .8, 2.8, .9, .64, .74),
    layer("dust", smoke, 20, 1, .5, .7, 2.2, .3, .35, .08),
  ],
  ranger_volley_focus: [
    layer("streak", gold, 46, .88, .4, .5, 3.8, .42, .86, .94, true),
    layer("glow", warmWhite, 24, 1.05, .3, .5, .8, .72, .56, 1),
    layer("spark", teal, 14, .62, .1, .55, 1.6, .52, .46, .82),
  ],
  ranger_disengage: [
    layer("streak", teal, 58, .82, .42, .72, 5.1, .56, .86, .78, true),
    layer("dust", smoke, 32, 1.2, .58, .95, 2.5, .35, .48, .1),
    layer("spark", gold, 14, .58, .1, .65, 1.7, .48, .5, .8),
  ],
  ranger_deadeye: [
    layer("streak", gold, 34, .92, .34, .22, 4.4, .18, .9, 1.08, true),
    layer("glow", warmWhite, 34, 1.4, .3, .42, .58, .46, .72, 1.05),
    layer("spark", teal, 18, .7, .1, .36, 1.2, .3, .54, .92),
  ],
  healer_field_mend: [
    layer("glow", mint, 46, 1.5, .42, .68, .82, 1.7, .8, .32),
    layer("spark", warmWhite, 19, 1.05, .14, .52, 1.05, 1.55, .74, .48),
    layer("streak", gold, 12, .82, .25, .42, .68, 1.8, .7, .35),
  ],
  healer_renewal: [
    layer("glow", mint, 68, 1.72, .5, 2.25, 1.75, 1.3, .76, .2),
    layer("spark", warmWhite, 24, 1.12, .15, 1.85, 1.9, 1.05, .72, .48),
    layer("streak", gold, 18, .88, .28, 1.6, 1.45, 1.25, .72, .28),
  ],
  healer_resurrection: [
    layer("glow", warmWhite, 72, 2.35, .52, .95, .52, 2.9, .88, .45),
    layer("streak", gold, 39, 1.55, .44, .72, .82, 3.1, .94, .38),
    layer("smoke", [.64, .64, .5], 26, 2, .82, .92, .52, 1.25, .3, .08),
  ],
};

export const CALLING_ANTICIPATION_PARTICLES: Record<BuildPathId, readonly ParticleLayer[]> = {
  tank: [layer("spark", steel, 14, .45, .12, .68, .85, 1, .7, .5)],
  mage: [layer("glow", violet, 19, .5, .25, .5, .55, 1.3, .75, .55)],
  assassin: [layer("smoke", shadow, 20, .65, .48, .46, .7, 1, .48, .65)],
  thief: [layer("smoke", smoke, 20, .65, .5, .62, .8, .7, .48, .4)],
  ranger: [layer("streak", gold, 14, .42, .26, .27, 1.5, .2, .76, .85, true)],
  healer: [layer("glow", mint, 18, .56, .3, .48, .35, 1.25, .7, .6)],
};

/** Short character-bound flourishes make every Calling visibly cast from the player. */
export const CALLING_CAST_PARTICLES: Record<BuildPathId, readonly ParticleLayer[]> = {
  tank: [
    layer("spark", steel, 18, .52, .13, .32, 1.4, .68, .82, 0, false, "rune"),
    layer("streak", silver, 10, .42, .2, .24, 1.9, .28, .74, 0, true, "streak"),
  ],
  mage: [
    layer("glow", violet, 20, .62, .24, .28, .52, .72, .82, 0, false, "orb"),
    layer("spark", silver, 12, .46, .1, .3, 1.4, .7, .8, 0, false, "rune"),
  ],
  assassin: [
    layer("smoke", shadow, 22, .72, .42, .34, .6, .62, .54, 0, false, "smoke"),
    layer("streak", paleBlade, 16, .4, .3, .2, 2.8, .18, .84, 0, true, "streak"),
  ],
  thief: [
    layer("smoke", smoke, 24, .82, .5, .4, .62, .48, .62, 0, false, "smoke"),
    layer("spark", lime, 12, .48, .1, .3, 1.25, .65, .7, 0, false, "rune"),
  ],
  ranger: [
    layer("streak", gold, 22, .48, .28, .18, 3.2, .12, .88, 0, true, "streak"),
    layer("spark", teal, 10, .44, .09, .28, 1.1, .42, .66, 0, false, "orb"),
  ],
  healer: [
    layer("glow", mint, 24, .76, .3, .34, .46, .95, .78, 0, false, "orb"),
    layer("spark", warmWhite, 14, .56, .11, .3, .9, .9, .78, 0, false, "rune"),
  ],
};

export const CALLING_SUSTAIN_PARTICLES: Record<BuildPathId, readonly ParticleLayer[]> = {
  tank: [layer("spark", steel, 12, .72, .1, .8, .45, .5, .4, .85)],
  mage: [layer("glow", violet, 14, .9, .24, .62, .3, .85, .35, .85)],
  assassin: [layer("smoke", shadow, 12, 1.05, .4, .5, .3, .7, .25, .6)],
  thief: [layer("smoke", smoke, 15, .95, .46, .65, .35, .62, .25, .65)],
  ranger: [layer("spark", gold, 10, .65, .09, .48, .4, .3, .35, .85)],
  healer: [layer("glow", mint, 16, 1.2, .3, .6, .2, .9, .42, .7)],
};

/** Long-lived effects need to communicate the actual mechanic, not only the Calling colour. */
export const CALLING_ABILITY_SUSTAIN_PARTICLES: Partial<Record<CallingAbilityId, readonly ParticleLayer[]>> = {
  tank_bulwark: [
    layer("glow", steel, 28, .9, .34, .98, .34, .58, .54, .72),
    layer("spark", silver, 16, .65, .11, 1.02, .5, .58, .56, .82),
  ],
  tank_challenge: [
    layer("spark", amber, 22, .68, .12, 1.18, .7, .46, .66, .72),
    layer("dust", earth, 14, .88, .42, 1.08, .44, .2, .3, .04),
  ],
  mage_mana_shield: [
    layer("glow", azure, 32, 1.08, .4, 1.02, .3, .58, .52, .68, false, "orb"),
    layer("spark", silver, 16, .72, .12, 1, .62, .72, .58, .86, false, "rune"),
  ],
  mage_overload: [
    layer("streak", magenta, 28, .72, .32, .82, .82, .78, .68, .7, false, "lightning"),
    layer("glow", violet, 22, .9, .3, .68, .38, .7, .5, .88, false, "orb"),
  ],
  assassin_vanish: [
    layer("smoke", shadow, 34, 1.25, .64, .72, .46, .76, .46, .4),
    layer("streak", violet, 12, .56, .23, .5, .72, .38, .46, .78),
  ],
  assassin_blade_dance: [
    layer("streak", paleBlade, 26, .62, .3, .78, 1.35, .42, .72, .76),
    layer("spark", crimson, 14, .65, .11, .62, 1.25, .82, .66, .7),
  ],
  thief_smoke_bomb: [
    layer("smoke", [.18, .22, .21], 52, 1.45, 1.18, 1.75, .42, .42, .82, .42),
    layer("smoke", [.35, .4, .38], 30, 1.15, .86, 1.45, .34, .62, .68, .78),
    layer("glow", green, 9, .72, .19, .95, .38, .45, .4, .38),
  ],
  thief_decoy: [
    layer("smoke", [.22, .34, .27], 28, 1.15, .68, .7, .3, .46, .52, .68),
    layer("glow", green, 26, .95, .3, .52, .3, .7, .52, 1.02),
    layer("streak", lime, 10, .62, .18, .42, .62, .68, .5, .82),
  ],
  thief_escape_artist: [
    layer("streak", lime, 30, .58, .3, .5, 2.8, .45, .7, .78, true),
    layer("spark", warmWhite, 12, .48, .09, .55, 1.2, .65, .46, .78),
  ],
  ranger_volley_focus: [
    layer("streak", gold, 24, .7, .28, .48, 1.8, .28, .62, .9, true),
    layer("spark", warmWhite, 12, .58, .08, .52, .72, .38, .46, .86),
  ],
  ranger_disengage: [
    layer("streak", teal, 18, .6, .28, .44, 1.8, .35, .62, .82, true),
    layer("dust", smoke, 12, .75, .34, .52, .65, .18, .28, .08),
  ],
  ranger_deadeye: [
    layer("streak", gold, 18, .72, .26, .3, 2.1, .2, .68, 1.02, true),
    layer("glow", warmWhite, 16, .82, .2, .36, .34, .28, .54, 1),
  ],
  healer_resurrection: [
    layer("glow", mint, 32, 1.2, .38, .92, .28, 1.15, .58, .3),
    layer("streak", gold, 18, .82, .28, .78, .36, 1.65, .76, .32),
  ],
};

export const callingParticleLifetime = (layers: readonly ParticleLayer[]): number =>
  Math.max(...layers.map(entry => entry.life + entry.count * .012 + .2));
