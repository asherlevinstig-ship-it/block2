export const FIRST_PERSON_AIM_MIN = -Math.PI * 5 / 12;
export const FIRST_PERSON_AIM_MAX = Math.PI * 5 / 12;
export const AIM_EYE_HEIGHT = 1.48;
type Point = { x: number; y: number; z: number };
export interface AttackBodyBox extends Point { width: number; height: number; depth: number }
export interface AttackBodyTarget extends Point { body?: readonly AttackBodyBox[]; yaw?: number; bodyPadding?: number }

export function aimedAttackDirection(yawDegrees: number, elevation: number): Point {
  const pitch = Math.max(FIRST_PERSON_AIM_MIN, Math.min(FIRST_PERSON_AIM_MAX, elevation));
  const yaw = yawDegrees * Math.PI / 180, horizontal = Math.cos(pitch);
  return { x: Math.sin(yaw) * horizontal, y: Math.sin(pitch), z: Math.cos(yaw) * horizontal };
}

/** Position and range come from authority; the request supplies direction only. */
export function aimedWeaponFlight(position: Point, yaw: number, elevation: number, range: number) {
  const direction = aimedAttackDirection(yaw, elevation);
  const origin = { x: position.x, y: position.y + AIM_EYE_HEIGHT, z: position.z };
  const end = { x: origin.x + direction.x * range, y: origin.y + direction.y * range, z: origin.z + direction.z * range };
  return { origin, end };
}

/** Shared swept segment vs the same body volume used for authoritative hits. */
export function attackBodyIntersection(start: Point, end: Point, target: AttackBodyTarget, radius = .38): number | null {
  if (target.body) {
    const yaw = (target.yaw ?? 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    const local = (p: Point): Point => ({ x: (p.x - target.x) * c - (p.z - target.z) * s,
      y: p.y - target.y, z: (p.x - target.x) * s + (p.z - target.z) * c });
    const a = local(start), b = local(end), padding = target.bodyPadding ?? 0;
    let nearest: number | null = null;
    for (const shape of target.body) {
      const hit = segmentBox(a, b, { x: shape.x - shape.width / 2 - padding, y: shape.y - shape.height / 2 - padding, z: shape.z - shape.depth / 2 - padding },
        { x: shape.x + shape.width / 2 + padding, y: shape.y + shape.height / 2 + padding, z: shape.z + shape.depth / 2 + padding });
      if (hit !== null && (nearest === null || hit < nearest)) nearest = hit;
    }
    return nearest;
  }
  return segmentBox(start, end, { x: target.x - radius, y: target.y + .05, z: target.z - radius },
    { x: target.x + radius, y: target.y + 1.4, z: target.z + radius });
}

function segmentBox(start: Point, end: Point, min: Point, max: Point): number | null {
  let near = 0, far = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const minimum = min[axis], maximum = max[axis];
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < .000001) {
      if (start[axis] < minimum || start[axis] > maximum) return null;
    } else {
      const a = (minimum - start[axis]) / delta, b = (maximum - start[axis]) / delta;
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    }
  }
  return near > far || far < 0 || near > 1 ? null : near;
}
