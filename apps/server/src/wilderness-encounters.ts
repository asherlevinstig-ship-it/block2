import type { MobArchetypeId } from "./mob-archetypes.js";
import { ASHEN_SENTRY_HOMES, FRONTIER_WARLEADER_HOME, MISTFEN_MOB_HOMES, NORTHWATCH_MOB_HOMES, SILVER_GUARD_HOMES, SOUTHERN_MOB_HOMES, isInAshenReach, isInMistfenMarsh, isInNorthwatchHighlands, isInSouthernQuarry } from "@blockcraft/voxel-world";
export const ASHEN_SENTRY_IDS = ["ashglass-sentry-west", "ashglass-sentry-east"] as const;
export const ASHEN_HOUND_IDS = ["ashen-ember-hound-west", "ashen-ember-hound-east"] as const;
export const ASHEN_COMBAT_GROUP_IDS = [...ASHEN_SENTRY_IDS, "ashen-cinder-ram", ...ASHEN_HOUND_IDS] as const;
export const isAshenSentry = (id: string) => ASHEN_SENTRY_IDS.some(member => member === id);
export const isAshenMob = (id: string) => ASHEN_COMBAT_GROUP_IDS.some(member => member === id);
export const ashenSentryAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInAshenReach(pose.x, pose.z);
/** Two sweeping fans before a committed aimed shot leave readable gaps. */
export const ashenSentryPattern = (sequence: number): "fan" | "aimed" => sequence % 3 === 2 ? "aimed" : "fan";
export const SILVER_GUARD_IDS = ["cave-spitter", "frontier-spitter"] as const;
export const GREENWOOD_CAMP_IDS = ["wild-crawler", "greenwood-briar", "greenwood-briar-north"] as const;
export const isGreenwoodCampMob = (id: string) => id === "greenwood-thornbinder" || GREENWOOD_CAMP_IDS.some(member => member === id);
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
export const FRONTIER_BRUTE_GROUP_IDS = ["frontier-brute", "frontier-brute-crawler", "frontier-brute-spitter"] as const;
export const isFrontierBruteGroupMob = (id: string) => FRONTIER_BRUTE_GROUP_IDS.some(member => member === id);
export const STONE_BRUTE_ESCORTS = [
  { id: "stone-brute-crawler", archetype: "briar_crawler", x: 39.5, y: 8, z: 40.5 },
  { id: "stone-brute-spitter", archetype: "cave_spitter", x: 45.5, y: 8, z: 43.5 },
] as const;
export const STONE_BRUTE_GROUP_IDS = ["stone-brute", ...STONE_BRUTE_ESCORTS.map(escort => escort.id)] as const;
export const isStoneBruteGroupMob = (id: string) => STONE_BRUTE_GROUP_IDS.some(member => member === id);
export const MISTFEN_IDS = ["mistfen-behemoth", "mistfen-briar-west", "mistfen-briar-east", "mistfen-spitter"] as const;
export const isMistfenMob = (id: string) => id === "mistfen-bloater" || MISTFEN_IDS.some(member => member === id);
export const mistfenAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInMistfenMarsh(pose.x, pose.z);
export const SOUTHERN_QUARRY_IDS = ["south-causeway-crawler", "south-causeway-scavenger-west", "south-causeway-scavenger-east", "south-quarry-spitter-west", "south-quarry-spitter-east",
  "south-redstone-stalker", "south-redstone-sentry", "south-pit-crawler", "south-pit-spitter", "south-quarrymaster"] as const;
export const isSouthernQuarryMob = (id: string) => SOUTHERN_QUARRY_IDS.some(member => member === id);
export const southernQuarryAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInSouthernQuarry(pose.x, pose.z);
export const NORTHWATCH_IDS = ["northwatch-scout", "northwatch-spitter", "northwatch-briar", "northwatch-guard", "northwatch-watchbreaker",
  "northwatch-patrol-stalker-west", "northwatch-patrol-stalker-east"] as const;
