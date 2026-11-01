import { bowShotRangeMultiplier } from "@blockcraft/protocol";

export type BowReticleState = "neutral" | "target" | "blocked" | "out-of-range";
export type BowMissCause = "hit" | "terrain blocked" | "out of range" | "target moved"
  | "player moved / network origin" | "no target on release ray" | "ray outside current hitbox"
  | "server collision mismatch";

export function bowVisibleRange(baseRange: number, charge: number, drawing: boolean): number {
  return baseRange * (drawing ? bowShotRangeMultiplier(charge) : 1);
}

/** Keep distant enemies legible without turning the bow into an unlimited
 * target scanner. This only drives feedback; authoritative range is unchanged. */
export function bowOutOfRangeDetectionRange(baseRange: number): number {
  return Math.min(30, baseRange * 2.5);
}

export function bowReticleState(input: {
  targetInRange: boolean;
  targetAtFullRange: boolean;
  targetBeyondMaximum: boolean;
  blockedInRange: boolean;
  drawing: boolean;
}): BowReticleState {
  if (input.targetInRange) return "target";
  if (input.blockedInRange) return "blocked";
  if (input.targetBeyondMaximum) return "out-of-range";
  if (input.drawing && input.targetAtFullRange) return "out-of-range";
  return "neutral";
}

export function bowMissCause(input: {
  hit: boolean;
  reason: "hit" | "terrain" | "miss";
  reticleState: BowReticleState;
  hadTarget: boolean;
  targetMoved: number;
  targetStillOnRay: boolean;
  originDelta: number;
}): BowMissCause {
  if (input.hit) return "hit";
  if (input.reason === "terrain") return "terrain blocked";
  if (input.reticleState === "out-of-range") return "out of range";
  if (input.hadTarget && input.targetMoved > .2 && !input.targetStillOnRay) return "target moved";
  if (input.originDelta > .25) return "player moved / network origin";
  if (!input.hadTarget) return "no target on release ray";
  if (!input.targetStillOnRay) return "ray outside current hitbox";
  return "server collision mismatch";
}
