export const WARDEN_VICTORY_TRANSFORM_MS = 15_000;
export const WARDEN_LOOT_BEAM_MS = 15_000;

export function wardenVictoryActive(now: number, until: number): boolean {
  return until > 0 && now < until;
}

export function wardenVictoryPulse(now: number): number {
  return 2.15 + Math.sin(now * .008) * .35 + Math.sin(now * .003) * .18;
}