export const isNorthwatchMob = (id: string) => NORTHWATCH_IDS.some(member => member === id);
export const NORTHWATCH_SHARD_PATROL_IDS = ["northwatch-spitter", "northwatch-patrol-stalker-west", "northwatch-patrol-stalker-east"] as const;
export const isNorthwatchShardPatrol = (id: string): boolean => NORTHWATCH_SHARD_PATROL_IDS.some(member => member === id);
export const northwatchShardPatrolAllows = (pose: { x: number; y: number; z: number }): boolean =>
  northwatchAllows(pose) && Math.hypot(pose.x - NORTHWATCH_MOB_HOMES[1]!.x,
    pose.z - NORTHWATCH_MOB_HOMES[1]!.z) <= 15;
export const northwatchAllows = (pose: { x: number; y: number; z: number }) => Math.abs(pose.y - 8) <= 1.5
  && isInNorthwatchHighlands(pose.x, pose.z);
/** Two focused shots invite a dodge; the third fires a readable three-lane spread. */
export const northwatchShardPattern = (sequence: number): "aimed" | "fan" => sequence % 3 === 2 ? "fan" : "aimed";
/** A full patrol opens with a committed shot; removing either flanker breaks that rotation. */
export const northwatchPatrolPattern = (sequence: number, flankersAlive: number): "patrol-lance" | "aimed" | "fan" =>
  flankersAlive === 2 && sequence % 3 === 0 ? "patrol-lance" : northwatchShardPattern(sequence);
/** A timed combo or control ability interrupts the lance and opens a longer counter window. */
export const northwatchPatrolInterruptDuration = (mobId: string, pattern: string, normalDurationMs: number): number =>
  mobId === "northwatch-spitter" && pattern === "patrol-lance" && normalDurationMs > 0
    ? Math.max(1_200, normalDurationMs) : normalDurationMs;
export const northwatchPatrolShotDamage = (pattern: string, baseDamage: number): number =>
  baseDamage + (pattern === "patrol-lance" ? 1 : 0);
