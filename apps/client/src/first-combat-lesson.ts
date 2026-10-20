import type { BuildPathId } from "@blockcraft/protocol";

export const FIRST_COMBAT_MOB_ID = "south-causeway-crawler";
export const FIRST_COMBAT_SUPPORT_IDS = ["south-causeway-scavenger-west", "south-causeway-scavenger-east"] as const;
export const FIRST_COMBAT_GROUP_IDS = [FIRST_COMBAT_MOB_ID, ...FIRST_COMBAT_SUPPORT_IDS] as const;
export type FirstCombatPhase = "attack" | "dodge" | "finish";
export type FirstCombatEvent = "hit" | "perfect_dodge";

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

export function firstCombatLesson(pathId: BuildPathId | null, phase: FirstCombatPhase = "attack"): FirstCombatLesson {
  const calling = pathId ? CALLING_LESSONS[pathId] : DEFAULT_LESSON;
  const callingName = pathId ? calling.title.split(" · ")[0] : "Combat lesson";
  if (phase === "attack") return {
    title: `${callingName} · 1/3 STRIKE`,
    detail: "Face the Southroad Crawler and press J (or click) to land your first weapon hit.",
  };
  if (phase === "finish") return {
    title: `${callingName} · 3/3 FINISH`,
    detail: "Perfect dodge! Finish the exposed crawler and its two weakened scavengers with J (or click).",
  };
  return { title: `${callingName} · 2/3 DODGE`, detail: calling.detail };
}

export function advanceFirstCombatPhase(phase: FirstCombatPhase, event: FirstCombatEvent, mobId: string): FirstCombatPhase {
  if (mobId !== FIRST_COMBAT_MOB_ID) return phase;
  if (phase === "attack" && event === "hit") return "dodge";
  if (phase === "dodge" && event === "perfect_dodge") return "finish";
  return phase;
}

export function completesFirstCombatLesson(defeatedMobIds: ReadonlySet<string>,
  phase: FirstCombatPhase = "finish"): boolean {
  return phase === "finish" && FIRST_COMBAT_GROUP_IDS.every(id => defeatedMobIds.has(id));
}
