import type { ItemId } from "@blockcraft/protocol";

export interface AreaMiniBossDefinition {
  id: string;
  name: string;
  rewardLabel: string;
  rewardItemId: ItemId;
}

export type AreaLeaderPhase = 1 | 2 | 3;

/** Deliberately asymmetric thresholds leave a long learning phase and a short final stand. */
export function areaLeaderPhase(health: number, maxHealth: number): AreaLeaderPhase {
  if (maxHealth <= 0 || health * 4 <= maxHealth) return 3;
  if (health * 5 <= maxHealth * 3) return 2;
  return 1;
}

/** One persistent leader for every authored overworld combat area. */
export const AREA_MINI_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "moss-crawler", name: "Mossback Alpha", rewardLabel: "Mossback Fang Cache", rewardItemId: "mossback_fang_relic" },
  { id: "outskirts-crawler-west", name: "Westroad Alpha", rewardLabel: "Westroad Fang Cache", rewardItemId: "westroad_fang_relic" },
  { id: "outskirts-crawler-north", name: "Northroad Alpha", rewardLabel: "Northroad Fang Cache", rewardItemId: "northroad_fang_relic" },
  { id: "wild-crawler", name: "Greenwood Broodmother", rewardLabel: "Broodmother Fang Cache", rewardItemId: "broodmother_heart" },
  { id: "frontier-spitter", name: "Silverfang Spitter", rewardLabel: "Silverfang Focus Cache", rewardItemId: "silverfang_venom_sac" },
  { id: "wild-spitter-west-north", name: "Gloomfang Spitter", rewardLabel: "Gloomfang Focus Cache", rewardItemId: "gloomfang_venom_sac" },
  { id: "stone-brute", name: "Stonehide Crusher", rewardLabel: "Stonehide Hammer Cache", rewardItemId: "stonehide_core_relic" },
  { id: "frontier-brute", name: "Ruinbreaker", rewardLabel: "Ruinbreaker Arsenal", rewardItemId: "ruinbreaker_keystone" },
  { id: "frontier-brute-east", name: "Frontier Warleader", rewardLabel: "Warleader Arsenal", rewardItemId: "warleader_crest" },
  { id: "ashglass-sentry-east", name: "Ashglass High Sentry", rewardLabel: "Ashglass Focus Cache", rewardItemId: "ashglass_lens" },
  { id: "mistfen-behemoth", name: "Mireback Behemoth", rewardLabel: "Mireback Hoard", rewardItemId: "mireback_crown" },
  { id: "south-quarrymaster", name: "Redstone Quarrymaster", rewardLabel: "Quarrymaster Vault", rewardItemId: "quarrymaster_sigil" },
  { id: "northwatch-watchbreaker", name: "Northwatch Watchbreaker", rewardLabel: "Watchbreaker Reliquary", rewardItemId: "watchbreaker_crest" },
  { id: "outskirts-west-pack:0", name: "Roaming Westroad Packleader", rewardLabel: "Westroad Pack Cache", rewardItemId: "westroad_pack_totem" },
  { id: "outskirts-north-pack:0", name: "Roaming Northroad Packleader", rewardLabel: "Northroad Pack Cache", rewardItemId: "northroad_pack_totem" },
  { id: "wilds-west-pack:0", name: "Roaming Gloam Spitter Alpha", rewardLabel: "Gloam Focus Cache", rewardItemId: "gloam_alpha_gland" },
  { id: "wilds-east-pack:0", name: "Roaming Sunscar Spitter Alpha", rewardLabel: "Sunscar Focus Cache", rewardItemId: "sunscar_alpha_gland" },
  { id: "shallow-cave-crawler", name: "Ironburrow Alpha", rewardLabel: "Ironburrow Fang Cache", rewardItemId: "ironburrow_crown" },
  { id: "deep-cave-spitter", name: "Silver Chamber Broodspitter", rewardLabel: "Broodspitter Focus Cache", rewardItemId: "broodspitter_focus_shard" },
  { id: "buried-chamber-brute", name: "Stone Warden", rewardLabel: "Warden's Lantern Cache", rewardItemId: "stone_warden_lantern" },
] as const;

