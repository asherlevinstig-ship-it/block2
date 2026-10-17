import { CALLING_ABILITY_OPTIONS, type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";

/** Unlocks are earned immediately; only their introduction waits for Town. */
export function earnedCallingAbilities(pathId: BuildPathId | null, rank: number, level: number): CallingAbilityId[] {
  if (!pathId || level < 2) return [];
  return CALLING_ABILITY_OPTIONS.filter(ability => ability.pathId === pathId && (
    ability.unlockRank <= rank || (ability.category === "Utility" && level >= 4)
  )).map(ability => ability.id);
}

export function abilityRevealUse(abilityId: CallingAbilityId, rank: number, level: number): string {
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId)!;
  if (ability.category === "Core") return "Equipped on G. Press G to use it.";
  if (ability.category === "Utility" && level >= 4)
    return rank >= ability.unlockRank
      ? "Ready on F. You can also equip it to G from your Kit."
      : "Ready on F. Press F to use it.";
  return "Open your Kit to equip it to G, then press G to use it.";
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
