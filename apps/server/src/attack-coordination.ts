import { Block } from "@blockcraft/voxel-world";
import { bodyPoint, projectileImpact } from "./combat-impact.js";
type Point = { x: number; y: number; z: number };
export const ATTACK_START_GAP_MS = 650;
export const ATTACK_RELEASE_GAP_MS = 900;
interface Reservation extends Point { id: string; targetId: string; startedAt: number; releaseAt: number }
/** Local, per-target pacing. A different fight or floor never waits on a global cooldown. */
export class AttackCoordination {
  private readonly reservations = new Map<string, Reservation>();
  canStart(id: string, targetId: string, origin: Point, now: number, releaseAt: number,
    active: (id: string, startedAt: number) => boolean): boolean {
    for (const [key, peer] of this.reservations) {
      if (now > peer.releaseAt + ATTACK_RELEASE_GAP_MS || !active(key, peer.startedAt)) {
        this.reservations.delete(key); continue;
      }
      if (key === id || peer.targetId !== targetId || Math.abs(peer.y - origin.y) > 1.75
        || Math.hypot(peer.x - origin.x, peer.z - origin.z) > 12) continue;
      if (now - peer.startedAt < ATTACK_START_GAP_MS || Math.abs(releaseAt - peer.releaseAt) < ATTACK_RELEASE_GAP_MS) return false;
    }
    return true;
  }
  started(id: string, targetId: string, origin: Point, now: number, releaseAt: number): void {
    this.reservations.set(id, { id, targetId, ...origin, startedAt: now, releaseAt });
  }
}
/** Allies block the central sight lane; reposition instead of firing through their body. */
export function allyFireLaneClear(id: string, origin: Point, aim: Point,
  allies: readonly (Point & { id: string; alive: boolean; archetype: string })[]): boolean {
  return !projectileImpact(bodyPoint(origin), bodyPoint(aim), allies.filter(ally => ally.id !== id && ally.alive)
    .map(ally => ({ ...ally, radius: ally.archetype === "stone_brute" ? .55 : .38 })), () => Block.Air);
}
