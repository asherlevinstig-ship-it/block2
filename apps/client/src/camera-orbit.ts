export type CameraOrbit = {
  yaw: number;
  pitch: number;
  yawSpeed: number;
  pitchSpeed: number;
  distance: number;
};

const MIN_PITCH = Math.PI / 9;
const MAX_PITCH = Math.PI * 0.4;
const TURN_SPEED = Math.PI * 0.55;
const TILT_SPEED = Math.PI * 0.3;
const TOUCH_YAW_RADIANS_PER_PIXEL = 0.006;
const TOUCH_PITCH_RADIANS_PER_PIXEL = 0.004;

export const CAMERA_DISTANCE = Math.hypot(16, 20, 16);
export const MIN_CAMERA_DISTANCE = 21;
export const MAX_CAMERA_DISTANCE = 39;

export function clampCameraDistance(distance: number): number {
  return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distance));
}

export function initialCameraOrbit(distance = CAMERA_DISTANCE): CameraOrbit {
  return {
    yaw: Math.PI / 4,
    pitch: Math.atan2(20, Math.hypot(16, 16)),
    yawSpeed: 0,
    pitchSpeed: 0,
    distance: clampCameraDistance(distance),
  };
}

export function advanceCameraOrbit(orbit: CameraOrbit, turn: number, tilt: number, dt: number): CameraOrbit {
  const blend = 1 - Math.exp(-dt * 14);
  const yawSpeed = orbit.yawSpeed + (turn * TURN_SPEED - orbit.yawSpeed) * blend;
  const pitchSpeed = orbit.pitchSpeed + (tilt * TILT_SPEED - orbit.pitchSpeed) * blend;
  const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, orbit.pitch + pitchSpeed * dt));
  return {
    yaw: orbit.yaw + yawSpeed * dt,
    pitch,
    yawSpeed,
    pitchSpeed: (pitch === MIN_PITCH && pitchSpeed < 0) || (pitch === MAX_PITCH && pitchSpeed > 0) ? 0 : pitchSpeed,
    distance: orbit.distance,
  };
}

export function dragCameraOrbit(orbit: CameraOrbit, deltaX: number, deltaY: number, elapsedMs = 16): CameraOrbit {
  const elapsed = Math.max(.008, Math.min(.05, elapsedMs / 1_000));
  const yawDelta = -deltaX * TOUCH_YAW_RADIANS_PER_PIXEL;
  const pitchDelta = deltaY * TOUCH_PITCH_RADIANS_PER_PIXEL;
  const momentum = .22;
  return {
    yaw: orbit.yaw + yawDelta,
    pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, orbit.pitch + pitchDelta)),
    yawSpeed: Math.max(-2.4, Math.min(2.4, yawDelta / elapsed * momentum)),
    pitchSpeed: Math.max(-1.5, Math.min(1.5, pitchDelta / elapsed * momentum)),
    distance: orbit.distance,
  };
}

export function pinchCameraOrbit(orbit: CameraOrbit, previousSpan: number, currentSpan: number): CameraOrbit {
  if (previousSpan <= 0 || currentSpan <= 0) return orbit;
  return {
    ...orbit,
    distance: clampCameraDistance(orbit.distance * previousSpan / currentSpan),
    yawSpeed: 0,
    pitchSpeed: 0,
  };
}

export function cameraOrbitOffset(orbit: CameraOrbit): { x: number; y: number; z: number } {
  const horizontal = orbit.distance * Math.cos(orbit.pitch);
  return {
    x: horizontal * Math.cos(orbit.yaw),
    y: orbit.distance * Math.sin(orbit.pitch),
    z: horizontal * Math.sin(orbit.yaw),
  };
}
