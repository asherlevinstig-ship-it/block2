import { SURFACE_HEIGHT, TOWN_CENTER_X, TOWN_CENTER_Z, isRegionalRoad } from "@blockcraft/voxel-world";

export type WorldRoutePoint = { x: number; y: number; z: number };
type FlatPoint = Pick<WorldRoutePoint, "x" | "z">;

const MIN_X = -125, MAX_X = 125, MIN_Z = -100, MAX_Z = 190;
const key = (x: number, z: number) => `${x},${z}`;
const parseKey = (value: string): FlatPoint => {
  const [x, z] = value.split(",").map(Number);
  return { x: x!, z: z! };
};

/** Road arms meet through the protected town centre even though the terrain road predicate begins at its gates. */
export function isWorldGuidanceRoad(x: number, z: number): boolean {
  const cellX = Math.floor(x), cellZ = Math.floor(z);
  const townEastWest = cellZ >= 8 && cellZ <= 10 && cellX >= -30 && cellX <= 29;
  const townNorthSouth = cellX >= 7 && cellX <= 10 && cellZ >= -30 && cellZ <= 29;
  const townSquare = Math.hypot(cellX - TOWN_CENTER_X, cellZ - TOWN_CENTER_Z) <= 5;
  return townSquare || townEastWest || townNorthSouth || isRegionalRoad(cellX, cellZ);
}

let roadCells: FlatPoint[] | null = null;
const allRoadCells = (): FlatPoint[] => {
  if (roadCells) return roadCells;
  roadCells = [];
  for (let z = MIN_Z; z <= MAX_Z; z++) for (let x = MIN_X; x <= MAX_X; x++)
    if (isWorldGuidanceRoad(x, z)) roadCells.push({ x, z });
  return roadCells;
};

const nearestRoadCell = (point: FlatPoint): FlatPoint | null => {
  let nearest: FlatPoint | null = null, nearestDistance = Infinity;
  for (const candidate of allRoadCells()) {
    const distance = Math.hypot(candidate.x + .5 - point.x, candidate.z + .5 - point.z);
    if (distance < nearestDistance) { nearest = candidate; nearestDistance = distance; }
  }
  return nearest;
};

function compressRoadPath(points: FlatPoint[]): FlatPoint[] {
  if (points.length <= 2) return points;
  const result = [points[0]!];
  let previousDirection = { x: points[1]!.x - points[0]!.x, z: points[1]!.z - points[0]!.z };
  for (let index = 2; index < points.length; index++) {
    const direction = { x: points[index]!.x - points[index - 1]!.x, z: points[index]!.z - points[index - 1]!.z };
    if (direction.x !== previousDirection.x || direction.z !== previousDirection.z) result.push(points[index - 1]!);
    previousDirection = direction;
  }
  result.push(points.at(-1)!);
  return result;
}

export function planWorldRoute(start: FlatPoint, destination: FlatPoint): WorldRoutePoint[] {
  const goalRoad = nearestRoadCell(destination);
  if (!goalRoad) return [{ ...destination, y: SURFACE_HEIGHT }];
  const goalKey = key(goalRoad.x, goalRoad.z);
  const queue = [goalKey];
  const parent = new Map<string, string | null>([[goalKey, null]]);
  let closest = goalKey, closestDistance = Math.hypot(goalRoad.x + .5 - start.x, goalRoad.z + .5 - start.z);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const currentKey = queue[cursor]!;
    const current = parseKey(currentKey);
    const distance = Math.hypot(current.x + .5 - start.x, current.z + .5 - start.z);
    if (distance < closestDistance) { closest = currentKey; closestDistance = distance; }
    for (const next of [{ x: current.x + 1, z: current.z }, { x: current.x - 1, z: current.z },
      { x: current.x, z: current.z + 1 }, { x: current.x, z: current.z - 1 }]) {
      if (next.x < MIN_X || next.x > MAX_X || next.z < MIN_Z || next.z > MAX_Z || !isWorldGuidanceRoad(next.x, next.z)) continue;
      const nextKey = key(next.x, next.z);
      if (parent.has(nextKey)) continue;
      parent.set(nextKey, currentKey); queue.push(nextKey);
    }
  }
  const roadPath: FlatPoint[] = [];
  for (let cursor: string | null = closest; cursor; cursor = parent.get(cursor) ?? null) roadPath.push(parseKey(cursor));
  const route = compressRoadPath(roadPath).map(point => ({ x: point.x + .5, y: SURFACE_HEIGHT, z: point.z + .5 }));
  const last = route.at(-1);
  if (!last || Math.hypot(last.x - destination.x, last.z - destination.z) > .75)
    route.push({ x: destination.x, y: SURFACE_HEIGHT, z: destination.z });
  return route;
}

function distanceToSegment(point: FlatPoint, from: FlatPoint, to: FlatPoint): { distance: number; t: number } {
  const dx = to.x - from.x, dz = to.z - from.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared <= .0001 ? 0 : Math.max(0, Math.min(1,
    ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared));
  return { distance: Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t)), t };
}

export function routeDeviationDistance(player: FlatPoint, route: readonly WorldRoutePoint[]): number {
  if (!route.length) return Infinity;
  let best = Math.hypot(player.x - route[0]!.x, player.z - route[0]!.z);
  for (let index = 1; index < route.length; index++)
    best = Math.min(best, distanceToSegment(player, route[index - 1]!, route[index]!).distance);
  return best;
}

export function remainingWorldRoute(player: FlatPoint, route: readonly WorldRoutePoint[]): WorldRoutePoint[] {
  if (route.length <= 1) return [...route];
  let bestIndex = 0, bestDistance = Infinity;
  for (let index = 1; index < route.length; index++) {
    const candidate = distanceToSegment(player, route[index - 1]!, route[index]!);
    if (candidate.distance < bestDistance) { bestDistance = candidate.distance; bestIndex = index; }
  }
  return route.slice(bestIndex);
}

export function worldRouteDistance(player: FlatPoint, route: readonly WorldRoutePoint[]): number {
  const remaining = remainingWorldRoute(player, route);
  if (!remaining.length) return 0;
  let distance = Math.hypot(player.x - remaining[0]!.x, player.z - remaining[0]!.z);
  for (let index = 1; index < remaining.length; index++)
    distance += Math.hypot(remaining[index]!.x - remaining[index - 1]!.x, remaining[index]!.z - remaining[index - 1]!.z);
  return distance;
}
