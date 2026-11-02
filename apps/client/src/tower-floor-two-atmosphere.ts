export const TOWER_FLOOR_TWO_ATMOSPHERE = {
  // A near-night navy sky lets the orange furnace and blue coolant lighting
  // define the floor without reducing traversal silhouettes to black shapes.
  skyTint: [.11, .15, .24] as const,
  ambient: [.105, .115, .15] as const,
  fog: [.035, .045, .07] as const,
  sun: .16,
  fill: .105,
  fogStart: 20,
  fogEnd: 62,
} as const;
