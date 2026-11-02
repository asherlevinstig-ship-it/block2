import {
  MAX_CHARACTER_LEVEL,
  MAX_CHARACTER_STAT_POINTS,
  characterMiningBonus,
  characterIntelligencePoints,
  characterPowerBonus,
  characterSpeedMultiplier,
  characterSoftCappedValue,
  experienceToNextLevel,
  experienceLevelMultiplier,
  type CharacterStatId,
  type ProgressionUpdate,
} from "@blockcraft/protocol";
import type { PlayerState } from "./schema.js";

export function progressionSnapshot(player: PlayerState, reason: ProgressionUpdate["reason"] = "sync", source?: string, experienceGranted?: number): ProgressionUpdate {
  return { reason, source, experienceGranted, level: player.level, experience: player.experience,
    experienceRequired: experienceToNextLevel(player.level), unspentStatPoints: player.unspentStatPoints,
    strengthPoints: player.powerPoints, powerPoints: player.powerPoints, vitalityPoints: player.vitalityPoints,
    agilityPoints: player.agilityPoints, intelligencePoints: characterIntelligencePoints(player.maxStamina),
    perceptionPoints: player.miningPoints, miningPoints: player.miningPoints };
}

export function grantCharacterExperience(player: PlayerState, amount: number, source: string): ProgressionUpdate | null {
  const granted = Math.max(0, Math.floor(amount));
  if (!granted || player.level >= MAX_CHARACTER_LEVEL) return null;
  player.experience += granted;
  player.unspentStatPoints = player.experience >= experienceToNextLevel(player.level) ? 1 : 0;
  return progressionSnapshot(player, "experience", source, granted);
}

export function chooseCharacterStat(player: PlayerState, stat: CharacterStatId): ProgressionUpdate | null {
  const cost = experienceToNextLevel(player.level);
  const current = stat === "intelligence" ? characterIntelligencePoints(player.maxStamina)
    : stat === "strength" ? player.powerPoints : stat === "perception" ? player.miningPoints : player[`${stat}Points`];
  if (player.level >= MAX_CHARACTER_LEVEL || cost <= 0 || player.experience < cost || current >= MAX_CHARACTER_STAT_POINTS) return null;
  player.experience -= cost;
  player.level++;
  if (stat === "intelligence") { player.maxStamina += 5; player.stamina = Math.min(player.maxStamina, player.stamina + 5); }
  else if (stat === "strength") player.powerPoints++;
  else if (stat === "perception") player.miningPoints++;
  else player[`${stat}Points`]++;
  player.unspentStatPoints = player.level < MAX_CHARACTER_LEVEL && player.experience >= experienceToNextLevel(player.level) ? 1 : 0;
  if (stat === "vitality") {
    const gainedHealth = Math.floor(characterSoftCappedValue(player.vitalityPoints))
      - Math.floor(characterSoftCappedValue(player.vitalityPoints - 1));
    player.maxHealth = Math.min(127, player.maxHealth + gainedHealth);
    player.health = Math.min(player.maxHealth, player.health + gainedHealth);
  }
  return progressionSnapshot(player, "level_up", stat);
}

export const progressionAttackBonus = (player: PlayerState) => characterPowerBonus(player.powerPoints);
export const progressionSpeedMultiplier = (player: PlayerState) => characterSpeedMultiplier(player.agilityPoints);
export const progressionMiningBonus = (player: PlayerState) => characterMiningBonus(player.miningPoints);

export function mobExperience(archetype: string, rewardMultiplier: number, champion: boolean, playerLevel = 1, enemyLevel = 1): number {
  const base = archetype === "stone_brute" ? 18 : archetype === "cave_spitter" ? 12 : archetype === "briar_crawler" ? 9 : 7;
  return Math.max(1, Math.round(base * Math.max(1, rewardMultiplier) * (champion ? 1.25 : 1) * experienceLevelMultiplier(playerLevel, enemyLevel)));
}
