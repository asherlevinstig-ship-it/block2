export type LootGearDecision = "equipped" | "upgrade" | "different" | "lower" | "same" | null;
export type LootAdviceTone = "good" | "choice" | "warning";

export type IncomingLootAdviceInput = {
  decision: LootGearDecision;
  owned: number;
  callingMatch: boolean;
  rarityOrder: number;
  canSalvage: boolean;
};

export function incomingLootAdvice(input: IncomingLootAdviceInput): { tone: LootAdviceTone; label: string; detail: string } {
  if (input.decision === "upgrade")
    return { tone: "good", label: "UPGRADE — TAKE IT", detail: "Stronger overall than your equipped item." };
  if (input.callingMatch)
    return { tone: "good", label: "YOUR CALLING — TAKE IT", detail: "Its attunement supports your current combat style." };
  if (input.rarityOrder >= 3)
    return { tone: "good", label: "RARE FIND — KEEP IT", detail: "Hard to replace; compare it safely back in town." };
  if (input.decision === "lower")
    return { tone: "warning", label: input.canSalvage ? "LOWER STATS — SALVAGE" : "LOWER STATS", detail: "Weaker overall than what you have equipped." };
  if (input.owned > 0)
    return { tone: "choice", label: "DUPLICATE — SAFE TO SALVAGE", detail: "You already own this item." };
  if (input.decision === "different")
    return { tone: "choice", label: "TRADE-OFF — YOUR CHOICE", detail: "Some stats improve while others decrease." };
  if (input.decision === "same")
    return { tone: "choice", label: "SAME POWER — OPTIONAL", detail: "It performs about the same as your equipped item." };
  return { tone: "good", label: "NEW LOOT — TAKE IT", detail: "You do not own this item yet." };
}

export type SwapCandidateInput = {
  rarityOrder: number;
  quantity: number;
  equipment: boolean;
  callingMatch: boolean;
  decision: LootGearDecision;
};

/** Lower scores are safer recommendations to leave behind. */
export function swapCandidateScore(input: SwapCandidateInput): number {
  let score = input.rarityOrder * 35 + (input.equipment ? 15 : 0) + (input.callingMatch ? 60 : 0);
  if (input.quantity > 1) score -= 70;
  if (input.decision === "upgrade") score += 50;
  else if (input.decision === "different") score += 20;
  else if (input.decision === "lower") score -= 15;
  else if (input.decision === "same") score -= 5;
  else if (input.decision === "equipped") score += 50;
  return score;
}

export function swapCandidateReason(input: SwapCandidateInput): string {
  if (input.quantity > 1) return "SPARE COPY";
  if (input.decision === "lower") return "LOWER STATS";
  if (!input.equipment && input.rarityOrder === 0) return "COMMON ITEM";
  if (input.decision === "same") return "SAME POWER";
  if (input.callingMatch) return "SUPPORTS YOUR CALLING";
  if (input.decision === "different") return "TRADE-OFF ITEM";
  return "LOWEST PACK VALUE";
}
