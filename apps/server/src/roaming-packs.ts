import { wildernessTerritoryAt } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import type { MobArchetypeId } from "./mob-archetypes.js";
export interface RoamingPack {
  id: string; tier: 1 | 2; archetype: MobArchetypeId;
  route: readonly Position[]; offsets: readonly { x: number; z: number }[];
}
export const ROAMING_PACKS: readonly RoamingPack[] = [
  { id: "outskirts-west-pack", tier: 1, archetype: "moss_crawler", route: [
    { x: -22.5, y: 8, z: -2.5 }, { x: -19.5, y: 8, z: -7.5 }, { x: -16.5, y: 8, z: -11.5 }],
    offsets: [{ x: 0, z: 0 }, { x: .8, z: 0 }, { x: 0, z: .8 }] },
  { id: "outskirts-north-pack", tier: 1, archetype: "moss_crawler", route: [
    { x: -2.5, y: 8, z: -22.5 }, { x: 3.5, y: 8, z: -23.5 }, { x: 9.5, y: 8, z: -23.5 }],
    offsets: [{ x: 0, z: 0 }, { x: .8, z: 0 }, { x: 0, z: .8 }] },
  { id: "wilds-west-pack", tier: 2, archetype: "cave_spitter", route: [
    { x: -27.5, y: 8, z: -9.5 }, { x: -23.5, y: 8, z: -15.5 }, { x: -17.5, y: 8, z: -21.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 1.2, z: 0 }] },
  { id: "wilds-east-pack", tier: 2, archetype: "cave_spitter", route: [
    { x: 44.5, y: 8, z: -9.5 }, { x: 47.5, y: 8, z: -2.5 }, { x: 48.5, y: 8, z: 4.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 0, z: 1.2 }] },
];
export const roamingMemberId = (pack: RoamingPack, index: number) => `${pack.id}:${index}`;
export function roamingMembership(id: string) {
  for (const pack of ROAMING_PACKS) {
    const index = pack.offsets.findIndex((_, i) => roamingMemberId(pack, i) === id);
    if (index >= 0) return { pack, index };
  }
  return null;
}
/** Limit pursuit to the route corridor and its original radial difficulty band. */
export function roamingPackAllows(pack: RoamingPack, pose: Position): boolean {
  return pose.y >= 6.8 && pose.y <= 9.2 && wildernessTerritoryAt(pose.x, pose.z)?.tier === pack.tier
    && Math.hypot(pose.x - 8.5, pose.z - 8.5) >= 30
    && pack.route.some(point => Math.hypot(point.x - pose.x, point.z - pose.z) <= 6);
}
export const roamingGoal = (pack: RoamingPack, index: number, routeIndex: number): Position => ({
  x: pack.route[routeIndex]!.x + pack.offsets[index]!.x, y: pack.route[routeIndex]!.y,
  z: pack.route[routeIndex]!.z + pack.offsets[index]!.z,
});
export interface RoamingRouteState { index: number; direction: number; pauseUntil: number; expiresAt: number }
export const createRoamingRouteState = (now: number): RoamingRouteState => ({ index: 0, direction: 1, pauseUntil: now + 1200, expiresAt: now + 18000 });
export function advanceRoamingRoute(pack: RoamingPack, state: RoamingRouteState, now: number,
  members: readonly { index: number; pose: Position; idle: boolean }[]) {
  if (!members.length || members.some(member => !member.idle) || now < state.pauseUntil) return;
  const arrived = members.every(member => {
    const goal = roamingGoal(pack, member.index, state.index);
    return Math.hypot(member.pose.x - goal.x, member.pose.z - goal.z) < .65;
  });
  if (!arrived && now < state.expiresAt) return;
  if (state.index + state.direction < 0 || state.index + state.direction >= pack.route.length) state.direction *= -1;
  state.index += state.direction;
  state.pauseUntil = now + 1200;
  state.expiresAt = now + 18000;
}
