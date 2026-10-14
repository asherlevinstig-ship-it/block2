import type { MobArchetypeId } from "./mob-archetypes.js";
import { huntDifficultyLives, type HuntDifficulty } from "./hunt-mastery.js";

export type HuntPathId = "fang" | "venom" | "crusher";
export type HuntModifier = "frenzied" | "armoured" | "venomous" | "relentless";

export interface HuntPathDefinition {
  id: HuntPathId;
  name: string;
  forgeName: "Alpha Fang" | "Venom Surge" | "Crusher Break";
  leaders: readonly string[];
  modifiers: readonly HuntModifier[];
  championName: string;
  championArchetype: MobArchetypeId;
  championModifier: HuntModifier;
}

export interface HuntContractState {
  pathId: HuntPathId;
  cycle: number;
  step: number;
  targets: readonly string[];
  targetMobId: string;
  modifier: HuntModifier;
  championMobId: string;
  championActive: boolean;
  completed: boolean;
  failed: boolean;
  difficulty: HuntDifficulty;
  startedAt: number;
  livesRemaining: number;
}

export const HUNT_PATHS: Readonly<Record<HuntPathId, HuntPathDefinition>> = {
  fang: {
    id: "fang", name: "Fang Contract", forgeName: "Alpha Fang",
    leaders: ["moss-crawler", "outskirts-crawler-west", "outskirts-crawler-north", "wild-crawler", "outskirts-west-pack:0", "outskirts-north-pack:0", "shallow-cave-crawler"],
    modifiers: ["frenzied", "relentless", "armoured"],
    championName: "Razorhide Pack Sovereign", championArchetype: "briar_crawler", championModifier: "relentless",
  },
  venom: {
    id: "venom", name: "Venom Contract", forgeName: "Venom Surge",
    leaders: ["frontier-spitter", "wild-spitter-west-north", "ashglass-sentry-east", "wilds-west-pack:0", "wilds-east-pack:0", "deep-cave-spitter"],
    modifiers: ["venomous", "frenzied", "relentless"],
    championName: "Viridian Brood Oracle", championArchetype: "cave_spitter", championModifier: "venomous",
  },
  crusher: {
    id: "crusher", name: "Crusher Contract", forgeName: "Crusher Break",
    leaders: ["stone-brute", "frontier-brute", "frontier-brute-east", "buried-chamber-brute", "frontier-brute-west"],
    modifiers: ["armoured", "relentless", "frenzied"],
    championName: "Worldsplitter Colossus", championArchetype: "stone_brute", championModifier: "armoured",
  },
};

export function isHuntPathId(value: string | undefined): value is HuntPathId {
  return value === "fang" || value === "venom" || value === "crusher";
}

/** Three rotating targets, spread through the path roster instead of repeating one opening trio. */
export function huntContractTargets(pathId: HuntPathId, cycle: number): readonly string[] {
  const leaders = HUNT_PATHS[pathId].leaders;
  const start = Math.max(0, Math.floor(cycle)) % leaders.length;
  const stride = Math.max(1, Math.floor(leaders.length / 3));
  return [leaders[start]!, leaders[(start + stride) % leaders.length]!, leaders[(start + stride * 2) % leaders.length]!];
}

export function beginHuntContract(pathId: HuntPathId, cycle = 0, difficulty: HuntDifficulty = "normal", startedAt = Date.now()): HuntContractState {
  const targets = huntContractTargets(pathId, cycle);
  return { pathId, cycle, step: 0, targets, targetMobId: targets[0]!, modifier: HUNT_PATHS[pathId].modifiers[0]!,
    championMobId: "", championActive: false, completed: false, failed: false, difficulty, startedAt,
    livesRemaining: huntDifficultyLives(difficulty) };
}

export function advanceHuntContract(contract: HuntContractState, championMobId: string): HuntContractState {
  if (contract.completed) return contract;
  if (contract.championActive) return { ...contract, championActive: false, completed: true };
  const nextStep = contract.step + 1;
  if (nextStep >= contract.targets.length) return { ...contract, step: nextStep, targetMobId: championMobId,
    modifier: HUNT_PATHS[contract.pathId].championModifier, championMobId, championActive: true };
  return { ...contract, step: nextStep, targetMobId: contract.targets[nextStep]!, modifier: HUNT_PATHS[contract.pathId].modifiers[nextStep]! };
}

export function huntContractTier(contract: HuntContractState): number {
  return contract.championActive ? 5 : Math.min(4, 2 + contract.step);
}
