export interface AreaMiniBossDefinition {
  id: string;
  name: string;
  rewardLabel?: string;
}

/** One persistent leader for every authored overworld combat area. */
export const AREA_MINI_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "moss-crawler", name: "Mossback Alpha", rewardLabel: "Mossback Fang Cache" },
  { id: "outskirts-crawler-west", name: "Westroad Alpha", rewardLabel: "Westroad Fang Cache" },
  { id: "outskirts-crawler-north", name: "Northroad Alpha", rewardLabel: "Northroad Fang Cache" },
  { id: "wild-crawler", name: "Greenwood Broodmother", rewardLabel: "Broodmother Fang Cache" },
  { id: "frontier-spitter", name: "Silverfang Spitter", rewardLabel: "Silverfang Focus Cache" },
  { id: "wild-spitter-west-north", name: "Gloomfang Spitter", rewardLabel: "Gloomfang Focus Cache" },
  { id: "stone-brute", name: "Stonehide Crusher", rewardLabel: "Stonehide Hammer Cache" },
  { id: "frontier-brute", name: "Ruinbreaker", rewardLabel: "Ruinbreaker Arsenal" },
  { id: "frontier-brute-east", name: "Frontier Warleader", rewardLabel: "Warleader Arsenal" },
  { id: "ashglass-sentry-east", name: "Ashglass High Sentry", rewardLabel: "Ashglass Focus Cache" },
  { id: "outskirts-west-pack:0", name: "Roaming Westroad Packleader", rewardLabel: "Westroad Pack Cache" },
  { id: "outskirts-north-pack:0", name: "Roaming Northroad Packleader", rewardLabel: "Northroad Pack Cache" },
  { id: "wilds-west-pack:0", name: "Roaming Gloam Spitter Alpha", rewardLabel: "Gloam Focus Cache" },
  { id: "wilds-east-pack:0", name: "Roaming Sunscar Spitter Alpha", rewardLabel: "Sunscar Focus Cache" },
  { id: "shallow-cave-crawler", name: "Ironburrow Alpha", rewardLabel: "Ironburrow Fang Cache" },
  { id: "deep-cave-spitter", name: "Silver Chamber Broodspitter", rewardLabel: "Broodspitter Focus Cache" },
  { id: "buried-chamber-brute", name: "Stone Warden", rewardLabel: "Warden's Lantern Cache" },
] as const;

const AREA_MINI_BOSS_BY_ID = new Map(AREA_MINI_BOSSES.map(definition => [definition.id, definition]));
const EXISTING_AREA_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "frontier-brute-west", name: "Frontier Stone Champion" },
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
