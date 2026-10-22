import { wildernessTerritoryAt } from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";
import type { MobArchetypeId } from "./mob-archetypes.js";
export interface RoamingPack {
  id: string; name: string; tier: 1 | 2 | 3; archetype: MobArchetypeId;
  archetypes?: readonly MobArchetypeId[];
  eliteIndex?: number;
  route: readonly Position[]; offsets: readonly { x: number; z: number }[];
}
export const ROAMING_PACKS: readonly RoamingPack[] = [
  { id: "outskirts-west-pack", name: "Westroad Crawler Pack", tier: 1, archetype: "moss_crawler", route: [
    { x: -22.5, y: 8, z: -2.5 }, { x: -19.5, y: 8, z: -7.5 }, { x: -16.5, y: 8, z: -11.5 }],
    offsets: [{ x: 0, z: 0 }, { x: .8, z: 0 }, { x: 0, z: .8 }] },
  { id: "outskirts-north-pack", name: "Northroad Crawler Pack", tier: 1, archetype: "moss_crawler", route: [
    { x: -2.5, y: 8, z: -22.5 }, { x: 3.5, y: 8, z: -23.5 }, { x: 9.5, y: 8, z: -23.5 }],
    offsets: [{ x: 0, z: 0 }, { x: .8, z: 0 }, { x: 0, z: .8 }] },
  { id: "wilds-west-pack", name: "Gloam Spitter Pack", tier: 2, archetype: "cave_spitter", route: [
    { x: -27.5, y: 8, z: -9.5 }, { x: -23.5, y: 8, z: -15.5 }, { x: -17.5, y: 8, z: -21.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 1.2, z: 0 }] },
  { id: "wilds-east-pack", name: "Sunscar Spitter Pack", tier: 2, archetype: "cave_spitter", route: [
    { x: 44.5, y: 8, z: -9.5 }, { x: 47.5, y: 8, z: -2.5 }, { x: 48.5, y: 8, z: 5.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 0, z: 1.2 }] },
  { id: "greenwood-south-pack", name: "Greenwood Forager Pack", tier: 2, archetype: "moss_crawler",
    archetypes: ["moss_crawler", "moss_crawler", "briar_crawler"], eliteIndex: 0, route: [
      { x: 37.5, y: 8, z: 26.5 }, { x: 40.5, y: 8, z: 26.5 }, { x: 48.5, y: 8, z: 25.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 1.1, z: -.8 }, { x: 1.1, z: .8 }] },
  { id: "greenwood-north-pack", name: "Greenwood Thorn Pack", tier: 2, archetype: "briar_crawler",
    archetypes: ["briar_crawler", "moss_crawler", "cave_spitter"], eliteIndex: 0, route: [
      { x: 39.5, y: 8, z: -8.5 }, { x: 44.5, y: 8, z: -5.5 }, { x: 49.5, y: 8, z: .5 }],
    offsets: [{ x: 0, z: 0 }, { x: -.9, z: 1 }, { x: .9, z: 1 }] },
  { id: "mistfen-west-pack", name: "Mistfen Reed Ambush", tier: 2, archetype: "briar_crawler",
    archetypes: ["briar_crawler", "briar_crawler", "fen_bloater"], eliteIndex: 0, route: [
      { x: -29.5, y: 8, z: -31.5 }, { x: -29.5, y: 8, z: -36.5 }, { x: -29.5, y: 8, z: -41.5 }],
    offsets: [{ x: 0, z: 0 }, { x: 0, z: 1.2 }, { x: 0, z: 2.4 }] },
  { id: "mistfen-south-pack", name: "Mistfen Bog Patrol", tier: 2, archetype: "fen_bloater",
    archetypes: ["fen_bloater", "cave_spitter", "briar_crawler"], eliteIndex: 0, route: [
      { x: -54.5, y: 8, z: -39.5 }, { x: -46.5, y: 8, z: -39.5 }, { x: -36.5, y: 8, z: -36.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1, z: -.8 }, { x: 1, z: -.8 }] },
  { id: "mistfen-deep-pack", name: "Deepfen Lantern Hunters", tier: 2, archetype: "fen_bloater",
    archetypes: ["fen_bloater", "cave_spitter", "ridge_stalker"], eliteIndex: 0, route: [
      { x: -68.5, y: 8, z: -34.5 }, { x: -76.5, y: 8, z: -40.5 },
      { x: -84.5, y: 8, z: -46.5 }, { x: -91.5, y: 8, z: -50.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1.1, z: -.9 }, { x: 1.1, z: -.9 }] },
  { id: "northwatch-ascent-pack", name: "Northwatch Pass Wardens", tier: 3, archetype: "ridge_stalker",
    archetypes: ["ridge_stalker", "shard_sentry", "ridge_stalker"], eliteIndex: 0, route: [
      { x: 24.5, y: 8, z: -91.5 }, { x: 27.5, y: 8, z: -99.5 },
      { x: 31.5, y: 8, z: -107.5 }, { x: 34.5, y: 8, z: -115.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1.2, z: -.9 }, { x: 1.2, z: -.9 }] },
  { id: "stoneheart-west-pack", name: "Stoneheart Skirmishers", tier: 3, archetype: "briar_crawler",
    archetypes: ["briar_crawler", "cave_spitter", "moss_crawler"], eliteIndex: 0, route: [
      { x: 34.5, y: 8, z: 50.5 }, { x: 31.5, y: 8, z: 55.5 }, { x: 35.5, y: 8, z: 61.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1, z: .9 }, { x: 1, z: .9 }] },
  { id: "stoneheart-east-pack", name: "Stoneheart Breaker Patrol", tier: 3, archetype: "stone_brute",
    archetypes: ["stone_brute", "cave_spitter", "cave_spitter"], eliteIndex: 0, route: [
      { x: 52.5, y: 8, z: 36.5 }, { x: 55.5, y: 8, z: 43.5 }, { x: 58.5, y: 8, z: 49.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1.4, z: .8 }, { x: 1.4, z: .8 }] },
  { id: "ashen-west-pack", name: "Ashen Hound Patrol", tier: 3, archetype: "ember_hound",
    archetypes: ["ember_hound", "ember_hound", "cave_spitter"], eliteIndex: 0, route: [
      { x: 82.5, y: 8, z: 57.5 }, { x: 83.5, y: 8, z: 64.5 }, { x: 87.5, y: 8, z: 71.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1, z: 1 }, { x: 1, z: 1 }] },
  { id: "ashen-east-pack", name: "Ashen Furnace Patrol", tier: 3, archetype: "cinder_ram",
    archetypes: ["cinder_ram", "ember_hound", "cave_spitter"], eliteIndex: 0, route: [
      { x: 137.5, y: 8, z: 61.5 }, { x: 146.5, y: 8, z: 63.5 },
      { x: 155.5, y: 8, z: 66.5 }, { x: 163.5, y: 8, z: 68.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1.2, z: -.9 }, { x: 1.2, z: -.9 }] },
  { id: "ashen-south-pack", name: "Charwood Cinder Hunt", tier: 3, archetype: "ember_hound",
    archetypes: ["ember_hound", "ember_hound", "cave_spitter"], eliteIndex: 0, route: [
      { x: 156.5, y: 8, z: 94.5 }, { x: 148.5, y: 8, z: 99.5 },
      { x: 140.5, y: 8, z: 104.5 }, { x: 132.5, y: 8, z: 108.5 }],
    offsets: [{ x: 0, z: 0 }, { x: -1, z: 1 }, { x: 1, z: 1 }] },
];
export const roamingMemberId = (pack: RoamingPack, index: number) => `${pack.id}:${index}`;
export const roamingMemberArchetype = (pack: RoamingPack, index: number): MobArchetypeId =>
  pack.archetypes?.[index] ?? pack.archetype;
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
