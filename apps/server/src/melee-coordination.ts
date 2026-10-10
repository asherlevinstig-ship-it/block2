import type { Position } from "./action-rules.js";
export const MELEE_ATTACK_SLOTS = 2;
export interface CoordinatedMob { id: string; alive: boolean; health: number; archetype: string; combatState: string; targetId: string }
/** Derive slots from authoritative actions: death, interruption and recovery release immediately. */
export function meleeSlotsFull(targetId: string, mobs: readonly CoordinatedMob[]): boolean {
  return mobs.filter(mob => mob.alive && mob.health > 0 && mob.archetype !== "cave_spitter"
    && mob.targetId === targetId && (mob.combatState === "windup" || mob.combatState === "strike")).length >= MELEE_ATTACK_SLOTS;
}
/** Stable, distinct waiting sectors; navigation still enforces terrain and personal space. */
export function meleeWaitingGoal(id: string, target: Position, peers: readonly string[], radius: number): Position {
  const ids = [...new Set([...peers, id])].sort();
  const angle = ids.indexOf(id) * Math.PI * 2 / Math.max(3, ids.length);
  return { x: target.x + Math.sin(angle) * radius, y: target.y, z: target.z + Math.cos(angle) * radius };
}
