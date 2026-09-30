export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export interface RemoteSnapshot extends Position3 {
  receivedAt: number;
  yaw: number;
}

export interface SampledRemotePose extends Position3 {
  yaw: number;
}

export const REMOTE_INTERPOLATION_DELAY_MS = 100;

export function movementYaw(strafe: number, forward: number, fallback: number): number {
  return Math.hypot(strafe, forward) < 0.01
    ? fallback
    : Math.atan2(strafe, forward) * 180 / Math.PI;
}

export function predictionError(authoritative: Position3, predictedAtAcknowledgement: Position3): Position3 {
  return {
    x: authoritative.x - predictedAtAcknowledgement.x,
    y: authoritative.y - predictedAtAcknowledgement.y,
    z: authoritative.z - predictedAtAcknowledgement.z,
  };
}

export function positionDistance(position: Position3): number {
  return Math.hypot(position.x, position.y, position.z);
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
