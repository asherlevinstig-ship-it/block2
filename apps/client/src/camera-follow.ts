export interface CameraFollowPoint {
  x: number;
  z: number;
}

/** Ignore tiny horizontal corrections, but never let the camera drift far
 * enough behind the player to feel floaty. Height is handled separately. */
export function advanceCameraFollow(
  current: CameraFollowPoint,
  target: CameraFollowPoint,
  dt: number,
  deadZone = 0.08,
  maxLag = 0.28,
): CameraFollowPoint {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance === 0) return { ...target };
  const allowedLag = Math.max(deadZone, maxLag);
  const boundedDistance = Math.min(distance, allowedLag);
  const startX = target.x - dx / distance * boundedDistance;
  const startZ = target.z - dz / distance * boundedDistance;
  if (boundedDistance <= deadZone) return { x: startX, z: startZ };
  const catchup = 1 - Math.exp(-Math.max(0, dt) * 24);
  const remaining = deadZone + (boundedDistance - deadZone) * (1 - catchup);
  return {
    x: target.x - dx / distance * remaining,
    z: target.z - dz / distance * remaining,
  };
}
