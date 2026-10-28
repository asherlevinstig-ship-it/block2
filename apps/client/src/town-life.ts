import { FAST_WORLD_BLACKSMITH_POSITION } from "@blockcraft/protocol";
export type TownLifeRole = "guard" | "vendor" | "smith" | "healer" | "resident";

export interface TownLifeActorDefinition {
  id: string;
  role: TownLifeRole;
  route: readonly (readonly [number, number])[];
  moveSpeed: number;
  pauseSeconds: number;
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
  motion: "idle" | "walk" | "work";
  turn: number;
}

/** Client-only town life. These routes deliberately avoid the well, pavilion,
 * buildings and server-owned collision footprints. They create movement and
 * role readability without adding network entities or simulation load. */
export const SPEED_LAB_TOWN_ACTORS: readonly TownLifeActorDefinition[] = [
  { id: "north-warden", role: "guard", route: [[54, 100.5], [82, 100.5], [94, 103.5]], moveSpeed: 1.35, pauseSeconds: 1.6, phase: 0,
    facingYaw: 90, coat: [.12, .28, .48], accent: [.96, .68, .2] },
  { id: "south-warden", role: "guard", route: [[94, 108.5], [82, 111.5], [54, 111.5]], moveSpeed: 1.25, pauseSeconds: 1.9, phase: .5,
    facingYaw: -90, coat: [.12, .28, .48], accent: [.96, .68, .2] },
  { id: "north-market-keeper", role: "vendor", route: [[82.7, 92]], moveSpeed: 0, pauseSeconds: 0, phase: .1,
    facingYaw: 90, coat: [.54, .2, .12], accent: [.96, .72, .28] },
  { id: "south-market-keeper", role: "vendor", route: [[82.7, 120]], moveSpeed: 0, pauseSeconds: 0, phase: .65,
    facingYaw: 90, coat: [.2, .42, .28], accent: [.92, .55, .18] },
  { id: "beginning-smith", role: "smith", route: [[FAST_WORLD_BLACKSMITH_POSITION.x, FAST_WORLD_BLACKSMITH_POSITION.z]], moveSpeed: 0, pauseSeconds: 0, phase: .3,
    facingYaw: 90, coat: [.34, .18, .08], accent: [.96, .45, .08] },
  { id: "town-healer", role: "healer", route: [[51, 108.5]], moveSpeed: 0, pauseSeconds: 0, phase: .8,
    facingYaw: 90, coat: [.18, .5, .42], accent: [.45, 1, .78] },
  { id: "well-runner", role: "resident", route: [[59, 96.5], [76, 96.5], [81, 93]], moveSpeed: 1.05, pauseSeconds: 2.4, phase: .25,
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

const stationaryRoutine = (definition: TownLifeActorDefinition): readonly [number, number] =>
  definition.role === "smith" ? [3.25, 1.05]
    : definition.role === "vendor" ? [7.25, 1.35]
      : definition.role === "healer" ? [8.5, 2.1] : [9, 0];

const routeYaw = (from: readonly [number, number], to: readonly [number, number]): number =>
  Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI;

const shortestYawDelta = (from: number, to: number): number => ((to - from + 540) % 360) - 180;
const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export function townLifeActorPose(definition: TownLifeActorDefinition, timeSeconds: number): TownLifeActorPose {
  const origin = definition.route[0]!;
  if (definition.route.length < 2 || definition.moveSpeed <= 0) {
    const [period, activeFor] = stationaryRoutine(definition);
    const routineTime = ((timeSeconds + definition.phase * period) % period + period) % period;
    const working = routineTime < activeFor;
    const activity = working && activeFor > 0 ? Math.sin(routineTime / activeFor * Math.PI) :
      (Math.sin(timeSeconds * .8 + definition.phase * Math.PI * 2) + 1) * .12;
    return { x: origin[0], z: origin[1], yaw: definition.facingYaw, stride: 0, activity, moving: false,
      motion: working ? "work" : "idle", turn: 0 };
  }

  // Traverse the authored route and then return over it. Each endpoint includes
  // a real pause in which the actor eases through the turn instead of snapping.
  const points = [...definition.route, ...definition.route.slice(1, -1).reverse()];
  const legs = points.map((from, index) => {
    const to = points[(index + 1) % points.length]!;
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return { from, to, distance, duration: distance / definition.moveSpeed };
  });
  const cycleDuration = legs.reduce((total, leg) => total + definition.pauseSeconds + leg.duration, 0);
  let cursor = ((timeSeconds + definition.phase * cycleDuration) % cycleDuration + cycleDuration) % cycleDuration;
  let distanceBefore = 0;
  for (let index = 0; index < legs.length; index++) {
    const leg = legs[index]!;
    const previous = legs[(index + legs.length - 1) % legs.length]!;
    const incomingYaw = routeYaw(previous.from, previous.to);
    const outgoingYaw = routeYaw(leg.from, leg.to);
    if (cursor < definition.pauseSeconds) {
      const turnProgress = smoothstep(cursor / definition.pauseSeconds);
      const delta = shortestYawDelta(incomingYaw, outgoingYaw);
      return { x: leg.from[0], z: leg.from[1], yaw: incomingYaw + delta * turnProgress, stride: 0,
        activity: (Math.sin(timeSeconds * .9 + definition.phase * 8) + 1) * .12, moving: false,
        motion: "idle", turn: delta / 180 };
    }
    cursor -= definition.pauseSeconds;
    if (cursor <= leg.duration) {
      const progress = leg.duration <= 0 ? 1 : cursor / leg.duration;
      const travelled = distanceBefore + leg.distance * progress;
      return {
        x: leg.from[0] + (leg.to[0] - leg.from[0]) * progress,
        z: leg.from[1] + (leg.to[1] - leg.from[1]) * progress,
        yaw: outgoingYaw,
        stride: Math.sin(travelled / 1.42 * Math.PI * 2),
        activity: .35,
        moving: true,
        motion: "walk",
        turn: 0,
      };
    }
    cursor -= leg.duration;
    distanceBefore += leg.distance;
  }
  return { x: origin[0], z: origin[1], yaw: definition.facingYaw, stride: 0, activity: 0, moving: false,
    motion: "idle", turn: 0 };
}

export function townLifeAnimation(definition: TownLifeActorDefinition, pose: TownLifeActorPose): string {
  if (pose.motion === "walk") return definition.role === "resident" ? "Walking_B" : "Walking_A";
  if (pose.motion === "work") {
    if (definition.role === "smith") return "1H_Melee_Attack_Chop";
    if (definition.role === "healer") return "Spellcasting";
    if (definition.role === "vendor" && definition.id.includes("south")) return "Cheer";
    return "Interact";
  }
  return "Idle";
}
