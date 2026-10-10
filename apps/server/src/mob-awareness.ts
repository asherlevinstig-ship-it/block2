import type { Combatant } from "./combat-rules.js";
import type { Position } from "./action-rules.js";
export const MOB_MEMORY_MS = 3000;
export interface MobAwareness { targetId: string; lastSeen: Position | null; seenAt: number }
export const createMobAwareness = (): MobAwareness => ({ targetId: "", lastSeen: null, seenAt: 0 });
export function awareMobTarget(mob: Position, players: readonly Combatant[], state: MobAwareness,
  now: number, range: number, visible: (target: Combatant) => boolean): (Combatant & { visible: boolean }) | null {
  const eligible = (p: Combatant, limit: number) => p.health > 0 && Math.abs(p.y - mob.y) <= 1.75 && Math.hypot(p.x - mob.x, p.z - mob.z) <= limit;
  const current = players.find(p => p.id === state.targetId);
  if (current && eligible(current, range + 2)) {
    if (visible(current)) {
      state.lastSeen = { x: current.x, y: current.y, z: current.z }; state.seenAt = now;
      return { ...current, visible: true };
    }
    if (state.lastSeen && now - state.seenAt < MOB_MEMORY_MS) return { ...state.lastSeen, id: current.id, health: current.health, visible: false };
  }
  state.targetId = ""; state.lastSeen = null;
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
