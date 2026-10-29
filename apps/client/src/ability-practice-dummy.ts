import { CALLING_ABILITY_OPTIONS, type CallingAbilityId } from "@blockcraft/protocol";

export const ABILITY_PRACTICE_DUMMY_RADIUS = 4;
export const ABILITY_PRACTICE_EXPLANATION_MS = 6_500;

export function abilityPracticeDummyInRange(
  player: { x: number; z: number },
  dummy: { x: number; z: number },
): boolean {
  return Math.hypot(player.x - dummy.x, player.z - dummy.z) <= ABILITY_PRACTICE_DUMMY_RADIUS;
}

export function abilityPracticeLesson(abilityId: CallingAbilityId): { name: string; description: string } {
  const ability = CALLING_ABILITY_OPTIONS.find(option => option.id === abilityId);
  if (!ability) throw new Error(`Unknown Calling ability: ${abilityId}`);
  return { name: ability.name, description: ability.description };
}
