import { TOWER_FLOOR_ONE, isInsideTowerFloorOne } from "./tower-floor-one.js";

export const PVP_MURDERER_DURATION_MS = 3 * 24 * 60 * 60 * 1_000;

export type PvpRoomKind = "overworld" | "silver-depths" | "practice" | "tavern";
export type PvpPosition = { x: number; z: number; health?: number };

export function pvpMurdererUntil(source: string): number {
  try {
    const value = (JSON.parse(source) as { murdererUntil?: unknown }).murdererUntil;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch { return 0; }
}

export function withPvpMurdererUntil(source: string, murdererUntil: number): string {
  let value: unknown;
  try { value = JSON.parse(source); } catch { value = {}; }
  const current = Array.isArray(value) ? { loadouts: value }
    : value && typeof value === "object" ? value as Record<string, unknown> : {};
  return JSON.stringify({ ...current, murdererUntil: Math.max(0, Math.floor(murdererUntil)) });
}

export function isTowerFloorSafeZone(position: PvpPosition): boolean {
  const safe = TOWER_FLOOR_ONE.sanctuary;
  return position.x >= safe.minX && position.x <= safe.maxX
    && position.z >= safe.minZ && position.z <= safe.maxZ;
}

/** Floor 0, taverns and each floor's authored sanctuary are protected. */
export function pvpEnabledAt(roomKind: PvpRoomKind, position: PvpPosition): boolean {
  return roomKind === "practice" && isInsideTowerFloorOne(position.x, position.z, 1)
    && !isTowerFloorSafeZone(position);
}

export function pvpCombatAllowed(roomKind: PvpRoomKind, attacker: PvpPosition, target: PvpPosition): boolean {
  return attacker !== target && (attacker.health ?? 1) > 0 && (target.health ?? 1) > 0
    && pvpEnabledAt(roomKind, attacker) && pvpEnabledAt(roomKind, target);
}

export interface PvpHit {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  mainHandId: string;
  damage: number;
  health: number;
  defeated: boolean;
  guarded: boolean;
  parried: boolean;
  dodged: boolean;
  murdererUntil: number;
}

export interface PvpKill {
  attackerId: string;
  attackerName: string;
  targetId: string;
  targetName: string;
  murdererUntil: number;
}
