export const FIRST_VICTORY_DROP_PREFIX = "first-victory:";

export type FirstVictoryRewardStage = "open_pack" | "choose" | "return_town" | "complete";

export interface FirstVictoryRewardState {
  stage: FirstVictoryRewardStage;
  itemId: string;
}

export const firstVictoryRewardStorageKey = (profileToken: string): string =>
  `blockcraft.first-victory-reward.v1:${profileToken}`;

export function isFirstVictoryDrop(dropId: string): boolean {
  return dropId.startsWith(FIRST_VICTORY_DROP_PREFIX);
}

export function firstVictoryItemFromDrop(dropId: string): string | null {
  if (!isFirstVictoryDrop(dropId)) return null;
  return dropId.slice(FIRST_VICTORY_DROP_PREFIX.length).split(":", 1)[0] || null;
}

export function parseFirstVictoryReward(value: string | null): FirstVictoryRewardState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<FirstVictoryRewardState>;
    if (typeof parsed.itemId !== "string" || !parsed.itemId) return null;
    if (parsed.stage !== "open_pack" && parsed.stage !== "choose"
      && parsed.stage !== "return_town" && parsed.stage !== "complete") return null;
    return { stage: parsed.stage, itemId: parsed.itemId };
  } catch {
    return null;
  }
}

export function firstVictoryCallingFit(pathId: string | null, itemName: string): string {
  const role = pathId === "tank" ? "lets your Tank hold the line"
    : pathId === "ranger" ? "gives your Ranger a safer ranged opening"
      : pathId === "mage" ? "channels your Mage's hand-cast magic"
        : pathId === "healer" ? "lets your Healer fight safely between rescues"
          : pathId === "assassin" ? "supports your Assassin's fast execution loop"
            : pathId === "thief" ? "keeps your Thief quick while repositioning"
              : "is matched to your chosen Calling";
  return `${itemName} ${role}. Equip it now or keep it for later.`;
}
