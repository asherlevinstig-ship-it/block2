import type { PaintedGroundStyle } from "./fast-world-texture.js";

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

export const SUNKEN_COAST_TIDE_POOLS = [
  { x: 47, z: 170, width: 5.8, depth: 3.4, yaw: 18 },
  { x: 60, z: 154, width: 4.2, depth: 2.5, yaw: -12 },
  { x: 82, z: 184, width: 6.4, depth: 3.1, yaw: 24 },
  { x: 97, z: 158, width: 4.8, depth: 2.6, yaw: -27 },
] as const;

export const SUNKEN_COAST_WRECKAGE = [
  { x: 51, z: 158, yaw: 28, length: 4.8 },
  { x: 61, z: 182, yaw: -36, length: 5.4 },
  { x: 88, z: 153, yaw: 14, length: 4.2 },
  { x: 98, z: 178, yaw: -18, length: 5.1 },
] as const;

export const SUNKEN_COAST_ROCKS = [
  [45, 181, 1.15], [54, 151, .8], [67, 162, 1.35], [78, 185, .95],
  [89, 167, 1.2], [101, 184, .85], [96, 151, 1.05], [74, 151, .72],
] as const;

export const SUNKEN_COAST_GRASS = [
  [44, 154], [48, 184], [57, 169], [64, 151], [68, 186], [79, 158],
  [86, 179], [93, 151], [100, 169], [102, 182], [73, 166], [82, 151],
] as const;
