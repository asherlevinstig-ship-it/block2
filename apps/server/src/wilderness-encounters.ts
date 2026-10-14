import type { MobArchetypeId } from "./mob-archetypes.js";
import { ASHEN_REACH, ASHEN_SENTRY_HOMES, MISTFEN_MOB_HOMES, SILVER_GUARD_HOMES, isInAshenReach, isInMistfenMarsh } from "@blockcraft/voxel-world";
export const ASHEN_SENTRY_IDS = ["ashglass-sentry-west", "ashglass-sentry-east"] as const;
export const isAshenSentry = (id: string) => ASHEN_SENTRY_IDS.some(member => member === id);
export const ashenSentryAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInAshenReach(pose.x, pose.z) && Math.hypot(pose.x - ASHEN_REACH.x, pose.z - ASHEN_REACH.z) <= ASHEN_REACH.radius - 1;
/** Two sweeping fans before a committed aimed shot leave readable gaps. */
export const ashenSentryPattern = (sequence: number): "fan" | "aimed" => sequence % 3 === 2 ? "aimed" : "fan";
export const SILVER_GUARD_IDS = ["cave-spitter", "frontier-spitter"] as const;
export const GREENWOOD_CAMP_IDS = ["wild-crawler", "greenwood-briar", "greenwood-briar-north"] as const;
export const isGreenwoodCampMob = (id: string) => GREENWOOD_CAMP_IDS.some(member => member === id);
export const greenwoodCampAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && pose.x >= 33 && pose.x <= 52 && pose.z >= 11 && pose.z <= 28;
export const isSilverGuard = (id: string) => SILVER_GUARD_IDS.some(guard => guard === id);
/** Guard the deposit and its approaches, not a player all the way back to town. */
export const silverGuardAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && pose.x >= 40 && pose.x <= 58 && pose.z >= 22 && pose.z <= 36;
export const MIXED_FRONTIER_IDS = ["frontier-crawler", "frontier-support-spitter", "frontier-brute-east"] as const;
export const MIXED_FRONTIER_CENTER = { x: 68.5, y: 8, z: 34.5 };
export const MIXED_FRONTIER_SPITTER = { x: 68.5, y: 8, z: 36.5 };
export const isMixedFrontierMob = (id: string) => MIXED_FRONTIER_IDS.some(member => member === id);
export const mixedFrontierAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - MIXED_FRONTIER_CENTER.y) <= 1.5
  && Math.hypot(pose.x - MIXED_FRONTIER_CENTER.x, pose.z - MIXED_FRONTIER_CENTER.z) <= 14;
export const frontierBruteAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && pose.x >= 56 && pose.x <= 76 && pose.z >= 18 && pose.z <= 35;
export const MISTFEN_IDS = ["mistfen-behemoth", "mistfen-briar-west", "mistfen-briar-east", "mistfen-spitter"] as const;
export const isMistfenMob = (id: string) => MISTFEN_IDS.some(member => member === id);
export const mistfenAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInMistfenMarsh(pose.x, pose.z);
/** Existing encounter IDs remain stable for objective tracking and saved worlds. */
export const WILDERNESS_ENCOUNTERS: readonly { id: string; archetype: MobArchetypeId; x: number; y: number; z: number }[] = [
  { id: "moss-crawler", archetype: "moss_crawler", x: 35.5, y: 8, z: -8.5 },
  { id: "outskirts-crawler-west", archetype: "moss_crawler", x: -23.5, y: 8, z: 11.5 },
  { id: "outskirts-crawler-north", archetype: "moss_crawler", x: 11.5, y: 8, z: -23.5 },
  { id: "cave-spitter", archetype: "cave_spitter", ...SILVER_GUARD_HOMES[0] },
  { id: "frontier-spitter", archetype: "cave_spitter", ...SILVER_GUARD_HOMES[1] },
  { id: "wild-spitter-west", archetype: "cave_spitter", x: -30.5, y: 8, z: 12.5 },
  { id: "wild-spitter-west-north", archetype: "cave_spitter", x: -30.5, y: 8, z: 3.5 },
  { id: "frontier-brute", archetype: "stone_brute", x: 65.5, y: 8, z: 23.5 },
  { id: "frontier-brute-east", archetype: "stone_brute", x: 70.5, y: 8, z: 32.5 },
  { id: "frontier-brute-west", archetype: "stone_brute", x: -48.5, y: 8, z: 12.5 },
  { id: "mistfen-behemoth", archetype: "stone_brute", ...MISTFEN_MOB_HOMES[0] },
  { id: "mistfen-briar-west", archetype: "briar_crawler", ...MISTFEN_MOB_HOMES[1] },
  { id: "mistfen-briar-east", archetype: "briar_crawler", ...MISTFEN_MOB_HOMES[2] },
  { id: "mistfen-spitter", archetype: "cave_spitter", ...MISTFEN_MOB_HOMES[3] },
  ...ASHEN_SENTRY_IDS.map((id, index) => ({ id, archetype: "cave_spitter" as const, ...ASHEN_SENTRY_HOMES[index]! })),
];
