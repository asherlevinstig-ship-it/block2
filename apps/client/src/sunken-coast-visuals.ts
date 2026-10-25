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
] as const;
