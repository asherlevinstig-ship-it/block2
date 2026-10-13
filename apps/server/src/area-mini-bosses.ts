export interface AreaMiniBossDefinition {
  id: string;
  name: string;
}

/** One persistent leader for every authored overworld combat area. */
export const AREA_MINI_BOSSES: readonly AreaMiniBossDefinition[] = [
  { id: "moss-crawler", name: "Mossback Alpha" },
  { id: "outskirts-crawler-west", name: "Westroad Alpha" },
  { id: "outskirts-crawler-north", name: "Northroad Alpha" },
  { id: "wild-crawler", name: "Greenwood Broodmother" },
  { id: "frontier-spitter", name: "Silverfang Spitter" },
  { id: "wild-spitter-west-north", name: "Gloomfang Spitter" },
  { id: "stone-brute", name: "Stonehide Crusher" },
  { id: "frontier-brute", name: "Ruinbreaker" },
  { id: "frontier-brute-east", name: "Frontier Warleader" },
  { id: "ashglass-sentry-east", name: "Ashglass High Sentry" },
  { id: "outskirts-west-pack:0", name: "Roaming Westroad Packleader" },
  { id: "outskirts-north-pack:0", name: "Roaming Northroad Packleader" },
  { id: "wilds-west-pack:0", name: "Roaming Gloam Spitter Alpha" },
  { id: "wilds-east-pack:0", name: "Roaming Sunscar Spitter Alpha" },
  { id: "shallow-cave-crawler", name: "Ironburrow Alpha" },
  { id: "deep-cave-spitter", name: "Silver Chamber Broodspitter" },
  { id: "buried-chamber-brute", name: "Stone Warden" },
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
