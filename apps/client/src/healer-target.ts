export interface HealCandidate {
  id: string;
  x: number;
  y: number;
  z: number;
  health: number;
  maxHealth: number;
}

/** Mirrors Field Mend's server ordering: an injured ally before self, then lowest health fraction. */
export function fieldMendTarget(casterId: string, caster: Pick<HealCandidate, "x" | "y" | "z">,
  candidates: readonly HealCandidate[], lineClear: (candidate: HealCandidate) => boolean): string | null {
  const eligible = candidates.filter(candidate => candidate.health > 0 && candidate.health < candidate.maxHealth
    && Math.abs(candidate.y - caster.y) <= 2.5
    && Math.hypot(candidate.x - caster.x, candidate.z - caster.z) <= 8 && lineClear(candidate));
  eligible.sort((a, b) => Number(a.id === casterId) - Number(b.id === casterId)
    || a.health / a.maxHealth - b.health / b.maxHealth
    || Math.hypot(a.x - caster.x, a.z - caster.z) - Math.hypot(b.x - caster.x, b.z - caster.z));
  return eligible[0]?.id ?? null;
}
