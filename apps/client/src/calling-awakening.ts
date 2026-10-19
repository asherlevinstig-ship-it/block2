import type { BuildPathId } from "@blockcraft/protocol";

export type CallingAwakening = {
  pathId: BuildPathId;
  action: string;
  identity: string;
  colour: string;
  accent: string;
};

export const CALLING_AWAKENINGS: Record<BuildPathId, CallingAwakening> = {
  tank: {
    pathId: "tank",
    action: "Raise a guard wall and protect allies behind you",
    identity: "Hold the line. Turn defence into safety for your party.",
    colour: "#55bfff",
    accent: "#d9f4ff",
  },
  mage: {
    pathId: "mage",
    action: "Gather power in both hands and release an arcane pulse",
    identity: "Shape raw magic and control the battlefield.",
    colour: "#a879ff",
    accent: "#efe3ff",
  },
  assassin: {
    pathId: "assassin",
    action: "Enter Stealth, reposition, and strike from behind",
    identity: "Disappear, expose a weakness, and execute decisively.",
    colour: "#f15b78",
    accent: "#ffd9e1",
  },
  thief: {
    pathId: "thief",
    action: "Leave a decoy in smoke and escape with the prize",
    identity: "Misdirect pursuit and control where enemies look.",
    colour: "#e8bc45",
    accent: "#fff0ae",
  },
  ranger: {
    pathId: "ranger",
    action: "Create distance and fire a precise spectral arrow",
    identity: "Control the range and punish enemies from safety.",
    colour: "#70dc72",
    accent: "#d8ffd8",
  },
  healer: {
    pathId: "healer",
    action: "Create a healing field and restore a wounded ally",
    identity: "Keep allies standing and turn defeat into recovery.",
    colour: "#5fe8c5",
    accent: "#d8fff5",
  },
};

export const CALLING_AWAKENING_MINIMUM_MS = 1_800;

export function callingAwakening(pathId: BuildPathId): CallingAwakening {
  return CALLING_AWAKENINGS[pathId];
}

export function callingAwakeningCanContinue(elapsedMs: number): boolean {
  return Number.isFinite(elapsedMs) && elapsedMs >= CALLING_AWAKENING_MINIMUM_MS;
}

export function callingPreviewMarkup(pathId: BuildPathId, label: string): string {
  const awakening = callingAwakening(pathId);
  return `<div class="calling-preview" data-calling="${pathId}" style="--calling-colour:${awakening.colour};--calling-accent:${awakening.accent}" aria-label="${label} ability preview" role="img">
    <span class="calling-preview-ground"></span>
    <span class="calling-preview-target"><i></i></span>
    <span class="calling-preview-decoy"><i></i></span>
    <span class="calling-preview-hero"><i class="calling-preview-head"></i><i class="calling-preview-body"></i><i class="calling-preview-arm calling-preview-arm-a"></i><i class="calling-preview-arm calling-preview-arm-b"></i></span>
    <span class="calling-preview-prop"></span>
    <span class="calling-preview-effect calling-preview-effect-a"></span>
    <span class="calling-preview-effect calling-preview-effect-b"></span>
    <span class="calling-preview-effect calling-preview-effect-c"></span>
  </div>`;
}
