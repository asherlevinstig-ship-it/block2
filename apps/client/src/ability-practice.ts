import type { BuildPathId, CallingAbilityId } from "@blockcraft/protocol";

export type AbilityPracticePhase = "cast" | "follow_up" | "complete";

export interface AbilityPracticeChallenge {
  title: string;
  castInstruction: string;
  followUpInstruction: string;
  followUpHits: number;
}

const CHALLENGES: Record<BuildPathId, AbilityPracticeChallenge> = {
  tank: { title: "Bulwark trial", castInstruction: "Press G before the effigy's test strike.",
    followUpInstruction: "Hold the line—the test strike is incoming.", followUpHits: 0 },
  mage: { title: "Arcane Surge trial", castInstruction: "Press G to pulse through the three target projections.",
    followUpInstruction: "", followUpHits: 0 },
  assassin: { title: "Stealth trial", castInstruction: "Press G to enter Stealth.",
    followUpInstruction: "Now press J to deliver the empowered strike.", followUpHits: 1 },
  thief: { title: "Smoke Bomb trial", castInstruction: "Press G to break pursuit from the training projections.",
    followUpInstruction: "", followUpHits: 0 },
  ranger: { title: "Volley Focus trial", castInstruction: "Press G to empower your next three shots.",
    followUpInstruction: "Press J three times to fire the empowered volley.", followUpHits: 3 },
  healer: { title: "Field Mend trial", castInstruction: "Press G to heal the injured training projection.",
    followUpInstruction: "", followUpHits: 0 },
};

export function abilityPracticeChallenge(pathId: BuildPathId): AbilityPracticeChallenge {
  return CHALLENGES[pathId];
}

export function practicePhaseAfterCast(pathId: BuildPathId): AbilityPracticePhase {
  return pathId === "assassin" || pathId === "ranger" || pathId === "tank" ? "follow_up" : "complete";
}

export function practiceFollowUpProgress(pathId: BuildPathId, current: number): { hits: number; complete: boolean } {
  const target = CHALLENGES[pathId].followUpHits;
  const hits = Math.min(target, current + 1);
  return { hits, complete: target > 0 && hits >= target };
}

export function isStarterPracticeAbility(abilityId: CallingAbilityId): boolean {
  return abilityId === "tank_bulwark" || abilityId === "mage_arcane_surge" || abilityId === "assassin_vanish"
    || abilityId === "thief_smoke_bomb" || abilityId === "ranger_volley_focus" || abilityId === "healer_field_mend";
}
