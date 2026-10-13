import type { AreaLeaderPhase } from "./area-mini-bosses.js";
import type { HuntPathId } from "./hunt-contracts.js";

/** Path Champions use even thirds so each mechanic has enough time to be learned. */
export function huntChampionPhase(health: number, maxHealth: number): AreaLeaderPhase {
  if (maxHealth <= 0 || health * 3 <= maxHealth) return 3;
  if (health * 3 <= maxHealth * 2) return 2;
  return 1;
}

/** Deterministic rotations keep the final contract fight readable and replayable. */
export function huntChampionPattern(pathId: HuntPathId, sequence: number, phase: AreaLeaderPhase): string {
  const rotations: Record<HuntPathId, Record<AreaLeaderPhase, readonly string[]>> = {
    fang: {
      1: ["rush", "pack-rush"],
      2: ["pack-rush", "rush", "alpha-rush"],
      3: ["alpha-rush", "pack-rush", "alpha-rush", "rush"],
    },
    venom: {
      1: ["fan", "pool"],
      2: ["pool", "venom-ring", "fan"],
      3: ["venom-ring", "pool", "double-fan"],
    },
    crusher: {
      1: ["rocks", "slam"],
      2: ["falling-rocks", "smash", "rocks"],
      3: ["warden-barrage", "falling-rocks", "smash", "rocks"],
    },
  };
  const rotation = rotations[pathId][phase];
  return rotation[Math.max(0, sequence) % rotation.length]!;
}

export function huntChampionRushMultiplier(pattern: string): number {
  return pattern === "alpha-rush" ? 1.5 : pattern === "pack-rush" ? 1.28 : 1;
}

export function huntChampionVenomHazard(pattern: string): { radius: number; durationMs: number } | null {
  if (pattern === "venom-ring") return { radius: .9, durationMs: 4_500 };
  if (pattern === "pool") return { radius: 1.75, durationMs: 5_000 };
  return null;
}

export function huntChampionUsesSecondVolley(pathId: HuntPathId, pattern: string): boolean {
  return pathId === "venom" && (pattern === "double-fan" || pattern === "venom-ring")
    || pathId === "crusher" && pattern === "warden-barrage";
}
