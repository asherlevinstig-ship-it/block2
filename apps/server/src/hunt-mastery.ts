import type { HuntPathId } from "./hunt-contracts.js";
import { HUNT_EQUIPMENT_SETS, type ItemId } from "@blockcraft/protocol";

export type HuntDifficulty = "normal" | "veteran" | "ascendant";
export const HUNT_DIFFICULTIES = ["normal", "veteran", "ascendant"] as const;
export type HuntPathMastery = { rank: number; bestTimesMs: Partial<Record<HuntDifficulty, number>> };
export type HuntMasteryProgress = Record<HuntPathId, HuntPathMastery>;

export const emptyHuntMastery = (): HuntMasteryProgress => ({
  fang: { rank: 0, bestTimesMs: {} }, venom: { rank: 0, bestTimesMs: {} }, crusher: { rank: 0, bestTimesMs: {} },
});

export function parseHuntMastery(value: unknown): HuntMasteryProgress {
  let source: unknown = value;
  if (typeof value === "string") { try { source = JSON.parse(value); } catch { return emptyHuntMastery(); } }
  const result = emptyHuntMastery();
  if (!source || typeof source !== "object" || Array.isArray(source)) return result;
  for (const pathId of ["fang", "venom", "crusher"] as const) {
    const path = (source as Record<string, unknown>)[pathId];
    if (!path || typeof path !== "object" || Array.isArray(path)) continue;
    const rank = (path as Record<string, unknown>).rank;
    result[pathId].rank = typeof rank === "number" && Number.isFinite(rank) ? Math.max(0, Math.min(10, Math.floor(rank))) : 0;
    const times = (path as Record<string, unknown>).bestTimesMs;
    if (!times || typeof times !== "object" || Array.isArray(times)) continue;
    for (const difficulty of HUNT_DIFFICULTIES) {
      const time = (times as Record<string, unknown>)[difficulty];
      if (typeof time === "number" && Number.isFinite(time) && time > 0)
        result[pathId].bestTimesMs[difficulty] = Math.min(86_400_000, Math.floor(time));
    }
  }
  return result;
}

export const serializeHuntMastery = (value: unknown): string => JSON.stringify(parseHuntMastery(value));
export function huntDifficultyUnlocked(rank: number, difficulty: HuntDifficulty): boolean {
  return difficulty === "normal" || difficulty === "veteran" && rank >= 1 || difficulty === "ascendant" && rank >= 3;
}
export const huntDifficultyStatTier = (difficulty: HuntDifficulty): number => difficulty === "ascendant" ? 4 : difficulty === "veteran" ? 2 : 0;
export const huntDifficultyTiming = (difficulty: HuntDifficulty): { windup: number; cooldown: number } => difficulty === "ascendant"
  ? { windup: .78, cooldown: .7 } : difficulty === "veteran" ? { windup: .9, cooldown: .84 } : { windup: 1, cooldown: 1 };
export const huntDifficultyRewardMultiplier = (difficulty: HuntDifficulty): number => difficulty === "ascendant" ? 2 : difficulty === "veteran" ? 1.5 : 1;
export const huntDifficultyLives = (difficulty: HuntDifficulty): number => difficulty === "ascendant" ? 3 : 0;

export const HUNT_PATH_EQUIPMENT: Readonly<Record<HuntPathId, { weaponId: ItemId; armourId: ItemId; forgemarkId: ItemId }>> = {
  fang: { ...HUNT_EQUIPMENT_SETS.fang, forgemarkId: "alpha_forgemark" },
  venom: { ...HUNT_EQUIPMENT_SETS.venom, forgemarkId: "venom_forgemark" },
  crusher: { ...HUNT_EQUIPMENT_SETS.crusher, forgemarkId: "crusher_forgemark" },
};

export function huntEquipmentRewards(pathId: HuntPathId, difficulty: HuntDifficulty, ownsArmour: boolean, roll = Math.random()): ItemId[] {
  const set = HUNT_PATH_EQUIPMENT[pathId];
  const rewards: ItemId[] = [set.weaponId];
  if (difficulty === "ascendant" || difficulty === "veteran" && (!ownsArmour || roll < .35)) rewards.push(set.armourId);
  if (difficulty === "ascendant") rewards.push(set.forgemarkId);
  return rewards;
}

export function completeHuntMastery(progress: HuntMasteryProgress, pathId: HuntPathId, difficulty: HuntDifficulty, elapsedMs: number): HuntMasteryProgress {
  const next = parseHuntMastery(progress);
  const path = next[pathId];
  path.rank = Math.min(10, path.rank + (difficulty === "ascendant" ? 3 : difficulty === "veteran" ? 2 : 1));
  const time = Math.max(1, Math.min(86_400_000, Math.floor(elapsedMs)));
  const previous = path.bestTimesMs[difficulty] ?? Infinity;
  path.bestTimesMs[difficulty] = Math.min(previous, time);
  return next;
}
