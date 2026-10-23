export const FIRST_PERSON_EYE_HEIGHT = 1.48;
export const FIRST_PERSON_FOV = 68;
export const THIRD_PERSON_FOV = 42;

export const FIRST_PERSON_NEUTRAL_ORBIT_PITCH = Math.atan2(20, Math.hypot(16, 16));
const MIN_FIRST_PERSON_ELEVATION = -Math.PI / 9;
const MAX_FIRST_PERSON_ELEVATION = Math.PI / 6;

export type CameraViewMode = "third-person" | "first-person";

export function firstPersonLookDirection(cameraYaw: number, orbitPitch: number): { x: number; y: number; z: number } {
  const elevation = Math.max(MIN_FIRST_PERSON_ELEVATION,
    Math.min(MAX_FIRST_PERSON_ELEVATION, orbitPitch - FIRST_PERSON_NEUTRAL_ORBIT_PITCH));
  const horizontal = Math.cos(elevation);
  return {
    x: -Math.cos(cameraYaw) * horizontal,
    y: Math.sin(elevation),
    z: -Math.sin(cameraYaw) * horizontal,
  };
}

export function firstPersonFacingYaw(cameraYaw: number): number {
  const yaw = Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw)) * 180 / Math.PI;
  return (yaw + 360) % 360;
}
