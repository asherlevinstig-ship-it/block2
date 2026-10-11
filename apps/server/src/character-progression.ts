import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_STAT_POINTS,
  characterMiningBonus,
  characterPowerBonus,
  characterSpeedMultiplier,
  experienceToNextLevel,
  experienceLevelMultiplier,
  type CharacterStatId,
  type ProgressionUpdate,
} from "@blockcraft/protocol";
import type { PlayerState } from "./schema.js";

export function progressionSnapshot(player: PlayerState, reason: ProgressionUpdate["reason"] = "sync", source?: string, experienceGranted?: number): ProgressionUpdate {
  return { reason, source, experienceGranted, level: player.level, experience: player.experience,
    experienceRequired: experienceToNextLevel(player.level), unspentStatPoints: player.unspentStatPoints,
    powerPoints: player.powerPoints, vitalityPoints: player.vitalityPoints,
    agilityPoints: player.agilityPoints, miningPoints: player.miningPoints };
}

export function grantCharacterExperience(player: PlayerState, amount: number, source: string): ProgressionUpdate | null {
  const granted = Math.max(0, Math.floor(amount));
  if (!granted || player.level >= MAX_CHARACTER_LEVEL) return null;
  player.experience += granted;
  let levels = 0;
  while (player.level < MAX_CHARACTER_LEVEL) {
    const required = experienceToNextLevel(player.level);
    if (player.experience < required) break;
    player.experience -= required; player.level++; player.unspentStatPoints++; levels++;
  }
  if (player.level >= MAX_CHARACTER_LEVEL) player.experience = 0;
  return progressionSnapshot(player, levels ? "level_up" : "experience", source, granted);
}

export function chooseCharacterStat(player: PlayerState, stat: CharacterStatId): ProgressionUpdate | null {
  const field = `${stat}Points` as "powerPoints" | "vitalityPoints" | "agilityPoints" | "miningPoints";
  if (player.unspentStatPoints <= 0 || player[field] >= MAX_CHARACTER_STAT_POINTS) return null;
  player[field]++; player.unspentStatPoints--;
  if (stat === "vitality") { player.maxHealth = Math.min(127, player.maxHealth + 1); player.health = Math.min(player.maxHealth, player.health + 1); }
  return progressionSnapshot(player, "choice", stat);
}

export const progressionAttackBonus = (player: PlayerState) => characterPowerBonus(player.powerPoints);
export const progressionSpeedMultiplier = (player: PlayerState) => characterSpeedMultiplier(player.agilityPoints);
export const progressionMiningBonus = (player: PlayerState) => characterMiningBonus(player.miningPoints);

export function mobExperience(archetype: string, rewardMultiplier: number, champion: boolean, playerLevel = 1, enemyLevel = 1): number {
  const base = archetype === "stone_brute" ? 18 : archetype === "cave_spitter" ? 12 : archetype === "briar_crawler" ? 9 : 7;
  return Math.max(1, Math.round(base * Math.max(1, rewardMultiplier) * (champion ? 1.25 : 1) * experienceLevelMultiplier(playerLevel, enemyLevel)));
}
