export const MOB_PRESENTATION_RANGE = 72;
export const MOB_FULL_DETAIL_RANGE = 18;
export const MOB_MID_DETAIL_RANGE = 40;
export const MOB_COMBAT_DETAIL_RANGE = 34;
export const MOB_IDLE_ANIMATION_RANGE = 8;

export type MobPresentationDetail = "hidden" | "lod" | "mid" | "full";

/** Preserve breathing motion at intimate range, but let unchanged idle rigs settle so
 * their dynamic render batches do not need rebuilding every frame. */
export function mobRigNeedsAnimation(distance: number, combatActive: boolean, gaitSpeed: number,
  hit: number, stagger: number, alive: boolean, defeatProgress: number): boolean {
  return distance <= MOB_IDLE_ANIMATION_RANGE || combatActive || gaitSpeed > .02 || hit > .001 || stagger > .001
    || !alive && defeatProgress < 1;
}

/** Terrain outside the streamed play window cannot support a useful mob render. */
export function mobPresentationVisible(worldVisible: boolean, distance: number): boolean {
  return worldVisible && Number.isFinite(distance) && distance <= MOB_PRESENTATION_RANGE;
}

/** Close combat keeps its full tells; middle distance uses a recognizable three-mass rig. */
export function mobPresentationDetail(worldVisible: boolean, distance: number, combatActive = false): MobPresentationDetail {
  if (!mobPresentationVisible(worldVisible, distance)) return "hidden";
  if (distance <= MOB_FULL_DETAIL_RANGE || combatActive && distance <= MOB_COMBAT_DETAIL_RANGE) return "full";
  return distance <= MOB_MID_DETAIL_RANGE ? "mid" : "lod";
}

/** Server simulation remains unchanged; only distant visual interpolation is sampled less often. */
export function mobPresentationIntervalMs(detail: MobPresentationDetail, distance: number): number {
  if (detail === "mid") return 50;
  if (detail === "lod") return distance <= 52 ? 100 : 200;
  return 0;
}

/** Spread distant visual work across frames instead of updating every LOD mob in one synchronized burst. */
export function mobPresentationInitialDelay(id: string, intervalMs: number): number {
  if (intervalMs <= 0) return 0;
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % intervalMs;
}
