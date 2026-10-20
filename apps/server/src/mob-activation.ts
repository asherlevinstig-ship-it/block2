export const MOB_SIMULATION_RANGE = 64;

type Pose = { x: number; y: number; z: number };
type ActivePlayer = Pose & { health: number };

/**
 * Static interest management only: difficulty and combat stats never change.
 * A mob sleeps when every living player is outside its world-space region.
 */
export function mobSimulationActive(mob: Pose, players: Iterable<ActivePlayer>): boolean {
  const rangeSquared = MOB_SIMULATION_RANGE * MOB_SIMULATION_RANGE;
  for (const player of players) {
    if (player.health <= 0) continue;
    const dx = player.x - mob.x, dz = player.z - mob.z;
    if (dx * dx + dz * dz <= rangeSquared) return true;
  }
  return false;
}
