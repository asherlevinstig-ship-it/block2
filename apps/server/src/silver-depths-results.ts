export type SilverDepthsRank = "GOLD" | "SILVER" | "BRONZE";

/** Damage matters as well as speed, so a reckless fast clear cannot earn the top rank. */
export function silverDepthsRank(durationMs: number, damageTaken: number): SilverDepthsRank {
  if (durationMs <= 180_000 && damageTaken <= 3) return "GOLD";
  if (durationMs <= 300_000 && damageTaken <= 8) return "SILVER";
  return "BRONZE";
}
