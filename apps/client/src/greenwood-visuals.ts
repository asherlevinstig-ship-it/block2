import type { TownAssetPlacement } from "./town-asset-kit.js";
import type { PaintedGroundStyle } from "./fast-world-texture.js";

export const GREENWOOD_LEADER_POSITION = { x: 150.5, z: 106.5 } as const;

export const GREENWOOD_TEXTURE_STYLES: Readonly<Record<"forestFloor" | "moss" | "leafLitter" | "bark", PaintedGroundStyle>> = {
  forestFloor: {
    name: "greenwood-forest-floor",
    base: "#244f2a",
    mottles: ["#183d22", "#356538", "#486934", "#203f28"],
    litter: ["#8a6332", "#5e4728", "#a27a3d", "#183a20"],
    seed: 9_173,
  },
  moss: {
    name: "greenwood-moss",
    base: "#315d2e",
    mottles: ["#47783a", "#1c4928", "#64833d", "#284f2a"],
    litter: ["#b08a46", "#6f5228", "#d0ad5c", "#294b22"],
    seed: 14_219,
  },
  leafLitter: {
    name: "greenwood-leaf-litter",
    base: "#58412a",
    mottles: ["#382c20", "#745637", "#6a4b28", "#314026"],
    litter: ["#b17a35", "#d09a47", "#81582d", "#26391f"],
    seed: 27_811,
  },
  bark: {
    name: "greenwood-bark",
    base: "#49331f",
    mottles: ["#2b241d", "#694526", "#765634", "#384026"],
    litter: ["#231b16", "#8b663c", "#577039", "#34261c"],
    seed: 51_083,
  },
} as const;

const trees = [
  [110, 81, 18, 1.55], [116, 80, -25, 1.72], [122, 82, 42, 1.48], [128, 80, -8, 1.82],
  [135, 81, 65, 1.62], [142, 80, -44, 1.9], [149, 82, 24, 1.58], [154, 80, 92, 1.76],
  [110, 132, -12, 1.7], [116, 133, 38, 1.5], [123, 131, -58, 1.86], [130, 133, 16, 1.62],
  [137, 131, 73, 1.78], [144, 133, -30, 1.53], [150, 131, 11, 1.9], [155, 133, -76, 1.68],
  [118, 89, 30, 1.38], [123, 94, -45, 1.5], [130, 87, 82, 1.42], [137, 93, -18, 1.66],
  [145, 88, 47, 1.52], [151, 96, -63, 1.58], [117, 123, -31, 1.46], [125, 128, 12, 1.58],
  [132, 121, 61, 1.42], [141, 126, -52, 1.72], [149, 118, 26, 1.5], [153, 127, -7, 1.62],
  [145, 98, 14, 1.68], [145, 115, -37, 1.75], [151, 97, 68, 1.48], [151, 116, -71, 1.56],
  [155, 100, 39, 1.7], [155, 113, -20, 1.65], [110, 92, 55, 1.42], [110, 120, -42, 1.52],
  // A denser threshold frames the east gate without closing the combat road.
  [109.5, 97.2, 18, 1.48], [109.8, 114.8, -21, 1.58], [114.5, 95.8, 64, 1.7], [115.2, 116.3, -52, 1.62],
  [121, 96.4, -12, 1.78], [121.8, 115.4, 31, 1.68], [127.5, 97.5, 47, 1.54], [128.2, 114.5, -68, 1.6],
] as const;

const rocks = [
  [114, 86, 12, .7], [121, 119, -18, .62], [126, 91, 46, .75], [134, 128, -35, .64],
  [139, 85, 74, .8], [143, 119, 18, .58], [151, 88, -52, .72], [153, 125, 31, .66],
  [147, 101, 8, .56], [147, 112, -14, .62], [154, 97, 65, .54], [154, 116, -72, .58],
] as const;

export const GREENWOOD_ASSET_PLACEMENTS: readonly TownAssetPlacement[] = [
  ...trees.map(([x, z, yaw, scale], index): TownAssetPlacement => ({
    id: index % 3 === 0 ? "treeCrooked" : "treeHighRound",
    name: `greenwood-tree-${String(index + 1).padStart(2, "0")}`,
    position: [x, 8.15, z], yaw, scale,
  })),
  ...rocks.map(([x, z, yaw, scale], index): TownAssetPlacement => ({
    id: index % 2 === 0 ? "rockLarge" : "rockSmall",
    name: `greenwood-rock-${String(index + 1).padStart(2, "0")}`,
    position: [x, 8.15, z], yaw, scale,
  })),
] as const;

export interface GreenwoodGroundPatch {
  id: string;
  material: "moss" | "leafLitter";
  position: readonly [number, number];
  scale: readonly [number, number];
  yaw: number;
}

export const GREENWOOD_GROUND_PATCHES: readonly GreenwoodGroundPatch[] = [
  { id: "west-moss", material: "moss", position: [116, 92], scale: [6.8, 3.9], yaw: 18 },
  { id: "north-glade", material: "moss", position: [132, 88], scale: [8.5, 4.2], yaw: -12 },
  { id: "south-glade", material: "moss", position: [130, 124], scale: [7.8, 4.5], yaw: 24 },
  { id: "thorn-path", material: "leafLitter", position: [141, 104], scale: [8.5, 2.4], yaw: -8 },
  { id: "fallen-grove", material: "leafLitter", position: [121, 116], scale: [5.5, 3.2], yaw: 33 },
  { id: "elderthorn-clearing", material: "leafLitter", position: [150.5, 106.5], scale: [6.4, 6.4], yaw: 0 },
] as const;

export const GREENWOOD_FALLEN_LOGS = [
  { x: 119, z: 96, yaw: 22, length: 3.4 },
  { x: 128, z: 117, yaw: -36, length: 4.2 },
  { x: 139, z: 89, yaw: 18, length: 3.8 },
  { x: 142, z: 122, yaw: -15, length: 3.3 },
  { x: 150, z: 99, yaw: 48, length: 3.1 },
] as const;

export const GREENWOOD_UNDERGROWTH = [
  [113, 86, .8], [117, 92, 1.1], [121, 86, .9], [125, 98, .8], [129, 84, 1.2], [133, 96, .75],
  [138, 86, .95], [143, 94, 1.15], [149, 86, .82], [153, 93, 1.05], [115, 126, .9], [120, 120, 1.1],
  [126, 130, .78], [131, 119, 1.2], [136, 128, .92], [142, 118, 1.08], [148, 127, .8], [153, 121, 1.15],
  [115, 99, .72], [118, 114, .86], [129, 101, .78], [134, 113, .9], [141, 99, .74], [144, 113, .82],
  [148, 97, .7], [148, 116, .75], [154, 101, .8], [154, 112, .82],
] as const;

export const GREENWOOD_GROVE_STONES = [
  { x: 144.4, z: 102.2, yaw: -18 }, { x: 144.1, z: 111.1, yaw: 16 },
  { x: 149.2, z: 97.7, yaw: 8 }, { x: 149.4, z: 115.4, yaw: -11 },
  { x: 155.8, z: 101.5, yaw: 22 }, { x: 156, z: 111.4, yaw: -25 },
] as const;
