export const MIXED_WARBAND_LEADERS = new Set([
  "stone-brute", "frontier-brute", "frontier-brute-west", "frontier-brute-east",
  "mistfen-behemoth", "south-quarrymaster",
]);

export type WarbandFormationState = "full" | "pin" | "crossfire" | "broken";

export const isMixedWarbandLeader = (id: string): boolean => MIXED_WARBAND_LEADERS.has(id);

/** The crawler closes one side while the ranged escort attacks the opposite escape. */
export function warbandFlankSide(sequence: number): 1 | -1 {
  return sequence % 2 === 0 ? 1 : -1;
}

export function warbandCrawlerYaw(yaw: number, sequence: number): number {
  return yaw + warbandFlankSide(sequence) * 38;
}

export function warbandCrossfireSite(target: { x: number; y: number; z: number }, yaw: number, sequence: number) {
  const radians = (yaw - warbandFlankSide(sequence) * 90) * Math.PI / 180;
  return { x: target.x + Math.sin(radians) * 2.8, y: target.y, z: target.z + Math.cos(radians) * 2.8 };
}

export function warbandFormationState(crawlerActive: boolean, spitterActive: boolean): WarbandFormationState | null {
  return crawlerActive && spitterActive ? "full" : crawlerActive ? "pin" : spitterActive ? "crossfire" : null;
}
