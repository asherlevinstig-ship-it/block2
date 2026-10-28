import { mobProjectileWarningLane, mobVolleyOffsets } from "./enemy-projectiles.js";
export const SPITTER_PATTERN = { range: 10, travelMs: 1250, fanOffsets: [-30, -12, 12, 30], laneHalfWidth: .42 } as const;
export const CRYSTAL_BURST_OFFSETS = [-120, -60, 0, 60, 120, 180] as const;
export const VENOM_RING_OFFSETS = [-157.5, -112.5, -67.5, -22.5, 22.5, 67.5, 112.5, 157.5] as const;
export const spitterShotOffsets = (pattern: string): readonly number[] => pattern === "crystal-burst" || pattern === "teleport-burst" ? CRYSTAL_BURST_OFFSETS
  : pattern === "venom-ring" ? VENOM_RING_OFFSETS
  : pattern === "fan" || pattern === "double-fan" || pattern === "cross-volley" ? SPITTER_PATTERN.fanOffsets : [0];
export const MATRIARCH_PHASE = { volleyGapMs: 500, recoveryMs: 2600, crystalBurstWindupMs: 1400, crystalBurstRecoveryMs: 3000 } as const;
export const matriarchEnraged = (health: number, maxHealth: number) => health > 0 && health * 2 < maxHealth;
export const matriarchPattern = (sequence: number, enraged: boolean) => enraged && sequence % 2 === 1 ? "double-fan" : spitterPattern(sequence);
/** A six-way radial burst gives every party member a visible lane to dodge between. */
export const crystalMatriarchPattern = (sequence: number, enraged: boolean) => sequence % 3 === 1 ? "crystal-burst"
  : sequence % 3 === 2 && enraged ? "double-fan" : spitterPattern(sequence);
export const spitterPattern = (sequence: number): "aimed" | "fan" => sequence % 2 === 0 ? "aimed" : "fan";
/** The follow-up wave rotates clockwise/counter-clockwise on alternating casts, preserving readable escape gaps. */
export const matriarchSecondVolleyYaw = (yaw: number, sequence: number) => yaw + (sequence % 2 === 0 ? 22 : -22);
export function spitterShotEndpoints(start: { x: number; y: number; z: number }, yaw: number, pattern: string) {
  return spitterShotOffsets(pattern).map(offset => {
    const angle = (yaw + offset) * Math.PI / 180;
    return { x: start.x + Math.sin(angle) * SPITTER_PATTERN.range, y: start.y + .97, z: start.z + Math.cos(angle) * SPITTER_PATTERN.range };
  });
}
/** Independent warning strips, leaving the same open gaps as the actual volley. */
export function spitterWarningLanes(yaw: number, pattern: string, lengths?: readonly number[], fastWorld = false) {
  return mobVolleyOffsets(spitterShotOffsets(pattern), SPITTER_PATTERN.range, fastWorld).map((offset, index) => {
    const length = Math.max(0, Math.min(SPITTER_PATTERN.range, lengths?.[index] ?? SPITTER_PATTERN.range));
    return mobProjectileWarningLane(yaw + offset, length, SPITTER_PATTERN.laneHalfWidth, fastWorld);
  });
}
export function matriarchWarningLanes(yaw: number, sequence: number, firstLengths?: readonly number[], secondLengths?: readonly number[]) {
  return [
    ...spitterWarningLanes(yaw, "double-fan", firstLengths),
    ...spitterWarningLanes(matriarchSecondVolleyYaw(yaw, sequence), "double-fan", secondLengths),
  ];
}
