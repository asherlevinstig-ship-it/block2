export interface RemoteSnapshot {
  x: number;
  y: number;
  z: number;
  receivedAt: number;
  yaw: number;
}

export interface SampledRemotePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export const REMOTE_INTERPOLATION_DELAY_MS = 100;

export interface MovementVector {
  x: number;
  z: number;
}

export function cameraRelativeMovement(
  strafe: number,
  forward: number,
  cameraOffsetX: number,
  cameraOffsetZ: number,
): MovementVector {
  const length = Math.hypot(cameraOffsetX, cameraOffsetZ) || 1;
  const forwardX = -cameraOffsetX / length;
  const forwardZ = -cameraOffsetZ / length;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const x = rightX * strafe + forwardX * forward;
  const z = rightZ * strafe + forwardZ * forward;
  const inputLength = Math.hypot(x, z);
  const scale = inputLength > 1 ? 1 / inputLength : 1;
  return { x: x * scale, z: z * scale };
}

export function quantizeMovementToEightDirections(movement: MovementVector, deadZone = 0.12): MovementVector {
  const magnitude = Math.min(1, Math.hypot(movement.x, movement.z));
  if (magnitude < deadZone) return { x: 0, z: 0 };
  const sector = Math.PI / 4;
  const angle = Math.round(Math.atan2(movement.z, movement.x) / sector) * sector;
  return { x: Math.cos(angle) * magnitude, z: Math.sin(angle) * magnitude };
}

export function approachMovement(
  current: MovementVector,
  target: MovementVector,
  deltaTime: number,
  acceleration = 6,
  deceleration = 10,
): MovementVector {
  const differenceX = target.x - current.x;
  const differenceZ = target.z - current.z;
  const distance = Math.hypot(differenceX, differenceZ);
  if (distance === 0) return target;
  const speedingUp = Math.hypot(target.x, target.z) > Math.hypot(current.x, current.z) + 0.001;
  const maximumChange = (speedingUp ? acceleration : deceleration) * deltaTime;
  if (distance <= maximumChange) return target;
  return {
    x: current.x + differenceX / distance * maximumChange,
    z: current.z + differenceZ / distance * maximumChange,
  };
}

export function movementYaw(strafe: number, forward: number, fallback: number): number {
  return Math.hypot(strafe, forward) < 0.01
    ? fallback
    : Math.atan2(strafe, forward) * 180 / Math.PI;
}

function lerpAngle(start: number, end: number, fraction: number): number {
  const delta = ((end - start + 540) % 360) - 180;
  return start + delta * fraction;
}

export function sampleRemotePose(snapshots: readonly RemoteSnapshot[], renderAt: number): SampledRemotePose | null {
  if (snapshots.length === 0) return null;
  const first = snapshots[0]!;
  if (renderAt <= first.receivedAt) return first;
  for (let index = 1; index < snapshots.length; index += 1) {
    const next = snapshots[index]!;
    if (renderAt > next.receivedAt) continue;
    const previous = snapshots[index - 1]!;
    const duration = next.receivedAt - previous.receivedAt;
    const fraction = duration <= 0 ? 1 : Math.max(0, Math.min(1, (renderAt - previous.receivedAt) / duration));
    return {
      x: previous.x + (next.x - previous.x) * fraction,
      y: previous.y + (next.y - previous.y) * fraction,
      z: previous.z + (next.z - previous.z) * fraction,
      yaw: lerpAngle(previous.yaw, next.yaw, fraction),
    };
  }
  return snapshots[snapshots.length - 1]!;
}

export function trimRemoteSnapshots(snapshots: RemoteSnapshot[], renderAt: number): void {
  while (snapshots.length > 2 && snapshots[1]!.receivedAt <= renderAt) snapshots.shift();
  if (snapshots.length > 20) snapshots.splice(0, snapshots.length - 20);
}
