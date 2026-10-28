import { voxelRaycast, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import { sampleMeleeStrike, attackBodyIntersection, type MeleeStrikeProfile, type MainHandId } from "@blockcraft/protocol";

/** Sample the blade's swept contact window, not a range/facing cone. */
export function meleeSweepImpact(origin: Position, yaw: number, profile: MeleeStrikeProfile,
  from: number, to: number, targets: readonly ProjectileTarget[], read: WorldBlockReader, elevation?: number): string | null {
  const visible = targets.filter(target => hasCombatLineOfSight(origin, target, read))
    .map(target => ({ ...target, radius: (target.radius ?? 0.38) + profile.radius }));
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) * 32));
  for (let i = 0; i <= steps; i++) {
    const blade = sampleMeleeStrike(origin, yaw, profile, from + (to - from) * i / steps);
    if (elevation !== undefined) {
      const radians = yaw * Math.PI / 180;
      const pitchPoint = (point: Position): void => {
        const dx = point.x - origin.x, dz = point.z - origin.z;
        const forward = dx * Math.sin(radians) + dz * Math.cos(radians);
        const side = dx * Math.cos(radians) - dz * Math.sin(radians);
        const height = point.y - origin.y - 1.05;
        const reach = forward * Math.cos(elevation) - height * Math.sin(elevation);
        point.x = origin.x + reach * Math.sin(radians) + side * Math.cos(radians);
        point.z = origin.z + reach * Math.cos(radians) - side * Math.sin(radians);
        point.y = origin.y + 1.05 + forward * Math.sin(elevation) + height * Math.cos(elevation);
      };
      pitchPoint(blade.base); pitchPoint(blade.tip);
    }
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
    const near = attackBodyIntersection(start, end, target, target.radius);
    if (near === null || (result && near >= result.fraction)) continue;
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

export function basicStaggerDuration(mainHandId: MainHandId, step: number, archetype: string, state: string, isChampion = false): number {
  if (state !== "windup") return 0;
  if (mainHandId === "rootbound_hammer") return step === 3 ? (archetype === "stone_brute" || isChampion ? 750 : 1050) : 0;
  if (mainHandId === "stone_core_hammer") return archetype === "stone_brute" ? 450 : 850;
  if ((mainHandId === "longsword" || mainHandId === "forged_sword" || mainHandId === "fang_dagger" || mainHandId === "matriarch_edge") && step === 3 && archetype !== "stone_brute") return 650;
  return 0;
}
