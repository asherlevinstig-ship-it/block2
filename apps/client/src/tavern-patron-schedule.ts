export type TavernPatronPhase = "away" | "entering" | "settling" | "eating" | "talking" | "leaving";

export interface TavernPatronScheduleState {
  phase: TavernPatronPhase;
  progress: number;
}

export const TAVERN_PATRON_CYCLE_SECONDS = 76;

const PHASES: readonly { phase: TavernPatronPhase; startsAt: number; endsAt: number }[] = [
  { phase: "away", startsAt: 0, endsAt: 8 },
  { phase: "entering", startsAt: 8, endsAt: 18 },
  { phase: "settling", startsAt: 18, endsAt: 22 },
  { phase: "eating", startsAt: 22, endsAt: 35 },
  { phase: "talking", startsAt: 35, endsAt: 48 },
  { phase: "eating", startsAt: 48, endsAt: 58 },
  { phase: "leaving", startsAt: 58, endsAt: 68 },
  { phase: "away", startsAt: 68, endsAt: TAVERN_PATRON_CYCLE_SECONDS },
] as const;

/** Deterministic real-time schedule. Offsets stagger the crowd so the door and
 * tables never animate in lockstep. */
export function tavernPatronSchedule(elapsedSeconds: number, offsetSeconds = 0): TavernPatronScheduleState {
  const localTime = ((elapsedSeconds + offsetSeconds) % TAVERN_PATRON_CYCLE_SECONDS
    + TAVERN_PATRON_CYCLE_SECONDS) % TAVERN_PATRON_CYCLE_SECONDS;
  const segment = PHASES.find(candidate => localTime >= candidate.startsAt && localTime < candidate.endsAt)
    ?? PHASES[0]!;
  return {
    phase: segment.phase,
    progress: Math.max(0, Math.min(1, (localTime - segment.startsAt) / (segment.endsAt - segment.startsAt))),
  };
}

