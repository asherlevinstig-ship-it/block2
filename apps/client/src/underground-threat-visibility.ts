export interface UndergroundThreatVisibility {
  underground: boolean;
  known: boolean;
  cutawayHidden: boolean;
  verticalDistance: number;
  distance: number;
  lineClear: boolean;
}

export const UNDERGROUND_THREAT_REVEAL_RANGE = 20;
export const UNDERGROUND_THREAT_REVEAL_HEIGHT = 3;

/** Fog may hide unexplored cave geometry, never an enemy that can attack the player. */
export function undergroundThreatVisible(state: UndergroundThreatVisibility): boolean {
  if (state.known && !state.cutawayHidden) return true;
  return state.underground
    && state.verticalDistance <= UNDERGROUND_THREAT_REVEAL_HEIGHT
    && state.distance <= UNDERGROUND_THREAT_REVEAL_RANGE
    && state.lineClear;
}
