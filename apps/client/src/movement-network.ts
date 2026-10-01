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
  const currentSpeed = Math.hypot(current.x, current.z);
  const targetSpeed = Math.hypot(target.x, target.z);
  const maximumSpeedChange = (targetSpeed > currentSpeed ? acceleration : deceleration) * deltaTime;
  const nextSpeed = Math.abs(targetSpeed - currentSpeed) <= maximumSpeedChange
    ? targetSpeed
    : currentSpeed + Math.sign(targetSpeed - currentSpeed) * maximumSpeedChange;

  if (nextSpeed <= 0.0001) return { x: 0, z: 0 };
  if (targetSpeed > 0.0001) {
    return { x: target.x / targetSpeed * nextSpeed, z: target.z / targetSpeed * nextSpeed };
  }
  return { x: current.x / currentSpeed * nextSpeed, z: current.z / currentSpeed * nextSpeed };
}

export function movementYaw(strafe: number, forward: number, fallback: number): number {
  return Math.hypot(strafe, forward) < 0.01
    ? fallback
    : Math.atan2(strafe, forward) * 180 / Math.PI;
}

export function approachYaw(current: number, target: number, deltaTime: number, turnSpeed = 720): number {
  const delta = ((target - current + 540) % 360) - 180;
  const maximumTurn = turnSpeed * deltaTime;
  if (Math.abs(delta) <= maximumTurn) return current + delta;
  return current + Math.sign(delta) * maximumTurn;
}

export function movementDirectionChanged(previous: MovementVector, next: MovementVector, dotThreshold = 0.98): boolean {
  const previousSpeed = Math.hypot(previous.x, previous.z);
  const nextSpeed = Math.hypot(next.x, next.z);
  if (previousSpeed < 0.01 || nextSpeed < 0.01) return previousSpeed < 0.01 !== nextSpeed < 0.01;
  const dot = (previous.x * next.x + previous.z * next.z) / (previousSpeed * nextSpeed);
  return dot < dotThreshold;
}

export function localReconciliationRate(
  distance: number,
  moving: boolean,
  sequenceLag = 0,
  authoritativeInputReady = true,
): number {
  if (!moving && !authoritativeInputReady) return 0;
  const boundedLag = Math.max(0, Math.min(12, sequenceLag));
  const hardCorrectionDistance = moving ? 2.5 + boundedLag * 0.4 : 3;
  if (distance > hardCorrectionDistance) return Number.POSITIVE_INFINITY;
  if (moving) return distance > 1.75 + boundedLag * 0.15 ? 0.75 : 0;
  return distance > 0.05 ? 8 : 0;
}

export function reconciliationVerticalTarget(
  localY: number,
  authoritativeY: number,
  grounded: boolean,
  groundedTolerance = 0.12,
): number {
  return grounded && Math.abs(authoritativeY - localY) <= groundedTolerance ? localY : authoritativeY;
}

export function smoothVerticalOffset(offset: number, deltaTime: number, response = 12): number {
  const next = offset * Math.exp(-response * Math.max(0, deltaTime));
  return Math.abs(next) < 0.001 ? 0 : next;
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
