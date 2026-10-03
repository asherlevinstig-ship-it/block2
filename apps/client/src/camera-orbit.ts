export type CameraOrbit = {
  yaw: number;
  pitch: number;
  yawSpeed: number;
  pitchSpeed: number;
};

const MIN_PITCH = Math.PI / 9;
const MAX_PITCH = Math.PI * 0.4;
const TURN_SPEED = Math.PI * 0.55;
const TILT_SPEED = Math.PI * 0.3;

export const CAMERA_DISTANCE = Math.hypot(16, 20, 16);

export function initialCameraOrbit(): CameraOrbit {
  return {
    yaw: Math.PI / 4,
    pitch: Math.atan2(20, Math.hypot(16, 16)),
    yawSpeed: 0,
    pitchSpeed: 0,
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
  };
}

export function cameraOrbitOffset(orbit: CameraOrbit): { x: number; y: number; z: number } {
  const horizontal = CAMERA_DISTANCE * Math.cos(orbit.pitch);
  return {
    x: horizontal * Math.cos(orbit.yaw),
    y: CAMERA_DISTANCE * Math.sin(orbit.pitch),
    z: horizontal * Math.sin(orbit.yaw),
  };
}
