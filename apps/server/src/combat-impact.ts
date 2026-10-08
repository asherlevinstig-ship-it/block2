import { voxelRaycast, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import { sampleMeleeStrike, type MeleeStrikeProfile, type MainHandId } from "@blockcraft/protocol";

/** Sample the blade's swept contact window, not a range/facing cone. */
export function meleeSweepImpact(origin: Position, yaw: number, profile: MeleeStrikeProfile,
  from: number, to: number, targets: readonly ProjectileTarget[], read: WorldBlockReader): string | null {
  const visible = targets.filter(target => hasCombatLineOfSight(origin, target, read))
    .map(target => ({ ...target, radius: (target.radius ?? 0.38) + profile.radius }));
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) * 32));
  for (let i = 0; i <= steps; i++) {
    const blade = sampleMeleeStrike(origin, yaw, profile, from + (to - from) * i / steps);
    const impact = projectileImpact(blade.base, blade.tip, visible, read);
    if (impact?.kind === "entity") return impact.targetId ?? null;
  }
  return null;
}

export const STAGGER_IMMUNITY_MS = 800;
export const bodyPoint = (pose: Position): Position => ({ x: pose.x, y: pose.y + 0.72, z: pose.z });
export const flightPoint = (start: Position, end: Position, fraction: number): Position => ({
  x: start.x + (end.x - start.x) * fraction,
  y: start.y + (end.y - start.y) * fraction,
  z: start.z + (end.z - start.z) * fraction,
});

export function terrainImpact(start: Position, end: Position, read: WorldBlockReader): { fraction: number; point: Position } | null {
  const delta = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 0.00001) return null;
  const hit = voxelRaycast(start, delta, length, read);
  return hit ? { fraction: hit.distance / length, point: flightPoint(start, end, hit.distance / length) } : null;
}

export function hasCombatLineOfSight(origin: Position, target: Position, read: WorldBlockReader): boolean {
  return terrainImpact(bodyPoint(origin), bodyPoint(target), read) === null;
}

export interface ProjectileTarget extends Position { id: string; radius?: number }
/** Swept segment vs body AABB: a fast projectile cannot skip a target between ticks. */
export function projectileImpact(start: Position, end: Position, targets: readonly ProjectileTarget[], read: WorldBlockReader):
  { kind: "terrain" | "entity"; point: Position; targetId?: string; fraction: number } | null {
  const terrain = terrainImpact(start, end, read);
  let result: ReturnType<typeof projectileImpact> = terrain ? { kind: "terrain", ...terrain } : null;
  for (const target of targets) {
    const radius = target.radius ?? 0.38;
    let near = 0;
    let far = 1;
    for (const axis of ["x", "y", "z"] as const) {
      const minimum = axis === "y" ? target.y + 0.05 : target[axis] - radius;
      const maximum = axis === "y" ? target.y + 1.4 : target[axis] + radius;
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) < 0.000001) {
        if (start[axis] < minimum || start[axis] > maximum) { far = -1; break; }
      } else {
        const a = (minimum - start[axis]) / delta;
        const b = (maximum - start[axis]) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (near > far || far < 0 || near > 1 || (result && near >= result.fraction)) continue;
    result = { kind: "entity", targetId: target.id, fraction: near, point: flightPoint(start, end, near) };
  }
  return result;
}

export function isInsideCommittedArc(origin: Position, target: Position, yaw: number, minimumDot = 0.65): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.0001) return true;
  const radians = yaw * Math.PI / 180;
  return (Math.sin(radians) * dx + Math.cos(radians) * dz) / length >= minimumDot;
}

export function basicStaggerDuration(mainHandId: MainHandId, step: number, archetype: string, state: string): number {
  if (state !== "windup") return 0;
  if (mainHandId === "stone_core_hammer") return archetype === "stone_brute" ? 450 : 850;
  if ((mainHandId === "longsword" || mainHandId === "fang_dagger") && step === 3 && archetype !== "stone_brute") return 650;
  return 0;
}
