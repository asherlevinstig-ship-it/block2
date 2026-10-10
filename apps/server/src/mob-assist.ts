import type { Position } from "./action-rules.js";
export const MOB_ASSIST_RADIUS = 5;
export const MOB_ASSIST_LIMIT = 3;
export const MOB_ASSIST_COOLDOWN_MS = 1500;
export interface AssistCandidate extends Position { id: string; alive: boolean; health: number; available: boolean }
/** A hit recruits only direct witnesses. Recruited allies never broadcast another alert. */
export function mobAssistants(victimId: string, victim: Position, candidates: readonly AssistCandidate[],
  permitted: (candidate: AssistCandidate) => boolean): AssistCandidate[] {
  return candidates.filter(candidate => candidate.id !== victimId && candidate.alive && candidate.health > 0 && candidate.available
    && Math.abs(candidate.y - victim.y) <= 1.25
    && Math.hypot(candidate.x - victim.x, candidate.z - victim.z) <= MOB_ASSIST_RADIUS && permitted(candidate))
    .sort((a, b) => Math.hypot(a.x - victim.x, a.z - victim.z) - Math.hypot(b.x - victim.x, b.z - victim.z) || a.id.localeCompare(b.id))
    .slice(0, MOB_ASSIST_LIMIT);
}