/** Existing encounter IDs remain stable for objective tracking and saved worlds. */
export const WILDERNESS_ENCOUNTERS: readonly { id: string; archetype: MobArchetypeId; x: number; y: number; z: number }[] = [
  { id: "greenwood-thornbinder", archetype: "thornbinder", x: 47.5, y: 8, z: 17.5 },
  { id: "moss-crawler", archetype: "moss_crawler", x: 35.5, y: 8, z: -8.5 },
  { id: "outskirts-crawler-west", archetype: "moss_crawler", x: -23.5, y: 8, z: 11.5 },
  { id: "outskirts-crawler-north", archetype: "moss_crawler", x: 11.5, y: 8, z: -23.5 },
  { id: "cave-spitter", archetype: "cave_spitter", ...SILVER_GUARD_HOMES[0] },
  { id: "frontier-spitter", archetype: "cave_spitter", ...SILVER_GUARD_HOMES[1] },
  { id: "wild-spitter-west", archetype: "cave_spitter", x: -30.5, y: 8, z: 12.5 },
  { id: "wild-spitter-west-north", archetype: "cave_spitter", x: -30.5, y: 8, z: 3.5 },
  { id: "frontier-brute", archetype: "stone_brute", x: 65.5, y: 8, z: 23.5 },
  { id: "frontier-brute-crawler", archetype: "briar_crawler", x: 62.5, y: 8, z: 25.5 },
  { id: "frontier-brute-spitter", archetype: "cave_spitter", x: 68.5, y: 8, z: 24.5 },
  { id: "frontier-brute-east", archetype: "stone_brute", ...FRONTIER_WARLEADER_HOME },
  { id: "frontier-brute-west", archetype: "stone_brute", x: -48.5, y: 8, z: 12.5 },
  { id: "frontier-brute-west-crawler", archetype: "briar_crawler", x: -46.5, y: 8, z: 10.5 },
  { id: "frontier-brute-west-spitter", archetype: "cave_spitter", x: -51.5, y: 8, z: 11.5 },
  { id: "mistfen-behemoth", archetype: "stone_brute", ...MISTFEN_MOB_HOMES[0] },
  { id: "mistfen-briar-west", archetype: "briar_crawler", ...MISTFEN_MOB_HOMES[1] },
  { id: "mistfen-briar-east", archetype: "briar_crawler", ...MISTFEN_MOB_HOMES[2] },
  { id: "mistfen-spitter", archetype: "cave_spitter", ...MISTFEN_MOB_HOMES[3] },
  { id: "mistfen-bloater", archetype: "fen_bloater", x: -36.5, y: 8, z: -34.5 },
  ...ASHEN_SENTRY_IDS.map((id, index) => ({ id, archetype: "cave_spitter" as const, ...ASHEN_SENTRY_HOMES[index]! })),
  { id: "ashen-cinder-ram", archetype: "cinder_ram", x: 165.5, y: 8, z: 61.5 },
  { id: ASHEN_HOUND_IDS[0], archetype: "ember_hound", x: 161.5, y: 8, z: 64.5 },
  { id: ASHEN_HOUND_IDS[1], archetype: "ember_hound", x: 169.5, y: 8, z: 65.5 },
  { id: SOUTHERN_QUARRY_IDS[0], archetype: "moss_crawler", ...SOUTHERN_MOB_HOMES[0] },
  { id: SOUTHERN_QUARRY_IDS[1], archetype: "moss_crawler", x: .5, y: 8, z: 47.5 },
  { id: SOUTHERN_QUARRY_IDS[2], archetype: "moss_crawler", x: 6.5, y: 8, z: 47.5 },
  { id: SOUTHERN_QUARRY_IDS[3], archetype: "cave_spitter", ...SOUTHERN_MOB_HOMES[1] },
  { id: SOUTHERN_QUARRY_IDS[4], archetype: "cave_spitter", ...SOUTHERN_MOB_HOMES[2] },
  { id: SOUTHERN_QUARRY_IDS[5], archetype: "ridge_stalker", ...SOUTHERN_MOB_HOMES[3] },
  { id: SOUTHERN_QUARRY_IDS[6], archetype: "shard_sentry", ...SOUTHERN_MOB_HOMES[4] },
  { id: SOUTHERN_QUARRY_IDS[7], archetype: "briar_crawler", ...SOUTHERN_MOB_HOMES[5] },
  { id: SOUTHERN_QUARRY_IDS[8], archetype: "cave_spitter", ...SOUTHERN_MOB_HOMES[6] },
  { id: SOUTHERN_QUARRY_IDS[9], archetype: "stone_brute", ...SOUTHERN_MOB_HOMES[7] },
  { id: NORTHWATCH_IDS[0], archetype: "ridge_stalker", ...NORTHWATCH_MOB_HOMES[0] },
  { id: NORTHWATCH_IDS[1], archetype: "shard_sentry", ...NORTHWATCH_MOB_HOMES[1] },
  { id: NORTHWATCH_IDS[2], archetype: "ridge_stalker", ...NORTHWATCH_MOB_HOMES[2] },
  { id: NORTHWATCH_IDS[3], archetype: "shard_sentry", ...NORTHWATCH_MOB_HOMES[3] },
  { id: NORTHWATCH_IDS[4], archetype: "stone_brute", ...NORTHWATCH_MOB_HOMES[4] },
  { id: NORTHWATCH_IDS[5], archetype: "ridge_stalker", ...NORTHWATCH_MOB_HOMES[5] },
  { id: NORTHWATCH_IDS[6], archetype: "ridge_stalker", ...NORTHWATCH_MOB_HOMES[6] },
];
