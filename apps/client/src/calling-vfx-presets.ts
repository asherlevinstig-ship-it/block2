import type { BuildPathId, CallingAbilityId } from "@blockcraft/protocol";

export type ParticleKind = "smoke" | "dust" | "glow" | "spark" | "streak";
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
};

const layer = (kind: ParticleKind, color: ParticleColor, count: number, life: number,
  size: number, radius: number, speed: number, rise: number, opacity: number,
  offsetY = 0, forward = false): ParticleLayer =>
  ({ kind, color, count, life, size, radius, speed, rise, opacity, offsetY, forward });

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
    layer("spark", steel, 20, .8, .19, .76, 1.4, 1.0, .8, .85),
    layer("glow", silver, 12, 1.1, .42, .7, .65, .55, .5, .9),
  ],
  tank_challenge: [
    layer("dust", earth, 30, 1.15, .6, 1.2, 2.1, .3, .4, .1),
    layer("spark", amber, 21, .75, .18, 1, 2.5, 1.2, .85, .8),
  ],
  tank_earthbreaker: [
    layer("dust", earth, 62, 1.7, .85, 1.9, 3.2, .85, .62, .08),
    layer("spark", amber, 32, .85, .17, 1.1, 4, 2.4, .92, .1),
    layer("smoke", [.42, .39, .34], 20, 1.9, .95, 2.3, 1.3, .48, .38, .18),
  ],
  mage_arcane_surge: [
    layer("glow", violet, 58, 1.2, .46, 1.75, 3.1, 1.15, .88, .22),
    layer("streak", [.84, .72, 1], 32, .68, .38, 1.05, 4.2, 1.9, .88, .42),
    layer("spark", silver, 18, .5, .12, 1.45, 4.8, 1.4, .92, .18),
  ],
  mage_mana_shield: [
    layer("glow", azure, 38, 1.35, .48, 1.05, 1.35, .8, .72, .68),
    layer("spark", silver, 24, .92, .14, 1.08, 2.1, 1.1, .84, .82),
  ],
  mage_overload: [
    layer("streak", magenta, 52, 1.05, .45, 1.05, 3.8, 1.45, .92, .48),
    layer("glow", violet, 30, 1.38, .48, .72, 1.2, 1.18, .76, .82),
    layer("spark", silver, 18, .6, .11, .9, 3.4, 1.5, .86, .72),
  ],
  assassin_vanish: [
    layer("smoke", shadow, 46, 1.45, .7, .7, 1.4, 1.0, .6, .7),
    layer("streak", violet, 15, .55, .25, .5, 2.7, .45, .55, .9),
  ],
  assassin_death_mark: [
    layer("glow", crimson, 25, 1.1, .28, .48, .8, .8, .83, 1.15),
    layer("streak", paleBlade, 12, .65, .35, .35, 2, 1.2, .78, 1.15),
  ],
  assassin_blade_dance: [
    layer("streak", paleBlade, 48, .73, .42, .95, 4.1, .4, .86, .85),
    layer("spark", crimson, 26, .85, .16, .72, 3, 1.4, .8, .8),
  ],
  thief_smoke_bomb: [
    layer("smoke", smoke, 74, 2.2, 1.1, 1.45, 1.35, .8, .72, .35),
    layer("dust", [.26, .33, .3], 26, 1.5, .62, 1.2, 1.8, .35, .4, .08),
    layer("glow", green, 12, 1, .24, .8, 1.2, .7, .38, .5),
  ],
  thief_decoy: [
    layer("smoke", [.29, .43, .34], 39, 1.9, .64, .55, .75, .35, .6, .85),
    layer("glow", green, 25, 1.55, .28, .36, .5, .35, .54, 1.15),
    layer("smoke", smoke, 22, 1.4, .44, .22, .45, .25, .56, 1.65),
  ],
  thief_escape_artist: [
    layer("streak", lime, 43, .67, .43, .56, 4.5, .55, .75, .75, true),
    layer("dust", smoke, 18, 1, .5, .65, 2.1, .28, .35, .08),
  ],
  ranger_volley_focus: [
    layer("streak", gold, 31, .8, .38, .42, 3.3, .35, .8, .95, true),
    layer("glow", warmWhite, 16, 1, .3, .45, .7, .65, .5, 1),
  ],
  ranger_disengage: [
    layer("streak", teal, 44, .75, .38, .62, 4.2, .5, .8, .75, true),
    layer("dust", smoke, 25, 1.1, .54, .8, 2.1, .32, .42, .1),
  ],
  ranger_deadeye: [
    layer("streak", gold, 17, .8, .31, .18, 3.4, .15, .83, 1.1, true),
    layer("glow", warmWhite, 23, 1.35, .29, .36, .5, .4, .64, 1.05),
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
    layer("glow", steel, 22, .85, .34, .88, .3, .55, .5, .75),
    layer("spark", silver, 12, .62, .11, .92, .45, .55, .52, .85),
  ],
  mage_mana_shield: [
    layer("glow", azure, 32, 1.08, .4, 1.02, .3, .58, .52, .68),
    layer("spark", silver, 16, .72, .12, 1, .62, .72, .58, .86),
  ],
  mage_overload: [
    layer("streak", magenta, 28, .72, .32, .82, .82, .78, .68, .7),
    layer("glow", violet, 22, .9, .3, .68, .38, .7, .5, .88),
  ],
  assassin_vanish: [
    layer("smoke", shadow, 28, 1.2, .62, .68, .42, .72, .44, .42),
    layer("streak", violet, 9, .52, .22, .45, .65, .32, .4, .8),
  ],
  thief_smoke_bomb: [
    layer("smoke", [.18, .22, .21], 52, 1.45, 1.18, 1.75, .42, .42, .82, .42),
    layer("smoke", [.35, .4, .38], 30, 1.15, .86, 1.45, .34, .62, .68, .78),
    layer("glow", green, 9, .72, .19, .95, .38, .45, .4, .38),
  ],
  thief_decoy: [
    layer("smoke", [.22, .34, .27], 34, 1.1, .72, .72, .32, .48, .58, .7),
    layer("glow", green, 18, .86, .28, .48, .24, .42, .44, 1.05),
  ],
  healer_resurrection: [
    layer("glow", mint, 32, 1.2, .38, .92, .28, 1.15, .58, .3),
    layer("streak", gold, 18, .82, .28, .78, .36, 1.65, .76, .32),
  ],
};

export const callingParticleLifetime = (layers: readonly ParticleLayer[]): number =>
  Math.max(...layers.map(entry => entry.life + entry.count * .012 + .2));
