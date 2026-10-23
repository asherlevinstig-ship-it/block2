import type { TownLifeRole } from "./town-life.js";

export type TownNpcMouthExpression = "calm" | "friendly" | "stern";

export interface TownNpcFaceStyle {
  iris: readonly [number, number, number];
  browTilt: number;
  mouth: TownNpcMouthExpression;
  beard: boolean;
  circlet: boolean;
  freckles: boolean;
  scar: boolean;
}

/** Small, high-contrast identity cues used on the fast-mode town cast.
 * They are geometry rather than atlas paint so they remain readable at the
 * normal camera distance and follow the animated head bone. */
export const TOWN_NPC_FACE_STYLES: Readonly<Record<TownLifeRole, TownNpcFaceStyle>> = {
  guard: {
    iris: [.24, .5, .68], browTilt: 10, mouth: "stern",
    beard: false, circlet: false, freckles: false, scar: true,
  },
  vendor: {
    iris: [.36, .62, .3], browTilt: -3, mouth: "friendly",
    beard: false, circlet: false, freckles: false, scar: false,
  },
  smith: {
    iris: [.63, .36, .14], browTilt: 5, mouth: "friendly",
    beard: true, circlet: false, freckles: false, scar: false,
  },
  healer: {
    iris: [.18, .78, .7], browTilt: -5, mouth: "calm",
    beard: false, circlet: true, freckles: false, scar: false,
  },
  resident: {
    iris: [.55, .38, .78], browTilt: 0, mouth: "friendly",
    beard: false, circlet: false, freckles: true, scar: false,
  },
} as const;

export const townNpcFaceStyle = (role: TownLifeRole): TownNpcFaceStyle => TOWN_NPC_FACE_STYLES[role];
