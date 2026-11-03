export const TOWER_FLOOR_TWO_ATMOSPHERE = {
  // A near-night navy sky lets the orange furnace and blue coolant lighting
  // define the floor without reducing traversal silhouettes to black shapes.
  skyTint: [.09, .13, .21] as const,
  // Dark enough to feel subterranean, bright enough to retain wall, enemy
  // and route silhouettes on ordinary displays and the automatic LOW preset.
  ambient: [.19, .18, .205] as const,
  fog: [.055, .065, .09] as const,
  sun: .24,
  fill: .19,
  fogStart: 29,
  fogEnd: 78,
} as const;
