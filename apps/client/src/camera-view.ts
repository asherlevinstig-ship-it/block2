import type { CameraOrbit } from "./camera-orbit.js";

export const FIRST_PERSON_EYE_HEIGHT = 1.48;
export const FIRST_PERSON_FOV = 68;
export const THIRD_PERSON_FOV = 42;

export const FIRST_PERSON_NEUTRAL_ORBIT_PITCH = Math.atan2(20, Math.hypot(16, 16));
const MIN_FIRST_PERSON_ELEVATION = -Math.PI / 9;
const MAX_FIRST_PERSON_ELEVATION = Math.PI / 6;
const FIRST_PERSON_MOUSE_YAW_RADIANS_PER_PIXEL = .0018;
const FIRST_PERSON_MOUSE_PITCH_RADIANS_PER_PIXEL = .0015;
// Pointer lock occasionally reports a very large synthetic movement when the
// cursor is captured, the tab regains focus, or the browser crosses a display.
// Treat those values as a single fast flick rather than allowing one event to
// spin the view several times.
const MAX_FIRST_PERSON_MOUSE_DELTA = 100;

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

export function firstPersonMouseLook(orbit: CameraOrbit, deltaX: number, deltaY: number): CameraOrbit {
  const minPitch = FIRST_PERSON_NEUTRAL_ORBIT_PITCH + MIN_FIRST_PERSON_ELEVATION;
  const maxPitch = FIRST_PERSON_NEUTRAL_ORBIT_PITCH + MAX_FIRST_PERSON_ELEVATION;
  const safeDeltaX = Math.max(-MAX_FIRST_PERSON_MOUSE_DELTA,
    Math.min(MAX_FIRST_PERSON_MOUSE_DELTA, Number.isFinite(deltaX) ? deltaX : 0));
  const safeDeltaY = Math.max(-MAX_FIRST_PERSON_MOUSE_DELTA,
    Math.min(MAX_FIRST_PERSON_MOUSE_DELTA, Number.isFinite(deltaY) ? deltaY : 0));
  const currentYaw = Number.isFinite(orbit.yaw) ? orbit.yaw : 0;
  const currentPitch = Number.isFinite(orbit.pitch) ? orbit.pitch : FIRST_PERSON_NEUTRAL_ORBIT_PITCH;
  const unwrappedYaw = currentYaw + safeDeltaX * FIRST_PERSON_MOUSE_YAW_RADIANS_PER_PIXEL;
  return {
    ...orbit,
    // Keeping yaw in a small range prevents precision loss during long play
    // sessions without introducing a visible seam at a full rotation.
    yaw: Math.atan2(Math.sin(unwrappedYaw), Math.cos(unwrappedYaw)),
    pitch: Math.max(minPitch, Math.min(maxPitch,
      currentPitch - safeDeltaY * FIRST_PERSON_MOUSE_PITCH_RADIANS_PER_PIXEL)),
    yawSpeed: 0,
    pitchSpeed: 0,
  };
}
