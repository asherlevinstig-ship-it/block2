export const MINI_BOSS_ENRAGE_MS = 45_000;
export const MINI_BOSS_ORBIT_TRIGGER_RADIANS = Math.PI * .28;
export const MINI_BOSS_ORBIT_COUNTER_MS = 3_000;
export const MINI_BOSS_FEINT_DELAY_MS = 240;

/** Brute leaders close ground between tells; later phases increase pressure without shortening dodge windows. */
export function bruteLeaderPursuitSpeed(baseSpeed: number, phase: 1 | 2 | 3): number {
  const floor = phase === 3 ? 2.25 : phase === 2 ? 1.95 : 1.65;
  return Math.min(2.8, Math.max(floor, baseSpeed * 1.6));
}

export interface OrbitPressureState {
  targetId: string;
  angle: number;
  direction: -1 | 0 | 1;
  accumulated: number;
  sampledAt: number;
  counterUntil: number;
}

const wrappedAngleDelta = (next: number, previous: number): number => {
  let delta = next - previous;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
};

export function updateOrbitPressure(
  previous: OrbitPressureState | undefined,
  mob: { x: number; z: number },
  target: { id: string; x: number; z: number },
  now: number,
): OrbitPressureState {
  const angle = Math.atan2(target.x - mob.x, target.z - mob.z);
  const distance = Math.hypot(target.x - mob.x, target.z - mob.z);
  if (!previous || previous.targetId !== target.id || now - previous.sampledAt > 350 || distance < 1.4 || distance > 7.5) {
    return { targetId: target.id, angle, direction: 0, accumulated: 0, sampledAt: now, counterUntil: previous?.counterUntil ?? 0 };
  }
  const delta = wrappedAngleDelta(angle, previous.angle);
  const direction: -1 | 0 | 1 = Math.abs(delta) < .004 ? 0 : delta > 0 ? 1 : -1;
  const sameDirection = direction !== 0 && (previous.direction === 0 || direction === previous.direction);
  const accumulated = sameDirection ? previous.accumulated + Math.abs(delta) : Math.max(0, previous.accumulated - .12);
  const triggered = accumulated >= MINI_BOSS_ORBIT_TRIGGER_RADIANS;
  return {
    targetId: target.id,
    angle,
    direction: direction || previous.direction,
    accumulated: triggered ? 0 : accumulated,
    sampledAt: now,
    counterUntil: triggered ? now + MINI_BOSS_ORBIT_COUNTER_MS : previous.counterUntil,
  };
}

export function miniBossOrbitCounterPattern(archetype: string): string {
  if (archetype === "cave_spitter") return "venom-ring";
  if (archetype === "stone_brute") return "warden-barrage";
  return "alpha-rush";
}

export function predictedMiniBossAim(
  mob: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  movement: { strafe: number; forward: number } | undefined,
  leadSeconds: number,
): { x: number; y: number; z: number; yaw: number } {
  const length = Math.hypot(movement?.strafe ?? 0, movement?.forward ?? 0);
  const scale = length > 1 ? 1 / length : 1;
  const lead = Math.min(1.65, 4.2 * Math.max(0, leadSeconds));
  const x = target.x + (movement?.strafe ?? 0) * scale * lead;
  const z = target.z + (movement?.forward ?? 0) * scale * lead;
  return { x, y: target.y, z, yaw: Math.atan2(x - mob.x, z - mob.z) * 180 / Math.PI };
}

/** Encounter damage is fixed; player level never changes an enemy's attack. */
export function miniBossDamage(baseDamage: number): number {
  return Math.max(1, Math.round(baseDamage));
}

/** A periodic held tell punishes dodge-on-animation while remaining fully readable. */
export function miniBossWindupDelay(isMiniBoss: boolean, actionSequence: number): number {
  return isMiniBoss && actionSequence % 4 === 2 ? MINI_BOSS_FEINT_DELAY_MS : 0;
}
