import type { MobArchetypeId } from "./mob-archetypes.js";
/** Existing encounter IDs remain stable for objective tracking and saved worlds. */
export const WILDERNESS_ENCOUNTERS: readonly { id: string; archetype: MobArchetypeId; x: number; y: number; z: number }[] = [
  { id: "moss-crawler", archetype: "moss_crawler", x: 35.5, y: 8, z: -8.5 },
  { id: "outskirts-crawler-west", archetype: "moss_crawler", x: -23.5, y: 8, z: 11.5 },
  { id: "outskirts-crawler-north", archetype: "moss_crawler", x: 11.5, y: 8, z: -23.5 },
  { id: "cave-spitter", archetype: "cave_spitter", x: 47.5, y: 8, z: 31.5 },
  { id: "frontier-spitter", archetype: "cave_spitter", x: 50.5, y: 8, z: 23.5 },
  { id: "wild-spitter-west", archetype: "cave_spitter", x: -30.5, y: 8, z: 12.5 },
  { id: "wild-spitter-west-north", archetype: "cave_spitter", x: -30.5, y: 8, z: 3.5 },
  { id: "frontier-brute", archetype: "stone_brute", x: 65.5, y: 8, z: 23.5 },
  { id: "frontier-brute-east", archetype: "stone_brute", x: 70.5, y: 8, z: 32.5 },
  { id: "frontier-brute-west", archetype: "stone_brute", x: -48.5, y: 8, z: 12.5 },
];
