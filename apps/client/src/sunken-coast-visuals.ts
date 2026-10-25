import type { PaintedGroundStyle } from "./fast-world-texture.js";
import {
  SUNKEN_COAST_NAVIGATION_ROCKS,
  SUNKEN_COAST_NAVIGATION_SANDBARS,
  SUNKEN_COAST_NAVIGATION_TIDE_POOLS,
  SUNKEN_COAST_NAVIGATION_WRECKAGE,
} from "@blockcraft/protocol";

export const SUNKEN_COAST_LEADER_POSITION = { x: 70.5, z: 174.5 } as const;

export const SUNKEN_COAST_TEXTURE_STYLES: Readonly<Record<"sand" | "shallows", PaintedGroundStyle>> = {
  sand: {
    name: "sunken-coast-sand",
    base: "#806b48",
    mottles: ["#9b8358", "#65563c", "#aa9061", "#736446"],
    litter: ["#c1a66f", "#4e6b69", "#56402c", "#8e7750"],
    seed: 71_321,
  },
  shallows: {
    name: "sunken-coast-shallows",
    base: "#24666b",
    mottles: ["#2d7b77", "#1c505a", "#398a7e", "#2c6260"],
    litter: ["#8bb595", "#b6a76c", "#315458", "#d1bc79"],
    seed: 83_907,
  },
} as const;

export const SUNKEN_COAST_TIDE_POOLS = SUNKEN_COAST_NAVIGATION_TIDE_POOLS;
export const SUNKEN_COAST_SANDBARS = SUNKEN_COAST_NAVIGATION_SANDBARS;
export const SUNKEN_COAST_WRECKAGE = SUNKEN_COAST_NAVIGATION_WRECKAGE;
export const SUNKEN_COAST_ROCKS = SUNKEN_COAST_NAVIGATION_ROCKS;

export const SUNKEN_COAST_GRASS = [
  [44, 154], [48, 184], [57, 169], [64, 151], [68, 186], [79, 158],
  [86, 179], [93, 151], [100, 169], [102, 182], [73, 166], [82, 151],
  [42.5, 164], [46, 176], [53, 172], [59, 149.5], [67, 154], [75, 184],
  [81, 169], [88, 183], [94, 173], [101, 155], [99, 185], [84, 155],
] as const;

/** Broad translucent sheets make the biome read as a coastline rather than a
 * collection of isolated ponds. They are shallow, traversable colour layers;
 * authoritative deep-water exclusions remain in the navigation definition. */
export const SUNKEN_COAST_SHALLOW_SHEETS = [
  { x: 48, z: 182.5, width: 15, depth: 9, yaw: -6 },
  { x: 66, z: 182.3, width: 20, depth: 10, yaw: 4 },
  { x: 87, z: 181.8, width: 20, depth: 10, yaw: -5 },
  { x: 102, z: 178.5, width: 5.2, depth: 16, yaw: 3 },
] as const;

export const SUNKEN_COAST_DUNES = [
  { x: 43.5, z: 153, width: 8.5, depth: 4.8, yaw: 16 },
  { x: 55, z: 166.5, width: 7, depth: 4.2, yaw: -18 },
  { x: 75, z: 153, width: 11, depth: 4.5, yaw: 8 },
  { x: 87.5, z: 171.5, width: 8, depth: 4, yaw: 22 },
  { x: 99.5, z: 150.5, width: 7, depth: 4.4, yaw: -12 },
] as const;

export const SUNKEN_COAST_DRIFTWOOD = [
  { x: 45.5, z: 160.5, length: 2.8, yaw: 28 },
  { x: 53, z: 178, length: 3.6, yaw: -12 },
  { x: 74.5, z: 184, length: 3.1, yaw: 51 },
  { x: 92, z: 157, length: 2.5, yaw: -38 },
  { x: 99.5, z: 173, length: 3.4, yaw: 17 },
] as const;

export const SUNKEN_COAST_SHELL_BEDS = [
  { x: 48, z: 155, radius: 1.6 },
  { x: 58, z: 172, radius: 1.9 },
  { x: 76, z: 162, radius: 1.5 },
  { x: 90, z: 181, radius: 2.1 },
  { x: 100, z: 166, radius: 1.6 },
] as const;

export const SUNKEN_COAST_HERO_WRECK = {
  x: 83,
  z: 184.5,
  yaw: -18,
  length: 10.5,
  mastHeight: 7.5,
} as const;