/** Fast World leaders reuse the archived combat/reward contracts without
 * importing voxel positions or rendering. */
const FAST_WORLD_AREA_LEADERS: readonly AreaMiniBossDefinition[] = [
  { id: "greenwood-elderthorn", name: "Elderthorn Keeper", rewardLabel: "Elderthorn Fang Cache", rewardItemId: "broodmother_heart" },
];
const COMBAT_AREA_MINI_BOSS_BY_ID = new Map([...AREA_MINI_BOSSES, ...FAST_WORLD_AREA_LEADERS]
  .map(definition => [definition.id, definition]));
const EXISTING_AREA_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "frontier-brute-west", name: "Frontier Stone Champion", rewardLabel: "Frontier Champion Cache", rewardItemId: "frontier_champion_crest" },
];
/** Archived Hunt Board catalogue. Fast World leaders stay out of this list so
 * its legacy contracts do not leak into the new regional progression. */
export const AREA_MAIN_MOBS: readonly AreaMiniBossDefinition[] = [...AREA_MINI_BOSSES, ...EXISTING_AREA_BOSSES];
const AREA_MAIN_MOB_BY_ID = new Map([...AREA_MAIN_MOBS, ...FAST_WORLD_AREA_LEADERS]
  .map(definition => [definition.id, definition]));

export function areaMiniBossDefinition(id: string): AreaMiniBossDefinition | undefined {
  return COMBAT_AREA_MINI_BOSS_BY_ID.get(id);
}

export function isAreaMiniBoss(id: string): boolean {
  return COMBAT_AREA_MINI_BOSS_BY_ID.has(id);
}

export function areaMainMobDefinition(id: string): AreaMiniBossDefinition | undefined {
  return AREA_MAIN_MOB_BY_ID.get(id);
}

export const AREA_LEADER_FOLLOWERS: Readonly<Record<string, readonly string[]>> = {
  "greenwood-elderthorn": ["greenwood-elderthorn-rootguard", "greenwood-elderthorn-attendant"],
  "stone-brute": ["stone-brute-crawler", "stone-brute-spitter"],
  "frontier-brute": ["frontier-brute-crawler", "frontier-brute-spitter"],
  "frontier-brute-west": ["frontier-brute-west-crawler", "frontier-brute-west-spitter"],
  "wild-crawler": ["greenwood-briar", "greenwood-briar-north"],
  "frontier-spitter": ["cave-spitter"],
  "frontier-brute-east": ["frontier-crawler", "frontier-support-spitter"],
  "ashglass-sentry-east": ["ashglass-sentry-west"],
  "mistfen-behemoth": ["mistfen-briar-west", "mistfen-briar-east", "mistfen-spitter"],
  "south-quarrymaster": ["south-pit-crawler", "south-pit-spitter"],
  "northwatch-watchbreaker": ["northwatch-briar", "northwatch-guard"],
  "outskirts-west-pack:0": ["outskirts-west-pack:1", "outskirts-west-pack:2"],
  "outskirts-north-pack:0": ["outskirts-north-pack:1", "outskirts-north-pack:2"],
  "wilds-west-pack:0": ["wilds-west-pack:1"],
  "wilds-east-pack:0": ["wilds-east-pack:1"],
  "buried-chamber-brute": ["buried-vault-crawler"],
};

const COORDINATED_BRUTE_LEADERS = new Set([
  "stone-brute", "frontier-brute", "frontier-brute-west", "frontier-brute-east",
  "mistfen-behemoth", "south-quarrymaster", "buried-chamber-brute",
]);

const COORDINATED_CRAWLER_LEADERS = new Set([
  "greenwood-elderthorn", "wild-crawler", "outskirts-west-pack:0", "outskirts-north-pack:0",
]);

const COORDINATED_SPITTER_LEADERS = new Set([
  "frontier-spitter", "wilds-west-pack:0", "wilds-east-pack:0",
]);

