export interface ExitStep {
  x: number;
  topY: number;
  z: number;
}

export const MILESTONE_EXIT_STEPS: readonly ExitStep[] = [
  { x: 23.5, topY: 3, z: 8.5 },
  { x: 22.5, topY: 3, z: 8.5 },
  { x: 21.5, topY: 4, z: 8.5 },
  { x: 20.5, topY: 5, z: 8.5 },
  { x: 19.5, topY: 6, z: 8.5 },
  { x: 18.5, topY: 7, z: 8.5 },
] as const;
