import { bowShotRangeMultiplier } from "@blockcraft/protocol";

export type BowReticleState = "neutral" | "target" | "blocked" | "out-of-range";
export type BowMissCause = "hit" | "terrain blocked" | "partial draw range" | "target moved"
  | "player moved / network origin" | "no target on release ray" | "ray outside current hitbox"
  | "server collision mismatch";

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
  if (input.reticleState === "out-of-range") return "partial draw range";
  if (input.hadTarget && input.targetMoved > .2 && !input.targetStillOnRay) return "target moved";
  if (input.originDelta > .25) return "player moved / network origin";
  if (!input.hadTarget) return "no target on release ray";
  if (!input.targetStillOnRay) return "ray outside current hitbox";
  return "server collision mismatch";
}
