type Point = { x: number; y: number; z: number };
/** A delayed pre-travel patch must never reconcile a player back across the map. */
export function portalArrivalSnapshot(destination: Point, snapshot: Point): boolean {
  return Math.hypot(destination.x - snapshot.x, destination.y - snapshot.y, destination.z - snapshot.z) <= 4;
}
