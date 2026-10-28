import { FAST_WORLD_TOWN_BOUNDS, RAPID_PRACTICE_ARENA, TOWER_FLOOR_ONE } from "@blockcraft/protocol";
import type { CameraOrbit } from "./camera-orbit.js";
import { FIRST_PERSON_NEUTRAL_ORBIT_PITCH, type CameraViewMode } from "./camera-view.js";

export interface PortalArrival {
  title: string;
  detail: string;
  cameraYaw: number;
}

/** Only known arrivals in the current tower game receive an authored view. */
export function towerPortalArrival(position: { x: number; y: number; z: number }): PortalArrival | null {
  const near = (point: { x: number; y: number; z: number }) =>
    Math.hypot(position.x - point.x, position.y - point.y, position.z - point.z) < 8;
  if (near(TOWER_FLOOR_ONE.entry)) return {
    title: TOWER_FLOOR_ONE.name,
    detail: "Sanctuary · SAFE · Follow the causeway ahead to the first court. Return portal behind you.",
    cameraYaw: Math.PI,
  };
  if (near(RAPID_PRACTICE_ARENA.spawn)) {
    const plazaX = (FAST_WORLD_TOWN_BOUNDS.minX + FAST_WORLD_TOWN_BOUNDS.maxX) / 2;
    const plazaZ = (FAST_WORLD_TOWN_BOUNDS.minZ + FAST_WORLD_TOWN_BOUNDS.maxZ) / 2;
    return {
      title: "Town of Beginnings",
      detail: "Safe sanctuary · The town plaza is ahead. Tower portal behind you.",
      cameraYaw: Math.atan2(position.z - plazaZ, position.x - plazaX),
    };
  }
  return null;
}

export function portalArrivalOrbit(orbit: CameraOrbit, arrival: PortalArrival, mode: CameraViewMode): CameraOrbit {
  return { ...orbit, yaw: arrival.cameraYaw, yawSpeed: 0, pitchSpeed: 0,
    pitch: mode === "first-person" ? FIRST_PERSON_NEUTRAL_ORBIT_PITCH : Math.PI * .4 };
}
