import type { PaintedGroundStyle } from "./fast-world-texture.js";

export const MISTFEN_TEXTURE_STYLES: Readonly<Record<"marsh" | "water" | "mud", PaintedGroundStyle>> = {
  marsh: {
    name: "mistfen-marsh-floor", base: "#263d31",
    mottles: ["#172c27", "#365443", "#314636", "#1d3530"],
    litter: ["#71824b", "#435734", "#8a7945", "#1c2d28"], seed: 42_117,
  },
  water: {
    name: "mistfen-toxic-water", base: "#174449",
    mottles: ["#0d3037", "#24615e", "#315f4d", "#123b42"],
    litter: ["#7d9c45", "#4f713b", "#9caf55", "#173b35"], seed: 64_309,
  },
  mud: {
    name: "mistfen-mud", base: "#3f3b2d",
    mottles: ["#262b25", "#53503a", "#344033", "#302e28"],
    litter: ["#6e6a45", "#879052", "#4a583a", "#232923"], seed: 81_733,
  },
} as const;

export const MISTFEN_TOXIC_POOLS = [
  { id: "entry-shallows", x: 160, z: 75, width: 4.2, depth: 2.4, yaw: -12 },
  { id: "drowned-water", x: 169, z: 59, width: 3.6, depth: 2.5, yaw: 18 },
  { id: "western-mire", x: 158, z: 43, width: 3.2, depth: 2.6, yaw: 8 },
  { id: "reed-depths", x: 184, z: 28.5, width: 4.6, depth: 2.7, yaw: -16 },
  { id: "spring-runoff", x: 198, z: 45, width: 3.8, depth: 2.5, yaw: 21 },
  { id: "eastern-shallows", x: 199, z: 64, width: 3.5, depth: 2.2, yaw: -10 },
  { id: "mother-mire", x: 187.5, z: 55.5, width: 2.8, depth: 1.9, yaw: 25 },
] as const;

/** Narrow dry routes are deliberately authored between damaging pools. */
export const MISTFEN_BOARDWALKS = [
  { id: "greenwood-entry", x: 157.5, z: 78.5, length: 9, width: 2.5, yaw: -28 },
  { id: "drowned-crossing", x: 164, z: 69, length: 10, width: 2.35, yaw: -38 },
  { id: "basin-approach", x: 172, z: 60.5, length: 10.5, width: 2.3, yaw: -43 },
  { id: "mother-bridge", x: 177.5, z: 54, length: 6.5, width: 2.5, yaw: -24 },
  { id: "reed-turn", x: 181.5, z: 43, length: 11, width: 2.2, yaw: 7 },
  { id: "spring-crossing", x: 190.5, z: 48.5, length: 10, width: 2.2, yaw: 38 },
  { id: "cinder-exit", x: 198, z: 68, length: 15, width: 2.45, yaw: 70 },
] as const;

export const MISTFEN_SNAGS = [
  { x: 156, z: 51, yaw: 8 }, { x: 164, z: 29, yaw: -17 }, { x: 176, z: 73, yaw: 26 },
  { x: 190, z: 26, yaw: -8 }, { x: 200, z: 38, yaw: 14 }, { x: 202, z: 59, yaw: -24 },
  { x: 172, z: 37, yaw: 31 }, { x: 187, z: 67, yaw: -11 }, { x: 158, z: 61, yaw: 19 },
] as const;

export const MISTFEN_REEDS = [
  [155, 29], [160, 35], [163, 48], [165, 62], [169, 27], [172, 52], [175, 72], [178, 31],
  [182, 38], [185, 27], [187, 42], [190, 58], [193, 31], [196, 41], [199, 29], [201, 51],
  [202, 69], [194, 77], [183, 75], [171, 77], [157, 70], [188, 63], [197, 60], [177, 47],
] as const;

export type MistfenLandmarkKind = "drowned-camp" | "reed-maze" | "corrupted-spring" | "guarded-cache" | "leader-basin";

export const MISTFEN_LANDMARKS: readonly {
  id: string; name: string; kind: MistfenLandmarkKind; x: number; z: number; radius: number;
}[] = [
  { id: "drowned-camp", name: "Drowned Camp", kind: "drowned-camp", x: 164, z: 66.5, radius: 8 },
  { id: "reed-maze", name: "Whispering Reed Maze", kind: "reed-maze", x: 186.5, z: 36, radius: 8 },
  { id: "corrupted-spring", name: "Corrupted Spring", kind: "corrupted-spring", x: 197, z: 54.5, radius: 8 },
  { id: "wayfinder-cache", name: "Wayfinder Cache", kind: "guarded-cache", x: 194.5, z: 72.5, radius: 7 },
  { id: "miremother-basin", name: "Miremother Basin", kind: "leader-basin", x: 179.5, z: 51.5, radius: 10 },
] as const;

export const MISTFEN_ROUTE_NODES = [
  { id: "greenwood-threshold", x: 153.5, z: 80.5 },
  { id: "drowned-camp", x: 164, z: 66.5 },
  { id: "miremother-basin", x: 179.5, z: 51.5 },
  { id: "spring-crossing", x: 192, z: 55 },
  { id: "wayfinder-cache", x: 194.5, z: 72.5 },
  { id: "ashen-threshold", x: 202.5, z: 77.5 },
] as const;
