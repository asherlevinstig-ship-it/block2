import type { ItemId } from "@blockcraft/protocol";

export interface AreaMiniBossDefinition {
  id: string;
  name: string;
  rewardLabel: string;
  rewardItemId: ItemId;
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
  { id: "outskirts-west-pack:0", name: "Roaming Westroad Packleader", rewardLabel: "Westroad Pack Cache", rewardItemId: "westroad_pack_totem" },
  { id: "outskirts-north-pack:0", name: "Roaming Northroad Packleader", rewardLabel: "Northroad Pack Cache", rewardItemId: "northroad_pack_totem" },
  { id: "wilds-west-pack:0", name: "Roaming Gloam Spitter Alpha", rewardLabel: "Gloam Focus Cache", rewardItemId: "gloam_alpha_gland" },
  { id: "wilds-east-pack:0", name: "Roaming Sunscar Spitter Alpha", rewardLabel: "Sunscar Focus Cache", rewardItemId: "sunscar_alpha_gland" },
  { id: "shallow-cave-crawler", name: "Ironburrow Alpha", rewardLabel: "Ironburrow Fang Cache", rewardItemId: "ironburrow_crown" },
  { id: "deep-cave-spitter", name: "Silver Chamber Broodspitter", rewardLabel: "Broodspitter Focus Cache", rewardItemId: "broodspitter_focus_shard" },
  { id: "buried-chamber-brute", name: "Stone Warden", rewardLabel: "Warden's Lantern Cache", rewardItemId: "stone_warden_lantern" },
] as const;

const AREA_MINI_BOSS_BY_ID = new Map(AREA_MINI_BOSSES.map(definition => [definition.id, definition]));
const EXISTING_AREA_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "frontier-brute-west", name: "Frontier Stone Champion", rewardLabel: "Frontier Champion Cache", rewardItemId: "frontier_champion_crest" },
];
const AREA_MAIN_MOB_BY_ID = new Map([...AREA_MINI_BOSSES, ...EXISTING_AREA_BOSSES].map(definition => [definition.id, definition]));

export function areaMiniBossDefinition(id: string): AreaMiniBossDefinition | undefined {
  return AREA_MINI_BOSS_BY_ID.get(id);
}

export function isAreaMiniBoss(id: string): boolean {
  return AREA_MINI_BOSS_BY_ID.has(id);
}

export function areaMainMobDefinition(id: string): AreaMiniBossDefinition | undefined {
  return AREA_MAIN_MOB_BY_ID.get(id);
}

export const AREA_LEADER_FOLLOWERS: Readonly<Record<string, readonly string[]>> = {
  "wild-crawler": ["greenwood-briar", "greenwood-briar-north"],
  "frontier-spitter": ["cave-spitter"],
  "frontier-brute-east": ["frontier-crawler", "frontier-support-spitter"],
  "ashglass-sentry-east": ["ashglass-sentry-west"],
  "outskirts-west-pack:0": ["outskirts-west-pack:1", "outskirts-west-pack:2"],
  "outskirts-north-pack:0": ["outskirts-north-pack:1", "outskirts-north-pack:2"],
  "wilds-west-pack:0": ["wilds-west-pack:1"],
  "wilds-east-pack:0": ["wilds-east-pack:1"],
  "buried-chamber-brute": ["buried-vault-crawler"],
};

export function leaderForFollower(id: string): string | null {
  return Object.entries(AREA_LEADER_FOLLOWERS).find(([, followers]) => followers.includes(id))?.[0] ?? null;
}

export function areaLeaderPattern(archetype: string, sequence: number): string {
  if (archetype === "cave_spitter") return ["fan", "pool", "aimed"][sequence % 3]!;
  if (archetype === "stone_brute") return sequence % 2 === 0 ? "rocks" : "slam";
  return "rush";
}
