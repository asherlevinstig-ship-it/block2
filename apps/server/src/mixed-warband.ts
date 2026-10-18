export const MIXED_WARBAND_LEADERS = new Set([
  "stone-brute", "frontier-brute", "frontier-brute-west", "frontier-brute-east",
  "mistfen-behemoth", "south-quarrymaster",
]);

export type WarbandFormationState = "forming" | "full" | "pin" | "crossfire" | "broken";
export type WarbandTactic = "surround" | "venom-lock" | "breach";

export const isMixedWarbandLeader = (id: string): boolean => MIXED_WARBAND_LEADERS.has(id);

/** Fixed encounter identity: it never scales from party size or player level. */
export function warbandTactic(leaderId: string): WarbandTactic {
  if (leaderId === "mistfen-behemoth") return "venom-lock";
  if (leaderId === "south-quarrymaster" || leaderId === "frontier-brute-east") return "breach";
  return "surround";
}

export function warbandTacticStats(leaderId: string) {
  const tactic = warbandTactic(leaderId);
  return tactic === "venom-lock"
    ? { crawlerDistance: 1.15, poolRadius: 1.3, poolDurationMs: 4_500, poolTravelMs: 1_100 }
    : tactic === "breach"
      ? { crawlerDistance: 1.2, poolRadius: .95, poolDurationMs: 2_500, poolTravelMs: 850 }
      : { crawlerDistance: 1.4, poolRadius: 1, poolDurationMs: 3_000, poolTravelMs: 1_000 };
}

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
