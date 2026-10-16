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
  maxSpeed = 7,
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
  const desired = {
    x: target.x - dx / distance * remaining,
    z: target.z - dz / distance * remaining,
  };
  // A dodge or delayed correction can move the target further than the usual
  // lag bound in one frame. Never teleport the camera to enforce that bound.
  const travel = Math.hypot(desired.x - current.x, desired.z - current.z);
  const limit = Math.max(0, dt) * maxSpeed;
  if (travel <= limit || travel === 0) return desired;
  return {
    x: current.x + (desired.x - current.x) * limit / travel,
    z: current.z + (desired.z - current.z) * limit / travel,
  };
}

/** Keep one-block steps from lifting the camera in a single frame. */
export function advanceCameraHeight(current: number, target: number, dt: number, maxSpeed = 5): number {
  if (!Number.isFinite(target)) return current;
  const distance = target - current;
  const travel = Math.min(Math.abs(distance), Math.max(0, dt) * maxSpeed);
  return current + Math.sign(distance) * travel;
}
