export const MOB_SIMULATION_RANGE = 64;
export const FAST_WORLD_SIMULATION_RANGE = 56;

type Pose = { x: number; y: number; z: number };
type ActivePlayer = Pose & { health: number };

/**
 * Static interest management only: difficulty and combat stats never change.
 * A mob sleeps when every living player is outside its world-space region.
 */
export function mobSimulationActive(mob: Pose, players: Iterable<ActivePlayer>): boolean {
  return mobSimulationActiveWithin(mob, players, MOB_SIMULATION_RANGE);
}

/** Fast World uses a tighter, fixed area of interest. This affects simulation
 * cost only; enemy health, damage and timings remain static. */
export function fastWorldMobSimulationActive(mob: Pose, players: Iterable<ActivePlayer>): boolean {
  return mobSimulationActiveWithin(mob, players, FAST_WORLD_SIMULATION_RANGE);
}

function mobSimulationActiveWithin(mob: Pose, players: Iterable<ActivePlayer>, range: number): boolean {
  const rangeSquared = range * range;
  for (const player of players) {
    if (player.health <= 0) continue;
    const dx = player.x - mob.x, dz = player.z - mob.z;
    if (dx * dx + dz * dz <= rangeSquared) return true;
  }
  return false;
}
