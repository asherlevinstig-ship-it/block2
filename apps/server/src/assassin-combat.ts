export const ASSASSIN_EDGE_MAX = 5;
export const ASSASSIN_EDGE_DECAY_MS = 6_000;
export const ASSASSIN_REPEAT_OPENING_LOCKOUT_MS = 1_500;

export type AssassinOpeningKind = "ambush" | "counter" | "flank" | "interrupt" | "stagger" | "marked";

export interface AssassinOpeningInput {
  concealed: boolean;
  dodgeCounter: boolean;
  behind: boolean;
  interrupted: boolean;
  staggered: boolean;
  marked: boolean;
}

export interface AssassinEdgeState {
  segments: number;
  lastOpening?: AssassinOpeningKind;
  lastGainAt: number;
}

export function assassinOpening(input: AssassinOpeningInput): AssassinOpeningKind | null {
  if (input.concealed) return "ambush";
  if (input.dodgeCounter) return "counter";
  if (input.interrupted) return "interrupt";
  if (input.staggered) return "stagger";
  if (input.marked) return "marked";
  if (input.behind) return "flank";
  return null;
}

export function advanceAssassinEdge(
  previous: AssassinEdgeState | undefined,
  opening: AssassinOpeningKind | null,
  now: number,
): { state: AssassinEdgeState; gained: boolean } {
  const state = previous ?? { segments: 0, lastGainAt: now };
  const elapsed = Math.max(0, now - state.lastGainAt);
  const decay = Math.floor(elapsed / ASSASSIN_EDGE_DECAY_MS);
  const decayedSegments = Math.max(0, state.segments - decay);
  const decayedAt = decay > 0 ? state.lastGainAt + decay * ASSASSIN_EDGE_DECAY_MS : state.lastGainAt;
  if (!opening) return { state: { ...state, segments: decayedSegments, lastGainAt: decayedAt }, gained: false };
  const repeatedTooSoon = state.lastOpening === opening && elapsed < ASSASSIN_REPEAT_OPENING_LOCKOUT_MS;
  if (repeatedTooSoon) return { state: { ...state, segments: decayedSegments, lastGainAt: decayedAt }, gained: false };
  return {
    state: { segments: Math.min(ASSASSIN_EDGE_MAX, decayedSegments + 1), lastOpening: opening, lastGainAt: now },
    gained: true,
  };
}

export function assassinOpeningLabel(opening: AssassinOpeningKind): string {
  return ({ ambush: "AMBUSH", counter: "COUNTER", flank: "EXPOSED FLANK", interrupt: "INTERRUPTED",
    stagger: "STAGGER OPENING", marked: "MARKED WEAKNESS" } as const)[opening];
}

export function venombladeStrike(previousStacks: number, opening: AssassinOpeningKind | null): {
  stacks: number;
  bonusDamage: number;
  catalytic: boolean;
} {
  const stacks = Math.min(3, Math.max(0, previousStacks) + 1);
  if (opening && stacks >= 3) return { stacks: 0, bonusDamage: 3, catalytic: true };
  return { stacks, bonusDamage: 0, catalytic: false };
}
