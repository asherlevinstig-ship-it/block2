import type { TowerProgress } from "./tower-progress.js";

export type TowerFloorDirectoryEntry = {
  floor: number;
  name: string;
  levelLabel: string;
  unlocked: boolean;
  cleared: boolean;
  requirement: string;
  status: "available" | "cleared" | "locked" | "construction";
};

export type TowerFloorDirectoryUpdate = {
  highestFloorCleared: number;
  entries: TowerFloorDirectoryEntry[];
};

const FLOOR_DIRECTORY = [
  { floor: 1, name: "The Overgrown Rampart", levelLabel: "LV 1–4" },
  { floor: 2, name: "The Emberworks", levelLabel: "LV 4–8" },
] as const;

export function towerFloorUnlocked(progress: TowerProgress, floor: number): boolean {
  void progress;
  return floor === 1 || floor === 2;
}

export function towerFloorDirectory(progress: TowerProgress): TowerFloorDirectoryUpdate {
  const entries: TowerFloorDirectoryEntry[] = FLOOR_DIRECTORY.map(definition => {
    const cleared = progress.clearedFloors.includes(definition.floor);
    const unlocked = towerFloorUnlocked(progress, definition.floor);
    return {
      ...definition,
      unlocked,
      cleared,
      requirement: definition.floor === 1 ? "Tower entrance" : "Open for floor testing",
      status: cleared ? "cleared" : unlocked ? "available" : "locked",
    };
  });
  entries.push({
    floor: 3,
    name: "Unknown Floor",
    levelLabel: "COMING SOON",
    unlocked: false,
    cleared: false,
    requirement: "Floor 3 is still being forged",
    status: "construction",
  });
  return { highestFloorCleared: progress.highestFloorCleared, entries };
}
