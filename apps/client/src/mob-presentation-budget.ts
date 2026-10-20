export const MOB_PRESENTATION_RANGE = 72;

/** Terrain outside the streamed play window cannot support a useful mob render. */
export function mobPresentationVisible(worldVisible: boolean, distance: number): boolean {
  return worldVisible && Number.isFinite(distance) && distance <= MOB_PRESENTATION_RANGE;
}
