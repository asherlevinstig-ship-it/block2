export const MOB_PRESENTATION_RANGE = 72;
export const MOB_FULL_DETAIL_RANGE = 28;

export type MobPresentationDetail = "hidden" | "lod" | "full";

/** Terrain outside the streamed play window cannot support a useful mob render. */
export function mobPresentationVisible(worldVisible: boolean, distance: number): boolean {
  return worldVisible && Number.isFinite(distance) && distance <= MOB_PRESENTATION_RANGE;
}

/** Distant enemies remain readable as one-piece silhouettes without paying for their full articulated rigs. */
export function mobPresentationDetail(worldVisible: boolean, distance: number): MobPresentationDetail {
  if (!mobPresentationVisible(worldVisible, distance)) return "hidden";
  return distance <= MOB_FULL_DETAIL_RANGE ? "full" : "lod";
}

/** Server simulation remains unchanged; only distant visual interpolation is sampled less often. */
export function mobPresentationIntervalMs(detail: MobPresentationDetail, distance: number): number {
  if (detail !== "lod") return 0;
  return distance <= 48 ? 100 : 200;
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
