import { MILESTONE_CAVE_X_OFFSET } from "@blockcraft/voxel-world";

export interface ExitStep {
  x: number;
  topY: number;
  z: number;
}

export const MILESTONE_EXIT_STEPS: readonly ExitStep[] = [
  ...Array.from({ length: 14 }, (_, index) => ({ x: 57.5 - index, topY: 1, z: 8.5 })),
  { x: 43.5, topY: 1, z: 8.5 },
  { x: 42.5, topY: 2, z: 8.5 },
  ...Array.from({ length: 4 }, (_, index) => ({ x: 41.5 - index, topY: 3, z: 8.5 })),
  { x: 23.5 + MILESTONE_CAVE_X_OFFSET, topY: 3, z: 8.5 },
  { x: 22.5 + MILESTONE_CAVE_X_OFFSET, topY: 3, z: 8.5 },
  { x: 21.5 + MILESTONE_CAVE_X_OFFSET, topY: 4, z: 8.5 },
  { x: 20.5 + MILESTONE_CAVE_X_OFFSET, topY: 5, z: 8.5 },
  { x: 19.5 + MILESTONE_CAVE_X_OFFSET, topY: 6, z: 8.5 },
  { x: 18.5 + MILESTONE_CAVE_X_OFFSET, topY: 7, z: 8.5 },
] as const;
