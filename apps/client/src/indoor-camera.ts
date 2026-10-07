import { CAMERA_DISTANCE, type CameraOrbit } from "./camera-orbit.js";

const INDOOR_DISTANCE = 19;
const INDOOR_PITCH_LIFT = Math.PI / 12;
const MAX_INDOOR_PITCH = Math.PI * 0.43;

export function advanceIndoorCameraBlend(current: number, inside: boolean, dt: number): number {
  const target = inside ? 1 : 0;
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 5));
  return Math.abs(next - target) < 0.001 ? target : next;
}

export function indoorCameraOffset(orbit: CameraOrbit, blend: number): { x: number; y: number; z: number } {
  const amount = Math.max(0, Math.min(1, blend));
  const distance = CAMERA_DISTANCE + (INDOOR_DISTANCE - CAMERA_DISTANCE) * amount;
  const pitch = orbit.pitch + (Math.min(MAX_INDOOR_PITCH, orbit.pitch + INDOOR_PITCH_LIFT) - orbit.pitch) * amount;
  const horizontal = distance * Math.cos(pitch);
  return { x: horizontal * Math.cos(orbit.yaw), y: distance * Math.sin(pitch), z: horizontal * Math.sin(orbit.yaw) };
}
