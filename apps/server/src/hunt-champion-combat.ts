import type { AreaLeaderPhase } from "./area-mini-bosses.js";
import type { HuntPathId } from "./hunt-contracts.js";
import type { HuntDifficulty } from "./hunt-mastery.js";

/** Path Champions use even thirds so each mechanic has enough time to be learned. */
export function huntChampionPhase(health: number, maxHealth: number): AreaLeaderPhase {
  if (maxHealth <= 0 || health * 3 <= maxHealth) return 3;
  if (health * 3 <= maxHealth * 2) return 2;
  return 1;
}

/** Deterministic rotations keep the final contract fight readable and replayable. */
export function huntChampionPattern(pathId: HuntPathId, sequence: number, phase: AreaLeaderPhase,
  difficulty: HuntDifficulty = "normal"): string {
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
  const advanced: Record<Exclude<HuntDifficulty, "normal">, Record<HuntPathId, Record<AreaLeaderPhase, readonly string[]>>> = {
    veteran: {
      fang: { 1: ["rush", "pack-rush"], 2: ["pack-rush", "pincer-rush", "rush"], 3: ["pincer-rush", "alpha-rush", "pack-rush"] },
      venom: { 1: ["fan", "pool"], 2: ["pool", "cross-volley", "fan"], 3: ["cross-volley", "venom-ring", "pool"] },
      crusher: { 1: ["rocks", "slam"], 2: ["falling-rocks", "smash", "rocks"], 3: ["fault-line", "falling-rocks", "smash"] },
    },
    ascendant: {
      fang: { 1: ["pack-rush", "rush"], 2: ["pincer-rush", "alpha-rush", "pack-rush"], 3: ["pincer-rush", "alpha-rush", "pincer-rush", "pack-rush"] },
      venom: { 1: ["pool", "fan"], 2: ["cross-volley", "venom-ring", "pool"], 3: ["cross-volley", "venom-ring", "cross-volley", "pool"] },
      crusher: { 1: ["rocks", "falling-rocks"], 2: ["fault-line", "smash", "falling-rocks"], 3: ["fault-line", "warden-barrage", "smash", "fault-line"] },
    },
  };
  const rotation = difficulty === "normal" ? rotations[pathId][phase] : advanced[difficulty][pathId][phase];
  return rotation[Math.max(0, sequence) % rotation.length]!;
}

export function huntChampionRushMultiplier(pattern: string): number {
  return pattern === "alpha-rush" ? 1.5 : pattern === "pincer-rush" ? 1.42 : pattern === "pack-rush" ? 1.28 : 1;
}

export function huntChampionVenomHazard(pattern: string): { radius: number; durationMs: number } | null {
  if (pattern === "venom-ring") return { radius: .9, durationMs: 4_500 };
  if (pattern === "cross-volley") return { radius: .82, durationMs: 4_200 };
  if (pattern === "pool") return { radius: 1.75, durationMs: 5_000 };
  return null;
}

export function huntChampionUsesSecondVolley(pathId: HuntPathId, pattern: string): boolean {
  return pathId === "venom" && (pattern === "double-fan" || pattern === "venom-ring" || pattern === "cross-volley")
    || pathId === "crusher" && (pattern === "warden-barrage" || pattern === "fault-line");
}

export function huntChampionPincerSites(target: { x: number; y: number; z: number }, yaw: number,
  difficulty: HuntDifficulty): { x: number; y: number; z: number }[] {
  if (difficulty === "normal") return [];
  const radians = yaw * Math.PI / 180;
  const sideX = Math.cos(radians), sideZ = -Math.sin(radians);
  const sites = [-1.65, 1.65].map(offset => ({ x: target.x + sideX * offset, y: target.y, z: target.z + sideZ * offset }));
  if (difficulty === "ascendant") sites.push({
    x: target.x - Math.sin(radians) * 2.15, y: target.y, z: target.z - Math.cos(radians) * 2.15,
  });
  return sites;
}
