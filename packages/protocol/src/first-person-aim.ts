export const FIRST_PERSON_AIM_MIN = -Math.PI * 5 / 12;
export const FIRST_PERSON_AIM_MAX = Math.PI * 5 / 12;
export const AIM_EYE_HEIGHT = 1.48;
type Point = { x: number; y: number; z: number };

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
export function attackBodyIntersection(start: Point, end: Point, target: Point, radius = .38): number | null {
  let near = 0, far = 1;
  for (const axis of ["x", "y", "z"] as const) {
    const minimum = axis === "y" ? target.y + .05 : target[axis] - radius;
    const maximum = axis === "y" ? target.y + 1.4 : target[axis] + radius;
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
