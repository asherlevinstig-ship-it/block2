import { TAVERN_INN_SLEEP_POSITION, TAVERN_INN_WAKE_POSITION, TAVERN_REST_DURATION_MS } from "@blockcraft/protocol";
import { validateTownNpcInteraction } from "./town-npcs.js";

interface TavernRestPlayer {
  x: number; y: number; z: number; yaw: number;
  health: number; maxHealth: number; stamina: number; maxStamina: number;
  potionCooldownUntil: number; powerCooldownUntil: number; specialCooldownUntil: number;
  huntLoadoutsJson: string;
}

function recordFrom(source: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return Array.isArray(parsed) ? { loadouts: parsed } : {};
  } catch {
    return {};
  }
}

export function tavernReturnBound(source: string): boolean {
  return recordFrom(source).tavernReturn === true;
}

export function withTavernReturnBound(source: string): string {
  return JSON.stringify({ ...recordFrom(source), tavernReturn: true });
}

export function canUseTavernKeeperService(player: { x: number; y: number; z: number }): boolean {
  return validateTownNpcInteraction(player, "mara", "tavern", "tavern").ok;
}

export function tavernRestActive(sleepingUntil: number | undefined, now = Date.now()): boolean {
  return (sleepingUntil ?? 0) > now;
}

export function beginTavernRest(player: TavernRestPlayer, now = Date.now()): number {
  player.x = TAVERN_INN_SLEEP_POSITION.x; player.y = TAVERN_INN_SLEEP_POSITION.y;
  player.z = TAVERN_INN_SLEEP_POSITION.z; player.yaw = TAVERN_INN_SLEEP_POSITION.yaw;
  return now + TAVERN_REST_DURATION_MS;
}

export function wakeTavernRestEarly(player: TavernRestPlayer): void {
  player.x = TAVERN_INN_WAKE_POSITION.x; player.y = TAVERN_INN_WAKE_POSITION.y; player.z = TAVERN_INN_WAKE_POSITION.z;
}

export function completeTavernRest(player: TavernRestPlayer, sleepingUntil: number, now = Date.now()): boolean {
  if (sleepingUntil <= 0 || now < sleepingUntil) return false;
  wakeTavernRestEarly(player);
  player.health = player.maxHealth; player.stamina = player.maxStamina;
  player.potionCooldownUntil = 0; player.powerCooldownUntil = 0; player.specialCooldownUntil = 0;
  player.huntLoadoutsJson = withTavernReturnBound(player.huntLoadoutsJson);
  return true;
}
