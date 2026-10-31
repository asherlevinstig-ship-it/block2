import { TAVERN_HIGH_LOW_MAX_PAYOUT, TAVERN_HIGH_LOW_TABLE_POSITION, TAVERN_QUIZ_MAX_STAKE,
  type TavernCard } from "@blockcraft/protocol";

const SUITS: readonly TavernCard["suit"][] = ["hearts", "diamonds", "clubs", "spades"];

export interface HighLowRound {
  stake: number;
  payout: number;
  streak: number;
  currentCard: TavernCard;
}

export function drawTavernCard(random = Math.random): TavernCard {
  return {
    rank: 2 + Math.min(12, Math.floor(random() * 13)),
    suit: SUITS[Math.min(3, Math.floor(random() * 4))]!,
  };
}

export function highLowResult(current: TavernCard, next: TavernCard, guess: "higher" | "lower"): "correct" | "wrong" | "push" {
  if (current.rank === next.rank) return "push";
  return guess === "higher" ? next.rank > current.rank ? "correct" : "wrong"
    : next.rank < current.rank ? "correct" : "wrong";
}

export function highLowPayout(stake: number, streak: number): number {
  return Math.min(TAVERN_HIGH_LOW_MAX_PAYOUT, stake * 2 ** streak);
}

export function canStartHighLow(player: { x: number; y: number; z: number }, coins: number, stake: number): boolean {
  return Number.isInteger(stake) && [1, 5, TAVERN_QUIZ_MAX_STAKE].includes(stake) && coins >= stake
    && Math.abs(player.y - TAVERN_HIGH_LOW_TABLE_POSITION.y) <= 1.6
    && Math.hypot(player.x - TAVERN_HIGH_LOW_TABLE_POSITION.x, player.z - TAVERN_HIGH_LOW_TABLE_POSITION.z) <= 2.8;
}
