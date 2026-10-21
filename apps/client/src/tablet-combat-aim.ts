export interface TabletAimCandidate {
  id: string;
  x: number;
  z: number;
  visible: boolean;
}

export interface TabletAimTarget extends TabletAimCandidate {
  distance: number;
  angle: number;
}

function signedAngleDelta(target: number, facing: number): number {
  return ((target - facing + 540) % 360) - 180;
}

/** Selects a nearby visible enemy in front of the character. Distance only
 * breaks ties after directional intent, so assistance never pulls sideways. */
export function tabletSoftTarget(
  player: { x: number; z: number },
  facingYaw: number,
  maximumRange: number,
  candidates: TabletAimCandidate[],
  halfConeDegrees = 58,
): TabletAimTarget | null {
  let selected: TabletAimTarget | null = null;
  let selectedScore = Infinity;
  for (const candidate of candidates) {
    if (!candidate.visible) continue;
    const dx = candidate.x - player.x;
    const dz = candidate.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .01 || distance > maximumRange) continue;
    const yaw = Math.atan2(dx, dz) * 180 / Math.PI;
    const angle = Math.abs(signedAngleDelta(yaw, facingYaw));
    if (angle > halfConeDegrees) continue;
    const score = angle / halfConeDegrees * .72 + distance / maximumRange * .28;
    if (score >= selectedScore) continue;
    selectedScore = score;
    selected = { ...candidate, distance, angle };
  }
  return selected;
}

/** Maps a thumb drag to the same camera-relative plane used by movement. */
export function tabletDragAimYaw(
  deltaX: number,
  deltaY: number,
  cameraOffsetX: number,
  cameraOffsetZ: number,
  fallbackYaw: number,
  deadZone = 12,
): number {
  if (Math.hypot(deltaX, deltaY) < deadZone) return fallbackYaw;
  const cameraLength = Math.hypot(cameraOffsetX, cameraOffsetZ) || 1;
  const forwardX = -cameraOffsetX / cameraLength;
  const forwardZ = -cameraOffsetZ / cameraLength;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const x = rightX * deltaX + forwardX * -deltaY;
  const z = rightZ * deltaX + forwardZ * -deltaY;
  return Math.atan2(x, z) * 180 / Math.PI;
}
