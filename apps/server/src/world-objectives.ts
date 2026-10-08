export interface WorldObjectiveDefinition {
  id: string;
  title: string;
  detail: string;
  tier: number;
  targetMobIds: readonly string[];
  coins: number;
  rewardLabel: string;
}

export interface WorldObjectiveProgress {
  index: number;
  completedMobIds: Set<string>;
}

export const WORLD_OBJECTIVES: readonly WorldObjectiveDefinition[] = [
  {
    id: "briar-disturbance",
    title: "Briar Disturbance",
    detail: "A corrupted crawler blocks the east road. Bring it down.",
    tier: 1,
    targetMobIds: ["greenwood-briar"],
    coins: 5,
    rewardLabel: "5 gold · creature loot",
  },
  {
    id: "overgrown-camp",
    title: "Overgrown Camp",
    detail: "Clear both creatures gathering beyond the Greenwood trail.",
    tier: 2,
    targetMobIds: ["wild-crawler", "greenwood-briar-north"],
    coins: 8,
    rewardLabel: "8 gold · camp spoils",
  },
  {
    id: "stone-awakening",
    title: "Stone Awakening",
    detail: "A Stone Brute has awakened on the outer frontier.",
    tier: 3,
    targetMobIds: ["stone-brute"],
    coins: 15,
    rewardLabel: "15 gold · Stone Core drop",
  },
] as const;

export function createObjectiveProgress(): WorldObjectiveProgress {
  return { index: 0, completedMobIds: new Set() };
}

export function activeObjective(progress: WorldObjectiveProgress): WorldObjectiveDefinition {
  return WORLD_OBJECTIVES[Math.min(progress.index, WORLD_OBJECTIVES.length - 1)]!;
}

export function creditObjectiveDefeat(progress: WorldObjectiveProgress, mobId: string): { completed?: WorldObjectiveDefinition; active: WorldObjectiveDefinition } {
  const objective = activeObjective(progress);
  if (!objective.targetMobIds.includes(mobId) || progress.completedMobIds.has(mobId)) return { active: objective };
  progress.completedMobIds.add(mobId);
  if (!objective.targetMobIds.every(id => progress.completedMobIds.has(id))) return { active: objective };
  progress.index = (progress.index + 1) % WORLD_OBJECTIVES.length;
  progress.completedMobIds.clear();
  return { completed: objective, active: activeObjective(progress) };
}

export function nextObjectiveTarget(progress: WorldObjectiveProgress): string {
  const objective = activeObjective(progress);
  return objective.targetMobIds.find(id => !progress.completedMobIds.has(id)) ?? objective.targetMobIds[0]!;
}
