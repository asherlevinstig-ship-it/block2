export interface TowerProgress {
  highestFloorCleared: number;
  clearedFloors: number[];
}

const MAX_TOWER_FLOOR = 100;

const safeFloor = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 1
    ? Math.min(MAX_TOWER_FLOOR, Math.floor(value)) : null;

export function parseTowerProgress(source: string): TowerProgress {
  try {
    const value = JSON.parse(source) as {
      crownkeeperFragments?: unknown;
      towerProgress?: { highestFloorCleared?: unknown; clearedFloors?: unknown };
    };
    const legacyFloors = typeof value?.crownkeeperFragments === "number" && value.crownkeeperFragments > 0 ? [1] : [];
    const recordedFloors = Array.isArray(value?.towerProgress?.clearedFloors)
      ? value.towerProgress.clearedFloors.flatMap(floor => safeFloor(floor) ?? []).filter((floor, index, all) => all.indexOf(floor) === index).sort((a, b) => a - b)
      : [];
    const floors = [...new Set([...legacyFloors, ...recordedFloors])].sort((a, b) => a - b);
    const recordedHighest = safeFloor(value?.towerProgress?.highestFloorCleared) ?? 0;
    return { highestFloorCleared: Math.max(recordedHighest, floors.at(-1) ?? 0), clearedFloors: floors };
  } catch {
    return { highestFloorCleared: 0, clearedFloors: [] };
  }
}

export function withTowerFloorCleared(source: string, floor: number): {
  json: string;
  firstClear: boolean;
  progress: TowerProgress;
} {
  const clearedFloor = safeFloor(floor);
  const before = parseTowerProgress(source);
  if (clearedFloor === null) return { json: source, firstClear: false, progress: before };
  const firstClear = !before.clearedFloors.includes(clearedFloor);
  const progress = {
    highestFloorCleared: Math.max(before.highestFloorCleared, clearedFloor),
    clearedFloors: [...new Set([...before.clearedFloors, clearedFloor])].sort((a, b) => a - b),
  };
  let raw: unknown;
  try { raw = JSON.parse(source); } catch { raw = {}; }
  const base = Array.isArray(raw) ? { loadouts: raw } : raw && typeof raw === "object" ? raw : {};
  return { json: JSON.stringify({ ...base, towerProgress: progress }), firstClear, progress };
}
