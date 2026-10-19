import type { BuildPathId } from "@blockcraft/protocol";

export const FIRST_COMBAT_MOB_ID = "south-causeway-crawler";

export interface FirstCombatLesson {
  title: string;
  detail: string;
}

const CALLING_LESSONS: Record<BuildPathId, FirstCombatLesson> = {
  tank: {
    title: "Tank lesson · hold the line",
    detail: "Face the Southroad Crawler. Hold C through its marked strike, then press J to counter. Space dodges in an emergency.",
  },
  mage: {
    title: "Mage lesson · control your space",
    detail: "Keep the Southroad Crawler in view. Dodge its committed lunge with Space, then press J while it recovers.",
  },
  assassin: {
    title: "Assassin lesson · punish openings",
    detail: "Bait the Southroad Crawler's lunge, dodge behind it with Space, then press J during its recovery.",
  },
  thief: {
    title: "Thief lesson · escape and reposition",
    detail: "Draw out the Southroad Crawler's strike, slip aside with Space, then press J before it can turn.",
  },
  ranger: {
    title: "Ranger lesson · create distance",
    detail: "Keep moving as the Southroad Crawler closes. Dodge its lunge with Space, then press J from a safe angle.",
  },
  healer: {
    title: "Healer lesson · survive first",
    detail: "Read the Southroad Crawler's marked strike. Hold C or dodge with Space, then press J when it is safe.",
  },
};

const DEFAULT_LESSON: FirstCombatLesson = {
  title: "Defeat the Southroad Crawler",
  detail: "Read its marked strike. Click or press J to attack, Space to dodge, and hold C to guard. Defeat it to finish training.",
};

export function firstCombatLesson(pathId: BuildPathId | null): FirstCombatLesson {
  return pathId ? CALLING_LESSONS[pathId] : DEFAULT_LESSON;
}

export function completesFirstCombatLesson(attackerIsLocal: boolean, mobId: string, defeated: boolean): boolean {
  return attackerIsLocal && defeated && mobId === FIRST_COMBAT_MOB_ID;
}
