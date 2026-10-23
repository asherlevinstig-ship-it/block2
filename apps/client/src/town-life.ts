export type TownLifeRole = "guard" | "vendor" | "smith" | "healer" | "resident";

export interface TownLifeActorDefinition {
  id: string;
  role: TownLifeRole;
  start: readonly [number, number];
  end: readonly [number, number];
  speed: number;
  phase: number;
  facingYaw: number;
  coat: readonly [number, number, number];
  accent: readonly [number, number, number];
}

export interface TownLifeActorPose {
  x: number;
  z: number;
  yaw: number;
  stride: number;
  activity: number;
  moving: boolean;
}

/** Client-only town life. These routes deliberately avoid the well, pavilion,
 * buildings and server-owned collision footprints. They create movement and
 * role readability without adding network entities or simulation load. */
export const SPEED_LAB_TOWN_ACTORS: readonly TownLifeActorDefinition[] = [
  { id: "north-warden", role: "guard", start: [54, 100.5], end: [94, 100.5], speed: .075, phase: 0,
    facingYaw: 90, coat: [.12, .28, .48], accent: [.96, .68, .2] },
  { id: "south-warden", role: "guard", start: [94, 111.5], end: [54, 111.5], speed: .07, phase: .5,
    facingYaw: -90, coat: [.12, .28, .48], accent: [.96, .68, .2] },
  { id: "north-market-keeper", role: "vendor", start: [82.7, 92], end: [82.7, 92], speed: 0, phase: .1,
    facingYaw: 90, coat: [.54, .2, .12], accent: [.96, .72, .28] },
  { id: "south-market-keeper", role: "vendor", start: [82.7, 120], end: [82.7, 120], speed: 0, phase: .65,
    facingYaw: 90, coat: [.2, .42, .28], accent: [.92, .55, .18] },
  { id: "beginning-smith", role: "smith", start: [79, 136], end: [79, 136], speed: 0, phase: .3,
    facingYaw: 90, coat: [.34, .18, .08], accent: [.96, .45, .08] },
  { id: "town-healer", role: "healer", start: [51, 108.5], end: [51, 108.5], speed: 0, phase: .8,
    facingYaw: 90, coat: [.18, .5, .42], accent: [.45, 1, .78] },
  { id: "well-runner", role: "resident", start: [59, 96.5], end: [78, 96.5], speed: .055, phase: .25,
    facingYaw: 35, coat: [.42, .31, .5], accent: [.82, .68, .94] },
] as const;

export const SPEED_LAB_TOWN_LIGHTS: readonly (readonly [number, number, number])[] = [
  [58, 10.25, 96], [58, 10.25, 116], [76, 10.25, 96], [76, 10.25, 116],
] as const;

export type TownLandmarkKind = "hall" | "inn" | "smith" | "weaver" | "healer" | "barracks";

export interface TownLandmarkSign {
  id: string;
  kind: TownLandmarkKind;
  position: readonly [number, number, number];
  yaw: number;
}

/** Symbol signs face the roads rather than adding more permanent HUD text. */
export const SPEED_LAB_TOWN_SIGNS: readonly TownLandmarkSign[] = [
  { id: "founders-hall-sign", kind: "hall", position: [51, 8.15, 73], yaw: 0 },
  { id: "wayfarer-inn-sign", kind: "inn", position: [79, 8.15, 76], yaw: 0 },
  { id: "weavers-sign", kind: "weaver", position: [51, 8.15, 93.5], yaw: 0 },
  { id: "healer-sign", kind: "healer", position: [51, 8.15, 108.5], yaw: 0 },
  { id: "wardens-sign", kind: "barracks", position: [51, 8.15, 130], yaw: 0 },
  { id: "smith-sign", kind: "smith", position: [79, 8.15, 136.5], yaw: 0 },
] as const;

export function townLifeActorPose(definition: TownLifeActorDefinition, timeSeconds: number): TownLifeActorPose {
  const dx = definition.end[0] - definition.start[0];
  const dz = definition.end[1] - definition.start[1];
  const distance = Math.hypot(dx, dz);
  const moving = definition.speed > 0 && distance > .01;
  if (!moving) {
    const activityRate = definition.role === "smith" ? 3.8 : definition.role === "vendor" ? 1.4 : 1.8;
    return {
      x: definition.start[0], z: definition.start[1], yaw: definition.facingYaw, stride: 0, moving: false,
      activity: (Math.sin((timeSeconds + definition.phase * 4) * activityRate) + 1) / 2,
    };
  }
  const cycle = (timeSeconds * definition.speed + definition.phase) % 2;
  const outbound = cycle <= 1;
  const progress = outbound ? cycle : 2 - cycle;
  const direction = outbound ? 1 : -1;
  const yaw = Math.atan2(dx * direction, dz * direction) * 180 / Math.PI;
  return {
    x: definition.start[0] + dx * progress,
    z: definition.start[1] + dz * progress,
    yaw,
    stride: Math.sin(cycle * Math.PI * 8) * Math.min(1, distance * definition.speed),
    activity: (Math.sin(timeSeconds * 1.7 + definition.phase * Math.PI * 2) + 1) / 2,
    moving: true,
  };
}
