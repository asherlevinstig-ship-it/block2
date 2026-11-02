import type { Combatant } from "./combat-rules.js";
import type { Position } from "./action-rules.js";
export const MOB_MEMORY_MS = 3000;
/**
 * A projectile can legitimately connect across terraces that are taller than
 * passive sight acquisition permits.  Once struck, the victim may retain that
 * attacker across one authored elevation change; encounter bounds still stop
 * mobs from pulling between floors or rooms.
 */
export const PROVOKED_ELEVATION_RANGE = 5.5;
export interface MobAwareness { targetId: string; lastSeen: Position | null; seenAt: number; provokedUntil?: number }
export const createMobAwareness = (): MobAwareness => ({ targetId: "", lastSeen: null, seenAt: 0 });
/** A real hit alerts the victim, even beyond its passive detection radius. */
export function provokeMob(state: MobAwareness, attacker: Combatant, now: number): void {
  state.targetId = attacker.id;
  state.lastSeen = { x: attacker.x, y: attacker.y, z: attacker.z };
  state.seenAt = now;
  state.provokedUntil = now + 10_000;
}
export function awareMobTarget(mob: Position, players: readonly Combatant[], state: MobAwareness,
  now: number, range: number, visible: (target: Combatant) => boolean): (Combatant & { visible: boolean }) | null {
  const eligible = (p: Combatant, limit: number, elevation = 1.75) => p.health > 0
    && Math.abs(p.y - mob.y) <= elevation && Math.hypot(p.x - mob.x, p.z - mob.z) <= limit;
  const current = players.find(p => p.id === state.targetId);
  const provoked = now < (state.provokedUntil ?? 0);
  // A player who has already attacked cannot drop aggro merely by taking one
  // step beyond passive detection. Encounter geometry still supplies the hard
  // pursuit boundary, so this does not permit cross-room pulling.
  if (current && eligible(current, provoked ? Math.max(18, range + 8) : range + 2,
    provoked ? PROVOKED_ELEVATION_RANGE : 1.75)) {
    if (visible(current)) {
      state.lastSeen = { x: current.x, y: current.y, z: current.z }; state.seenAt = now;
      return { ...current, visible: true };
    }
    if (state.lastSeen && now - state.seenAt < MOB_MEMORY_MS) return { ...state.lastSeen, id: current.id, health: current.health, visible: false };
  }
  state.targetId = ""; state.lastSeen = null; state.provokedUntil = 0;
  let nearest: Combatant | null = null; let distance = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - mob.x, p.z - mob.z);
    if (!eligible(p, range) || d >= distance || !visible(p)) continue;
    nearest = p; distance = d;
  }
  if (!nearest) return null;
  state.targetId = nearest.id; state.lastSeen = { x: nearest.x, y: nearest.y, z: nearest.z }; state.seenAt = now;
  return { ...nearest, visible: true };
}
