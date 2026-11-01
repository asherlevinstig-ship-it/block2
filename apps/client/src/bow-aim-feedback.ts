import { bowShotRangeMultiplier } from "@blockcraft/protocol";

export type BowReticleState = "neutral" | "target" | "blocked" | "out-of-range";

export function bowVisibleRange(baseRange: number, charge: number, drawing: boolean): number {
  return baseRange * (drawing ? bowShotRangeMultiplier(charge) : 1);
}

export function bowReticleState(input: {
  targetInRange: boolean;
  targetAtFullRange: boolean;
  blockedInRange: boolean;
  drawing: boolean;
}): BowReticleState {
  if (input.targetInRange) return "target";
  if (input.blockedInRange) return "blocked";
  if (input.drawing && input.targetAtFullRange) return "out-of-range";
  return "neutral";
}
