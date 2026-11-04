export const TOWER_FLOOR_ONE_FAR_CLIP = 82;
export const TOWER_FLOOR_TWO_FAR_CLIP = 90;
export const SURFACE_FAR_CLIP = 120;
export const DUNGEON_MINIMAP_INTERVAL_MS = 100;

/** Dungeon fog already hides geometry beyond these distances. Matching the
 * camera frustum to that authored visibility prevents the opposite wing and
 * boss court from entering render submission while they are still invisible. */
export function dungeonFarClip(inFloorOne: boolean, inFloorTwo: boolean): number {
  if (inFloorTwo) return TOWER_FLOOR_TWO_FAR_CLIP;
  if (inFloorOne) return TOWER_FLOOR_ONE_FAR_CLIP;
  return SURFACE_FAR_CLIP;
}

/** A ten-Hz dungeon map remains fluid while avoiding a full canvas redraw on
 * every combat frame. Town and overworld behaviour remains unchanged. */
export function dungeonMinimapUpdateDue(now: number, lastAt: number, inTowerFloor: boolean): boolean {
  return !inTowerFloor || now - lastAt >= DUNGEON_MINIMAP_INTERVAL_MS;
}
