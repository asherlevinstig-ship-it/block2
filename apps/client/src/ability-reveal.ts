import { BUILD_PATHS, CALLING_ABILITY_OPTIONS, type BuildPathId, type BuildPathSpecializationId, type CallingAbilityId } from "@blockcraft/protocol";

export type CallingUnlockAnnouncement = { title: string; detail: string };

/** Immediate level-up copy. The full interactive reveal still waits for Town. */
export function callingUnlockAnnouncement(level: number, pathId: BuildPathId | null): CallingUnlockAnnouncement | null {
  if (level !== 2 && level !== 4) return null;
  if (!pathId) return level === 2
    ? { title: "Calling Power unlocked", detail: "Choose your Calling to reveal its Power. The full introduction waits for Town." }
    : { title: "Calling Special unlocked", detail: "Choose your Calling to reveal its Special. The full introduction waits for Town." };
  const category = level === 2 ? "Core" : "Utility";
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.pathId === pathId && option.category === category);
  return {
    title: `${ability?.name ?? `Calling ${level === 2 ? "Power" : "Special"}`} unlocked`,
    detail: `${BUILD_PATHS[pathId].name} ${level === 2 ? "Power" : "Special"} · ${level === 2 ? "G" : "F"} to use. The full introduction waits for Town.`,
  };
}

/** Unlocks are earned immediately; only their introduction waits for Town. */
export function earnedCallingAbilities(pathId: BuildPathId | null, rank: number, level: number,
  specializationId: BuildPathSpecializationId | null = null): CallingAbilityId[] {
  if (!pathId || level < 2) return [];
  return CALLING_ABILITY_OPTIONS.filter(ability => ability.pathId === pathId
    && (!("specializationId" in ability) || ability.specializationId === specializationId) && (
    ability.unlockRank <= rank || (ability.category === "Utility" && level >= 4)
  )).map(ability => ability.id);
}

export function abilityRevealUse(abilityId: CallingAbilityId, rank: number, level: number): string {
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId)!;
  if (ability.category === "Core") return "Equipped on G. Press G to use it.";
  if (ability.category === "Specialization") return "Your Veteran path Power is equipped on G. Press G to use it.";
  if (ability.category === "Master") return "Your mastered path Special is equipped on F. Press F to use it.";
  if (ability.category === "Utility" && level >= 4)
    return rank >= ability.unlockRank
      ? "Ready on F. You can also equip it to G from your Kit."
      : "Ready on F. Press F to use it.";
  return "Open your Kit to equip it to G, then press G to use it.";
}

export function shouldGuideFirstCallingUse(
  abilityId: CallingAbilityId,
  equippedAbilityId: CallingAbilityId | null,
  alreadyUsed: boolean,
): boolean {
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId);
  return ability?.category === "Core" && abilityId === equippedAbilityId && !alreadyUsed;
}

export function firstCallingUseInstruction(distance: number): string {
  return distance <= 4
    ? "The effigy is in range. Press G to use your Power."
    : `Calling Effigy · ${Math.max(1, Math.round(distance))}m · move closer`;
}

export function canPresentAbilityReveal(state: {
  worldReady: boolean;
  inTown: boolean;
  defeated: boolean;
  levelCelebrating: boolean;
  otherDialogOpen: boolean;
}): boolean {
  return state.worldReady && state.inTown && !state.defeated
    && !state.levelCelebrating && !state.otherDialogOpen;
}
