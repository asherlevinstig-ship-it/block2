import { z } from "zod";
import { TOWER_FLOOR_ONE } from "./tower-floor-one.js";
import { TOWER_FLOOR_TWO } from "./tower-floor-two.js";

export const MEDITATION_HOLD_MS = 1_850;
export const MEDITATION_USE_RANGE = 2.65;

export const MeditationSiteIdSchema = z.enum([
  "town-waystone",
  "floor-1-waystone",
  "floor-2-waystone",
]);
export type MeditationSiteId = z.infer<typeof MeditationSiteIdSchema>;

export type MeditationSite = {
  id: MeditationSiteId;
  name: string;
  location: "town" | "floor-1" | "floor-2";
  x: number;
  y: number;
  z: number;
  colour: readonly [number, number, number];
};

/** Original Waystones provide the recovery role of a rest point without
 * borrowing another game's visual language. Their positions are shared by
 * rendering and the authoritative interaction check. */
export const MEDITATION_SITES: readonly MeditationSite[] = [
  { id: "town-waystone", name: "Waystone of Beginnings", location: "town",
    x: 91, y: 8.16, z: 113, colour: [.22, 1, .76] },
  { id: "floor-1-waystone", name: "Rampart Sanctuary Waystone", location: "floor-1",
    x: 310.5, y: 9.16, z: 116, colour: [.62, 1, .28] },
  { id: "floor-2-waystone", name: "Emberworks Refuge Waystone", location: "floor-2",
    x: 418.5, y: 8.16, z: 111.5, colour: [1, .38, .12] },
] as const;

export const MeditationRestRequestSchema = z.object({ siteId: MeditationSiteIdSchema });
export type MeditationRestUpdate = {
  ok: boolean;
  siteId: MeditationSiteId;
  name: string;
  message: string;
  health?: number;
  maxHealth?: number;
  stamina?: number;
  maxStamina?: number;
};

export function meditationSite(id: MeditationSiteId): MeditationSite {
  return MEDITATION_SITES.find(site => site.id === id)!;
}

export function meditationSiteInRange(
  position: { x: number; y: number; z: number },
  id: MeditationSiteId,
  range = MEDITATION_USE_RANGE,
): boolean {
  const site = meditationSite(id);
  return Math.abs(position.y - site.y) <= 2.25
    && Math.hypot(position.x - site.x, position.z - site.z) <= range;
}

export function nearestMeditationSite(position: { x: number; y: number; z: number }, range = MEDITATION_USE_RANGE): MeditationSite | null {
  let best: MeditationSite | null = null;
  let bestDistance = range;
  for (const site of MEDITATION_SITES) {
    if (Math.abs(position.y - site.y) > 2.25) continue;
    const distance = Math.hypot(position.x - site.x, position.z - site.z);
    if (distance <= bestDistance) { best = site; bestDistance = distance; }
  }
  return best;
}

export function meditationSiteIsInSafeZone(site: MeditationSite): boolean {
  if (site.location === "town") return true;
  if (site.location === "floor-1") {
    const safe = TOWER_FLOOR_ONE.sanctuary;
    return site.x >= safe.minX && site.x <= safe.maxX && site.z >= safe.minZ && site.z <= safe.maxZ;
  }
  const safe = TOWER_FLOOR_TWO.sanctuary;
  return Math.hypot(site.x - safe.x, site.z - safe.z) <= safe.radius;
}