export function isCoordinatedBruteLeader(id: string): boolean {
  return COORDINATED_BRUTE_LEADERS.has(id);
}

export function isCoordinatedCrawlerLeader(id: string): boolean {
  return COORDINATED_CRAWLER_LEADERS.has(id);
}

export function isCoordinatedSpitterLeader(id: string): boolean {
  return COORDINATED_SPITTER_LEADERS.has(id);
}

/** Pack attacks lose lanes as escorts fall; a lone alpha can only make a direct rush. */
export function crawlerPackPattern(pattern: string, aliveFollowers: number): string {
  if (aliveFollowers <= 0) return pattern === "pack-rush" || pattern === "alpha-rush" ? "rush" : pattern;
  if (aliveFollowers === 1 && pattern === "alpha-rush") return "pack-rush";
  return pattern;
}

/** Stable fan lanes leave a narrow centre dodge and make circling the leader unsafe. */
export function crawlerPackRushYawOffsets(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const spread = count === 2 ? 30 : 42;
  return Array.from({ length: count }, (_, index) => -spread + spread * 2 * index / (count - 1));
}

/** A defeated escort opens the two forward lanes players were shown during the windup. */
export function spitterRingWithSafeGap<T>(lanes: readonly T[], aliveFollowers: number, totalFollowers: number): T[] {
  if (totalFollowers <= 0 || aliveFollowers >= totalFollowers || lanes.length < 4) return [...lanes];
  const left = Math.floor(lanes.length / 2) - 1;
  return lanes.filter((_lane, index) => index !== left && index !== left + 1);
}

/** One pool punishes standing still; the second alternates between likely lateral escapes. */
export function spitterPackPoolSites(target: { x: number; y: number; z: number }, yaw: number, sequence: number) {
  const side = sequence % 2 === 0 ? 1 : -1;
  const radians = (yaw + 90 * side) * Math.PI / 180;
  return [target, { x: target.x + Math.sin(radians) * 2.6, y: target.y, z: target.z + Math.cos(radians) * 2.6 }];
}

export function leaderForFollower(id: string): string | null {
  return Object.entries(AREA_LEADER_FOLLOWERS).find(([, followers]) => followers.includes(id))?.[0] ?? null;
}

/** Escorts contribute at most two points of breakable armour, independent of party size or level. */
export function bruteLeaderArmourSegments(aliveFollowers: number, totalFollowers: number): number {
  return Math.min(2, Math.max(0, Math.min(aliveFollowers, totalFollowers)));
}

/** Clearing the whole escort earns a longer punish window than picking off one follower. */
export function bruteLeaderExposureMs(aliveFollowers: number): number {
  return aliveFollowers <= 0 ? 4_000 : 2_500;
}

export function areaLeaderPattern(archetype: string, sequence: number, phase: AreaLeaderPhase = 1, leaderId = ""): string {
  if (archetype === "cave_spitter") {
    const rotation = phase === 1 ? leaderId === "frontier-spitter" ? ["fan", "aimed"] : ["aimed", "fan"]
      : phase === 2 ? ["fan", "pool", "aimed"] : ["venom-ring", "fan", "pool"];
    return rotation[sequence % rotation.length]!;
  }
  if (archetype === "stone_brute") {
    if (leaderId === "mistfen-behemoth") {
      const rotation = phase === 1 ? ["bog-charge", "slam"]
        : phase === 2 ? ["toxic-eruption", "bog-charge", "smash"]
        : ["toxic-eruption", "bog-charge", "warden-barrage"];
      return rotation[sequence % rotation.length]!;
    }
    const rotation = phase === 1 ? leaderId === "frontier-brute" ? ["smash", "slam"] : ["rocks", "slam"]
      : phase === 2 ? ["charge", "rocks", "smash", "slam"] : ["warden-barrage", "charge", "smash", "rocks"];
    return rotation[sequence % rotation.length]!;
  }
  const rotation = phase === 1 ? ["rush"] : phase === 2 ? ["rush", "pack-rush"] : ["alpha-rush", "pack-rush"];
  return rotation[sequence % rotation.length]!;
}
