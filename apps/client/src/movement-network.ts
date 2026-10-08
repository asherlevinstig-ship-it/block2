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
  acceleration = 16,
  deceleration = 22,
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
  authoritativeAgeMs = 0,
): number {
  if (!moving && !authoritativeInputReady) return 0;
  const boundedLag = Math.max(0, Math.min(12, sequenceLag));
  const hardCorrectionDistance = moving ? 2.5 + boundedLag * 0.4 : 3;
  if (distance > hardCorrectionDistance) return Number.POSITIVE_INFINITY;
  if (moving) {
    // Each outstanding 50 ms input represents about .21 m of normal travel.
    // Allow .25 m including speed bonuses; older snapshots must not act like
    // ground friction. Large invalid divergences still use the hard bound above.
    if (authoritativeAgeMs > 200) return 0;
    return distance > 1.75 + boundedLag * 0.25 ? 0.75 : 0;
  }
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

/** Keep an idle avatar visually planted while a small server stop correction settles. */
export function smoothNetworkVisualOffset(
  offset: MovementVector,
  correction: MovementVector,
  moving: boolean,
  deltaTime: number,
  maximumOffset = 0.6,
): MovementVector {
  if (moving) {
    const decay = Math.exp(-12 * Math.max(0, deltaTime));
    return {
      x: Math.abs(offset.x * decay) < 0.001 ? 0 : offset.x * decay,
      z: Math.abs(offset.z * decay) < 0.001 ? 0 : offset.z * decay,
    };
  }
  const x = offset.x + correction.x;
  const z = offset.z + correction.z;
  const length = Math.hypot(x, z);
  const scale = length > maximumOffset ? maximumOffset / length : 1;
  return { x: x * scale, z: z * scale };
}

function lerpAngle(start: number, end: number, fraction: number): number {
  const delta = ((end - start + 540) % 360) - 180;
  return start + delta * fraction;
}

export function sampleRemotePose(
  snapshots: readonly RemoteSnapshot[],
  renderAt: number,
  maxExtrapolationMs = 0,
  maxExtrapolationSpeed = Number.POSITIVE_INFINITY,
): SampledRemotePose | null {
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
  const last = snapshots[snapshots.length - 1]!;
  if (maxExtrapolationMs <= 0 || snapshots.length < 2 || renderAt <= last.receivedAt) return last;
  const previous = snapshots[snapshots.length - 2]!;
  const sampleDuration = last.receivedAt - previous.receivedAt;
  if (sampleDuration <= 0) return last;
  const extrapolationMs = Math.min(maxExtrapolationMs, renderAt - last.receivedAt);
  const velocityX = (last.x - previous.x) / sampleDuration;
  const velocityZ = (last.z - previous.z) / sampleDuration;
  const speed = Math.hypot(velocityX, velocityZ) * 1000;
  const speedScale = speed > maxExtrapolationSpeed ? maxExtrapolationSpeed / speed : 1;
  return {
    x: last.x + velocityX * extrapolationMs * speedScale,
    y: last.y,
    z: last.z + velocityZ * extrapolationMs * speedScale,
    yaw: last.yaw,
  };
}

export function trimRemoteSnapshots(snapshots: RemoteSnapshot[], renderAt: number): void {
  while (snapshots.length > 2 && snapshots[1]!.receivedAt <= renderAt) snapshots.shift();
  if (snapshots.length > 20) snapshots.splice(0, snapshots.length - 20);
}
